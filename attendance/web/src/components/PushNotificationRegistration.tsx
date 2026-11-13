import { useContext, useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { getFirebaseMessaging } from '../services/firebase';


export default function PushNotificationRegistration() {
  const { isAuthenticated, isLoading } = useContext(AuthContext);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (!localStorage.getItem('access_token')) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    let unsubscribeMessage: (() => void) | undefined;

    const registerPush = async () => {
      try {
        const vapidKey =
          import.meta.env.VITE_FIREBASE_VAPID_KEY ||
          'BP9eG6WH11RWz1ff7GyniYgTqXZH7HQwA5PMDjIqIDT__KXts2GpF8AhT81xnHKW-mrR4qmmzhmU6R4NQ8rKioA';
        if (!vapidKey || vapidKey === 'REPLACE_WITH_VAPID_PUBLIC_KEY') {
          console.warn('[PushRegistration] VAPID key is not configured; push notifications skipped.');
          return;
        }

        const registration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js'
        );
        await navigator.serviceWorker.ready;

        const messaging = await getFirebaseMessaging();
        if (!messaging || cancelled) return;

        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });

        if (!token || cancelled) return;

        await api.post('/notifications/push-token/', { token });

        unsubscribeMessage = onMessage(messaging, (payload) => {
          if (cancelled) return;

          // The employee shift alarm already handles these events.
          if (
            payload.data?.event === 'SHIFT_START' ||
            payload.data?.event === 'SHIFT_END'
          ) return;

          const title =
            payload.notification?.title || 'Attendance Notification';
          const body =
            payload.notification?.body || 'You have a new notification.';

          if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.svg' });
          }
        });
      } catch (error) {
        console.error('[PushRegistration] Registration failed:', error);
      }
    };

    void registerPush();

    return () => {
      cancelled = true;
      unsubscribeMessage?.();
    };
  }, [isAuthenticated, isLoading]);

  return null;
}




