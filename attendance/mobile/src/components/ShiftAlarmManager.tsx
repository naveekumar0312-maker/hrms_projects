import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Modal,
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

const CHANNEL_ID = 'shift-reminders-v2-silent';
const REMINDER_KIND = 'SHIFT_REMINDER';

type AlarmEvent = 'SHIFT_START' | 'SHIFT_END';

type ShiftDetails = {
  id: number;
  name?: string;
  start_time?: string;
  end_time?: string;
  reminders_enabled?: boolean;
};

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isShiftReminder =
      notification.request.content.data?.kind === REMINDER_KIND;

    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !isShiftReminder,
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

function atTime(date: Date, time: { hours: number; minutes: number }) {
  const result = new Date(date);
  result.setHours(time.hours, time.minutes, 0, 0);
  return result;
}

async function cancelShiftNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  for (const item of scheduled) {
    if (item.content.data?.kind === REMINDER_KIND) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }

  try {
    ShiftAlarm?.cancelAlarms();
  } catch (error) {
    console.warn('Could not cancel native shift alarms:', error);
  }
}

export default function ShiftAlarmManager() {
  const { isAuthenticated } = useContext(AuthContext);
  const playerRef = useRef<AudioPlayer | null>(null);
  const syncInProgress = useRef(false);
  const exactAlarmPromptShown = useRef(false);
  const exactAlarmSettingsOpened = useRef(false);

  const checkExactAlarmPermission = useCallback(() => {
    if (!ShiftAlarm || exactAlarmPromptShown.current) return;

    try {
      const canSchedule = ShiftAlarm.canScheduleExactAlarms();
      if (canSchedule) return;

      exactAlarmPromptShown.current = true;

      Alert.alert(
        'Enable reliable shift alarms',
        'Allow exact alarms in Android Settings so your shift alarm can ring closer to the scheduled time when the app is not open.',
        [
          {
            text: 'Not now',
            style: 'cancel',
          },
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
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.warn('Could not check exact-alarm permission:', error);
    }
  }, []);
  const [activeAlarm, setActiveAlarm] = useState<AlarmEvent | null>(null);
  const [shiftName, setShiftName] = useState('Your shift');

  const stopAlarm = useCallback(() => {
    try {
      ShiftAlarm?.stopAlarm();
    } catch (error) {
      console.warn('Could not stop native shift alarm:', error);
    }

    try {
      const player = playerRef.current;
      if (player) {
        player.pause();
        player.seekTo(0);
      }
    } catch (error) {
      console.warn('Could not stop shift alarm audio:', error);
    }
    setActiveAlarm(null);
  }, []);

  const playAlarm = useCallback(async (event: AlarmEvent, name?: string) => {
    setShiftName(name || 'Your shift');
    setActiveAlarm(event);

    try {
      await setAudioModeAsync({ playsInSilentMode: true });

      if (!playerRef.current) {
        playerRef.current = createAudioPlayer(
          require('../../assets/shift-reminder-alarm.wav')
        );
      }

      playerRef.current.loop = true;
      playerRef.current.volume = 0.8;
      playerRef.current.play();
    } catch (error) {
      console.warn('Could not play shift reminder audio:', error);
    }
  }, []);

  const syncReminders = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;

    try {
      if (!isAuthenticated) {
        await cancelShiftNotifications();
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
        await cancelShiftNotifications();
        console.warn('Shift reminders are disabled because notification permission was denied.');
        return;
      }

      checkExactAlarmPermission();

      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Shift Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 700, 300, 700],
        enableVibrate: true,
      });

      // Keep the previously scheduled reminders if the server is unreachable.
      const profileResponse = await api.get('/employees/me/');
      const profile = profileResponse.data;
      const shiftId = profile?.shift?.id;

      if (!shiftId) {
        await cancelShiftNotifications();
        stopAlarm();
        return;
      }

      const shiftResponse = await api.get(`/shifts/${shiftId}/`);
      const shift: ShiftDetails = shiftResponse.data;

      // Only an explicit admin-enabled flag permits reminders.
      if (shift.reminders_enabled !== true) {
        await cancelShiftNotifications();
        stopAlarm();
        return;
      }

      const startTime = parseTime(shift.start_time);
      const endTime = parseTime(shift.end_time);

      if (!startTime || !endTime) {
        await cancelShiftNotifications();
        console.warn('Shift reminders cancelled: invalid shift start/end time.');
        return;
      }

      await cancelShiftNotifications();

      const now = new Date();
      const nativeAlarmItems: Array<{ id: string; timestamp: number; event: AlarmEvent; shiftName: string; title: string; body: string }> = [];

      for (let offset = 0; offset < 3; offset += 1) {
        const shiftDate = new Date(now);
        shiftDate.setHours(0, 0, 0, 0);
        shiftDate.setDate(shiftDate.getDate() + offset);

        const startDate = atTime(shiftDate, startTime);
        const endDate = atTime(shiftDate, endTime);

        // If end time is earlier than or equal to start time, this is an overnight shift.
        if (endDate <= startDate) {
          endDate.setDate(endDate.getDate() + 1);
        }

        const events: Array<{
          event: AlarmEvent;
          when: Date;
          title: string;
          body: string;
        }> = [
          {
            event: 'SHIFT_START',
            when: new Date(startDate.getTime() - 5 * 60 * 1000),
            title: 'Shift Starting Soon',
            body: `${shift.name || 'Your shift'} starts in 5 minutes.`,
          },
          {
            event: 'SHIFT_END',
            when: endDate,
            title: 'Shift Ended',
            body: `${shift.name || 'Your shift'} has ended.`,
          },
        ];

        for (const event of events) {
          if (event.when.getTime() <= Date.now() + 5000) continue;

          nativeAlarmItems.push({
            id: `shift-${shift.id}-${event.event}-${event.when.getTime()}`,
            timestamp: event.when.getTime(),
            event: event.event,
            shiftName: shift.name || 'Your shift',
            title: event.title,
            body: event.body,
          });

          await Notifications.scheduleNotificationAsync({
            content: {
              title: event.title,
              body: event.body,
              sound: null,
              data: {
                kind: REMINDER_KIND,
                event: event.event,
                shiftName: shift.name || 'Your shift',
                shiftId: shift.id,
              },
              ...( { channelId: CHANNEL_ID } as any ),
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: event.when,
              ...( { channelId: CHANNEL_ID } as any ),
            },
          });
        }
      }

      try {
        ShiftAlarm?.scheduleAlarms(nativeAlarmItems);
      } catch (error) {
        console.warn('Could not schedule native shift alarms:', error);
      }

      setShiftName(shift.name || 'Your shift');
      console.log('Shift reminders synced:', shift.name, shift.start_time, shift.end_time);
    } catch (error: unknown) {
  const err = error as {
    response?: {
      status?: number;
      data?: unknown;
    };
    config?: {
      url?: string;
      method?: string;
    };
    message?: string;
  };

  console.warn('Shift reminder sync failed:', {
    status: err.response?.status,
    endpoint: err.config?.url,
    method: err.config?.method,
    response: err.response?.data,
    message: err.message,
  });
} finally {
      syncInProgress.current = false;
    }
  }, [isAuthenticated, stopAlarm, checkExactAlarmPermission]);

  useEffect(() => {
    const player = createAudioPlayer(
      require('../../assets/shift-reminder-alarm.wav')
    );
    player.loop = true;
    player.volume = 0.8;
    playerRef.current = player;

    const receivedListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        if (data?.kind !== REMINDER_KIND) return;

        const event = data.event === 'SHIFT_END' ? 'SHIFT_END' : 'SHIFT_START';
        void playAlarm(event, String(data.shiftName || 'Your shift'));
      }
    );

    const appStateListener = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          if (exactAlarmSettingsOpened.current) {
            exactAlarmSettingsOpened.current = false;
            exactAlarmPromptShown.current = false;
          }
          void syncReminders();
        }
      }
    );

    void syncReminders();
    const interval = setInterval(() => void syncReminders(), 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      receivedListener.remove();
      appStateListener.remove();

      try {
        player.pause();
        player.release();
      } catch {
        // Ignore audio cleanup errors.
      }

      playerRef.current = null;
    };
  }, [playAlarm, syncReminders]);

  return (
    <Modal statusBarTranslucent visible={activeAlarm !== null}
      transparent
      animationType="fade"
      onRequestClose={stopAlarm}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>YAAZH360 SHIFT REMINDER</Text>
          <Text style={styles.title}>
            {activeAlarm === 'SHIFT_END'
              ? 'Shift Ended'
              : 'Shift Starting Soon'}
          </Text>
          <Text style={styles.shift}>{shiftName}</Text>
          <Text style={styles.message}>
            {activeAlarm === 'SHIFT_END'
              ? 'Your scheduled shift has ended.'
              : 'Your shift starts in 5 minutes.'}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 26,
    alignItems: 'center',
  },
  eyebrow: {
    color: '#666666',
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 16,
    color: '#111827',
    fontSize: 25,
    fontFamily: 'Comfortaa_700Bold',
    textAlign: 'center',
  },
  shift: {
    marginTop: 10,
    color: '#EA580C',
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
  },
  message: {
    marginTop: 12,
    color: '#444444',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    marginTop: 26,
    backgroundColor: '#EA580C',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
  },
});

