import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
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

interface PushNotificationManagerProps {
  isAuthenticated: boolean;
  onNotificationReceived?: () => void;
}

export default function PushNotificationManager({
  isAuthenticated,
  onNotificationReceived,
}: PushNotificationManagerProps) {
  const registeredTokenRef = useRef<string | null>(null);

  // 1. Setup high importance notification channel on Android
  useEffect(() => {
    async function setupNotificationChannel() {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
            name: 'HRMS Notifications',
            description: 'Leave, permission, and approval notifications',
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
        // Check existing permissions
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

        // Get projectId from Constants
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId ??
          '74248a75-9ef3-4b37-8dc6-8e52bec78aa0';

        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        const token = tokenResponse?.data;
        if (!token || isCancelled) return;

        // Prevent repeated registration of the same token in one session
        if (registeredTokenRef.current === token) return;

        // Register token with backend WebPushDevice endpoint
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

  // 3. Listen for incoming notifications when app is open / foreground
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

