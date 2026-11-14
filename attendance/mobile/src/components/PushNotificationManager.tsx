import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { api } from '../context/AuthContext';

// Configure foreground notification behavior: show banner, list, play sound
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const NOTIFICATION_CHANNEL_ID = 'hrms-notifications-v1';
const LAST_SEEN_NOTIFICATION_ID_KEY = 'hrms_last_seen_notification_id';

interface PushNotificationManagerProps {
  isAuthenticated: boolean;
  onNotificationReceived?: () => void;
}

export default function PushNotificationManager({
  isAuthenticated,
  onNotificationReceived,
}: PushNotificationManagerProps) {
  const registeredTokenRef = useRef<string | null>(null);
  const lastNotifiedIdRef = useRef<number>(0);
  const isPollingRef = useRef<boolean>(false);

  // 1. Setup high importance notification channel on Android (sound, vibration, banner)
  useEffect(() => {
    async function setupNotificationChannel() {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
            name: 'HRMS Notifications',
            description: 'Leave, permission, location, and approval notifications',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#003882',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: 'default',
          });
        } catch (e) {
          console.warn('[PushNotificationManager] Channel creation error:', e);
        }
      }
    }
    void setupNotificationChannel();
  }, []);

  // 2. Register for push notifications when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      registeredTokenRef.current = null;
      return;
    }

    let isCancelled = false;

    async function registerForPush() {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('[PushNotificationManager] Notification permission not granted');
          return;
        }

        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId ??
          '74248a75-9ef3-4b37-8dc6-8e52bec78aa0';

        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        const token = tokenResponse?.data;
        if (!token || isCancelled) return;

        if (registeredTokenRef.current === token) return;

        await api.post('/notifications/push-token/', { token });
        registeredTokenRef.current = token;
        console.log('[PushNotificationManager] Push token registered successfully:', token);
      } catch (err: any) {
        console.warn('[PushNotificationManager] Registration error:', err?.message || err);
      }
    }

    void registerForPush();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  // 3. Fallback Smart Polling + Local System Notification Trigger:
  // Even if FCM is blocked or running in preview without credentials, this checks for new unread notifications
  // and fires a real Native System Notification (tray / lock screen popup with sound & vibration)
  const pollAndTriggerSystemNotification = useCallback(async () => {
    if (!isAuthenticated || isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      // Initialize lastNotifiedId from SecureStore on first run
      if (lastNotifiedIdRef.current === 0) {
        const stored = await SecureStore.getItemAsync(LAST_SEEN_NOTIFICATION_ID_KEY);
        if (stored) {
          lastNotifiedIdRef.current = parseInt(stored, 10) || 0;
        }
      }

      const res = await api.get('/notifications/?limit=10');
      const results: any[] = res.data?.results || [];

      if (results.length > 0) {
        const newest = results[0];
        const newestId = Number(newest.id);

        if (lastNotifiedIdRef.current === 0) {
          // Initial mount: mark current newest as seen so we don't spam old notifications
          lastNotifiedIdRef.current = newestId;
          await SecureStore.setItemAsync(LAST_SEEN_NOTIFICATION_ID_KEY, String(newestId));
        } else if (newestId > lastNotifiedIdRef.current) {
          // Brand new notification arrived! Find all new ones
          const newNotifications = results.filter((n) => Number(n.id) > lastNotifiedIdRef.current && !n.is_read);

          for (const item of newNotifications.reverse()) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: item.title || 'HRMS Notification',
                body: item.message || 'You have a new update.',
                data: {
                  url: '/',
                  event: item.event,
                  notificationId: item.id,
                },
                sound: 'default',
              },
              trigger: null, // trigger immediately!
            });
          }

          lastNotifiedIdRef.current = newestId;
          await SecureStore.setItemAsync(LAST_SEEN_NOTIFICATION_ID_KEY, String(newestId));
          onNotificationReceived?.();
        }
      }
    } catch (err) {
      // silent network catch
    } finally {
      isPollingRef.current = false;
    }
  }, [isAuthenticated, onNotificationReceived]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Run once on login
    void pollAndTriggerSystemNotification();

    // Check periodically every 6 seconds while app is running
    const interval = setInterval(() => {
      void pollAndTriggerSystemNotification();
    }, 6000);

    return () => clearInterval(interval);
  }, [isAuthenticated, pollAndTriggerSystemNotification]);

  // 4. Listen for system notification interactions
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[PushNotificationManager] Notification received:', notification.request.content.title);
      onNotificationReceived?.();
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[PushNotificationManager] Notification clicked:', response.notification.request.content.data);
      onNotificationReceived?.();
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [onNotificationReceived]);

  return null;
}
