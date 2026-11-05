import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';
import { AuthContext, api } from '../context/AuthContext';
import ShiftAlarm from '../../modules/shift-alarm/src/ShiftAlarm';

const CHANNEL_ID = 'personal-daily-alarms-v2';
const ALARM_KIND = 'PERSONAL_DAILY_ALARM';

type PersonalAlarmData = {
  alarm_time: string;
  is_enabled: boolean;
  timezone?: string;
};

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isPersonalAlarm =
      notification.request.content.data?.kind === ALARM_KIND;

    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !isPersonalAlarm,
      shouldSetBadge: false,
    };
  },
});

function parseTime(value?: string): { hours: number; minutes: number } | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

export async function cancelPersonalAlarmNotifications() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.content.data?.kind === ALARM_KIND || item.identifier.startsWith('personal-alarm-')) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
  } catch (error) {
    console.warn('Could not cancel scheduled personal alarm notifications:', error);
  }

  try {
    ShiftAlarm?.cancelAlarms();
  } catch (error) {
    // Expected in Expo Go without custom native module
  }
}

export default function PersonalAlarmManager() {
  const { isAuthenticated } = useContext(AuthContext);
  const playerRef = useRef<AudioPlayer | null>(null);
  const syncInProgress = useRef(false);
  const exactAlarmPromptShown = useRef(false);
  const exactAlarmSettingsOpened = useRef(false);
  const channelCreatedRef = useRef(false);

  const [activeAlarm, setActiveAlarm] = useState<boolean>(false);
  const [activeAlarmTime, setActiveAlarmTime] = useState<string>('');

  const checkExactAlarmPermission = useCallback(() => {
    if (!ShiftAlarm || exactAlarmPromptShown.current) return;

    try {
      const canSchedule = ShiftAlarm.canScheduleExactAlarms();
      if (canSchedule) return;

      exactAlarmPromptShown.current = true;

      Alert.alert(
        'Enable reliable personal alarm',
        'Allow exact alarms in Android Settings so your daily alarm can ring at the exact scheduled time when the app is in the background.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              try {
                exactAlarmSettingsOpened.current = true;
                ShiftAlarm?.openExactAlarmSettings();
              } catch (error) {
                exactAlarmSettingsOpened.current = false;
                console.warn('Could not open exact-alarm settings:', error);
              }
            },
          },
        ]
      );
    } catch (error) {
      // ShiftAlarm native module not linked in Expo Go; safe to ignore
    }
  }, []);

  const ensureNotificationChannel = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    if (channelCreatedRef.current) return;

    try {
      // In Expo SDK 58 / Android O+, setting sound: null causes a NullPointerException in Expo's channel serializer
      // when converting AudioAttributes. Omitting sound or using a valid sound string avoids this crash.
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Personal Daily Alarm',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 700, 300, 700],
        enableVibrate: true,
        enableLights: true,
        lightColor: '#22C55E',
      });
      channelCreatedRef.current = true;
    } catch (err: any) {
      console.warn('Could not configure personal alarm notification channel:', err?.message || err);
    }
  }, []);

  const stopAlarm = useCallback(() => {
    try {
      ShiftAlarm?.stopAlarm();
    } catch {}

    try {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.seekTo(0);
        playerRef.current.release();
        playerRef.current = null;
      }
    } catch (error) {
      console.warn('Could not stop personal alarm audio:', error);
    }

    setActiveAlarm(false);
  }, []);

  const playAlarm = useCallback(async (timeStr?: string) => {
    setActiveAlarm(true);
    setActiveAlarmTime(timeStr || '');

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
      });

      const player = createAudioPlayer(
        require('../../assets/shift-reminder-alarm.wav')
      );
      playerRef.current = player;
      player.loop = true;
      player.volume = 1.0;
      player.play();
    } catch (error) {
      console.warn('Could not play personal alarm audio:', error);
    }
  }, []);

  // Sync scheduled alarm from backend
  const syncPersonalAlarm = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;

    try {
      if (!isAuthenticated) {
        await cancelPersonalAlarmNotifications();
        stopAlarm();
        return;
      }

      const permission = await Notifications.getPermissionsAsync();
      let granted = permission.granted;

      if (!granted) {
        const requested = await Notifications.requestPermissionsAsync();
        granted = requested.granted;
      }

      if (!granted) {
        await cancelPersonalAlarmNotifications();
        console.warn('Personal alarm disabled: notification permission was denied.');
        return;
      }

      checkExactAlarmPermission();
      await ensureNotificationChannel();

      // Fetch personal alarm configuration from backend
      const res = await api.get('/attendance/personal-alarm/');
      const alarmData: PersonalAlarmData = res.data;

      if (!alarmData || !alarmData.is_enabled || !alarmData.alarm_time) {
        await cancelPersonalAlarmNotifications();
        stopAlarm();
        return;
      }

      const parsed = parseTime(alarmData.alarm_time);
      if (!parsed) {
        await cancelPersonalAlarmNotifications();
        console.warn('Invalid personal alarm time format:', alarmData.alarm_time);
        return;
      }

      await cancelPersonalAlarmNotifications();

      const timeDisplay = `${String(parsed.hours % 12 || 12).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')} ${parsed.hours >= 12 ? 'PM' : 'AM'}`;

      // Schedule exact daily recurring local notification via Expo Notifications
      await Notifications.scheduleNotificationAsync({
        identifier: 'personal-daily-alarm-recurring',
        content: {
          title: 'Personal Daily Alarm',
          body: `Your daily alarm for ${timeDisplay} is ringing.`,
          data: {
            kind: ALARM_KIND,
            alarmTime: timeDisplay,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: parsed.hours,
          minute: parsed.minutes,
          channelId: CHANNEL_ID,
        },
      });

      // Prepare native exact alarm fallback if custom native module is present
      try {
        const now = new Date();
        const nativeAlarmItems: Array<{ id: string; timestamp: number; event: any; shiftName: string; title: string; body: string }> = [];

        for (let offset = 0; offset < 7; offset += 1) {
          const targetDate = new Date(now);
          targetDate.setHours(parsed.hours, parsed.minutes, 0, 0);
          targetDate.setDate(targetDate.getDate() + offset);

          if (targetDate.getTime() <= now.getTime()) {
            continue;
          }

          nativeAlarmItems.push({
            id: `personal-alarm-${targetDate.getFullYear()}-${targetDate.getMonth() + 1}-${targetDate.getDate()}`,
            timestamp: targetDate.getTime(),
            event: 'PERSONAL_ALARM',
            shiftName: 'Personal Alarm',
            title: 'Personal Daily Alarm',
            body: `Daily alarm for ${timeDisplay}`,
          });
        }

        if (nativeAlarmItems.length > 0) {
          ShiftAlarm?.scheduleAlarms(nativeAlarmItems);
        }
      } catch (error) {
        // Native module not present in Expo Go
      }
    } catch (error: any) {
      console.warn('Personal alarm sync error:', error?.message || error);
    } finally {
      syncInProgress.current = false;
    }
  }, [isAuthenticated, stopAlarm, checkExactAlarmPermission, ensureNotificationChannel]);

  useEffect(() => {
    void syncPersonalAlarm();

    const receivedListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        if (data?.kind !== ALARM_KIND) return;

        void playAlarm(String(data.alarmTime || ''));
      }
    );

    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.kind !== ALARM_KIND) return;

        void playAlarm(String(data.alarmTime || ''));
      }
    );

    const appStateListener = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          void syncPersonalAlarm();
        }
      }
    );

    // Sync periodically
    const interval = setInterval(() => void syncPersonalAlarm(), 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      receivedListener.remove();
      responseListener.remove();
      appStateListener.remove();

      try {
        if (playerRef.current) {
          playerRef.current.pause();
          playerRef.current.seekTo(0);
          playerRef.current.release();
          playerRef.current = null;
        }
      } catch {}
    };
  }, [playAlarm, syncPersonalAlarm]);

  return (
    <Modal statusBarTranslucent visible={activeAlarm}
      transparent
      animationType="fade"
      onRequestClose={stopAlarm}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Personal Daily Alarm</Text>
          <Text style={styles.timeHighlight}>{activeAlarmTime || 'Daily Alarm'}</Text>
          <Text style={styles.body}>
            It's time for your daily attendance reminder!
          </Text>

          <Pressable style={styles.button} onPress={stopAlarm}>
            <Text style={styles.buttonText}>Stop Alarm</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  timeHighlight: {
    fontSize: 28,
    fontFamily: 'Comfortaa_700Bold',
    color: '#E56108',
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
  },
});
