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

const CHANNEL_ID = 'personal-daily-alarms-v3';
const ALARM_KIND = 'PERSONAL_DAILY_ALARM';

export type AlarmItemData = {
  id?: number;
  label?: string;
  alarm_time: string; // "HH:MM:SS" or "HH:MM"
  is_enabled: boolean;
  days_of_week?: string[]; // e.g. ["MON", "TUE", ...]
  specific_dates?: string[]; // e.g. ["2026-11-13"]
  timezone?: string;
};

// Configure foreground notification behavior: let system play loud notification sound + vibration
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

export function parseTime(value?: string): { hours: number; minutes: number } | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

const DAY_INDEX_MAP: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

export async function cancelPersonalAlarmNotifications() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (
        item.content.data?.kind === ALARM_KIND ||
        item.identifier.startsWith('personal-alarm-') ||
        item.identifier.startsWith('personal-daily-alarm-')
      ) {
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
  const [activeAlarmTitle, setActiveAlarmTitle] = useState<string>('Personal Alarm');

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
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Personal Alarms',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 800, 400, 800, 400, 800],
        enableVibrate: true,
        enableLights: true,
        lightColor: '#E56108',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
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

  const playAlarm = useCallback(async (timeStr?: string, titleStr?: string) => {
    setActiveAlarm(true);
    setActiveAlarmTime(timeStr || '');
    setActiveAlarmTitle(titleStr || 'Personal Alarm');

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
      });

      if (!playerRef.current) {
        const player = createAudioPlayer(
          require('../../assets/shift_reminder_alarm.wav')
        );
        playerRef.current = player;
        player.loop = true;
        player.volume = 1.0;
        player.play();
      } else {
        playerRef.current.play();
      }
    } catch (error) {
      console.warn('Could not play personal alarm audio:', error);
    }
  }, []);

  // Sync scheduled alarms from backend
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

      // Fetch personal alarms list from backend
      const res = await api.get('/attendance/personal-alarm/');
      const data = res.data;

      let alarmsList: AlarmItemData[] = [];
      if (Array.isArray(data?.alarms)) {
        alarmsList = data.alarms;
      } else if (data?.alarm_time) {
        alarmsList = [data];
      }

      // Filter active alarms
      const activeAlarms = alarmsList.filter((a) => a.is_enabled && a.alarm_time);

      await cancelPersonalAlarmNotifications();

      if (activeAlarms.length === 0) {
        stopAlarm();
        return;
      }

      const now = new Date();
      const nativeAlarmItems: Array<{
        id: string;
        timestamp: number;
        event: any;
        shiftName: string;
        title: string;
        body: string;
      }> = [];

      for (let idx = 0; idx < activeAlarms.length; idx += 1) {
        const alarm = activeAlarms[idx];
        const parsed = parseTime(alarm.alarm_time);
        if (!parsed) continue;

        const alarmId = alarm.id ? String(alarm.id) : `alarm-${idx}`;
        const label = alarm.label || `Alarm ${idx + 1}`;
        const timeDisplay = `${String(parsed.hours % 12 || 12).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')} ${parsed.hours >= 12 ? 'PM' : 'AM'}`;

        const hasDays = Array.isArray(alarm.days_of_week) && alarm.days_of_week.length > 0;
        const hasDates = Array.isArray(alarm.specific_dates) && alarm.specific_dates.length > 0;

        // Schedule next 14 days occurrences
        for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
          const target = new Date(now);
          target.setDate(target.getDate() + dayOffset);
          target.setHours(parsed.hours, parsed.minutes, 0, 0);

          if (target.getTime() <= now.getTime()) {
            continue;
          }

          // Check Day of Week filter
          if (hasDays) {
            const currentDayIndex = target.getDay(); // 0 = SUN, 1 = MON, ...
            const dayAllowed = alarm.days_of_week!.some(
              (d) => DAY_INDEX_MAP[d.toUpperCase()] === currentDayIndex
            );
            if (!dayAllowed) continue;
          }

          // Check Specific Date filter
          if (hasDates) {
            const y = target.getFullYear();
            const m = String(target.getMonth() + 1).padStart(2, '0');
            const d = String(target.getDate()).padStart(2, '0');
            const targetDateStr = `${y}-${m}-${d}`;
            const dateAllowed = alarm.specific_dates!.includes(targetDateStr);
            if (!dateAllowed) continue;
          }

          const occurrenceId = `personal-alarm-${alarmId}-${target.getTime()}`;

          // Schedule local notification with sound & vibration
          await Notifications.scheduleNotificationAsync({
            identifier: occurrenceId,
            content: {
              title: label,
              body: `Alarm ringing at ${timeDisplay}`,
              sound: true,
              data: {
                kind: ALARM_KIND,
                alarmId,
                alarmTitle: label,
                alarmTime: timeDisplay,
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: target,
              channelId: CHANNEL_ID,
            },
          });

          // Native exact alarm
          nativeAlarmItems.push({
            id: occurrenceId,
            timestamp: target.getTime(),
            event: 'SHIFT_START', // Use valid event for native module playback
            shiftName: label,
            title: label,
            body: `Alarm for ${timeDisplay} is ringing!`,
          });
        }
      }

      if (nativeAlarmItems.length > 0) {
        try {
          ShiftAlarm?.scheduleAlarms(nativeAlarmItems);
        } catch (error) {
          // Native module not linked in Expo Go
        }
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

        void playAlarm(String(data.alarmTime || ''), String(data.alarmTitle || ''));
      }
    );

    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.kind !== ALARM_KIND) return;

        void playAlarm(String(data.alarmTime || ''), String(data.alarmTitle || ''));
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

    // Periodic resync every 3 minutes
    const interval = setInterval(() => void syncPersonalAlarm(), 3 * 60 * 1000);

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
          <Text style={styles.title}>{activeAlarmTitle || 'Personal Alarm'}</Text>
          <Text style={styles.timeHighlight}>{activeAlarmTime || 'Alarm'}</Text>
          <Text style={styles.body}>
            It's time for your scheduled reminder!
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
