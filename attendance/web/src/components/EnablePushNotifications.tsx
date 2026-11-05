import { Bell, Megaphone , CheckCircle2} from "lucide-react";
import { useState } from 'react';
import { getToken, onMessage, deleteToken } from 'firebase/messaging';
import { getFirebaseMessaging } from '../services/firebase';
import api from '../services/api';

export default function EnablePushNotifications({ triggerMode = 'bell' }: { triggerMode?: 'bell' | 'announcement' }) {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [choiceOpen, setChoiceOpen] = useState(false);

  const enableNotifications = async (action: 'enable' | 'disable' = enabled ? 'disable' : 'enable') => {
    setLoading(true);
    setMessage('');

    try {
      if (action === 'disable') {
        const messaging = await getFirebaseMessaging();

        if (!messaging) {
          throw new Error('Push notifications are not supported in this browser.');
        }

        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });

        if (token) {
          await api.delete('/notifications/push-token/', {
            data: { token },
          });
        }

        await deleteToken(messaging);
        setEnabled(false);
        setMessage('Push Notifications Disabled');
        return;
      }
      if (!('Notification' in window)) {
        throw new Error('This browser does not support notifications.');
      }

      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers are not supported by this browser.');
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

      if (!vapidKey || vapidKey === 'REPLACE_WITH_VAPID_PUBLIC_KEY') {
        throw new Error('Firebase VAPID public key is not configured.');
      }

      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        console.info(
          'Push notifications were not enabled. The app will continue normally.'
        );
        setEnabled(false);
        setMessage('');
        return;
      }

      const registration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js'
      );

      await navigator.serviceWorker.ready;

      const messaging = await getFirebaseMessaging();

      if (!messaging) {
        throw new Error('Firebase messaging is not supported in this browser.');
      }

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        throw new Error('FCM token was not generated. Please try again.');
      }

      await api.post('/notifications/push-token/', { token });

      if (!sessionStorage.getItem('fcm_foreground_listener')) {
        onMessage(messaging, (payload) => {
          // ShiftAlarm handles SHIFT_START in the employee layout.
          // Avoid showing a duplicate generic browser notification.
          if (
            payload.data?.event === 'SHIFT_START' ||
            payload.data?.event === 'SHIFT_END'
          ) return;

          const title = payload.notification?.title || 'Attendance Notification';
          const body = payload.notification?.body || 'You have a new notification.';

          if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.svg' });
          }
        });

        sessionStorage.setItem('fcm_foreground_listener', '1');
      }

      setEnabled(true);
      setMessage('Push Notifications Enabled');
    } catch (error: any) {
      console.error('Enable push notifications error:', error?.response?.data || error);

      setMessage(
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error?.message ||
        'Unable to enable push notifications.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="push-notifications-container">
      <button
        type="button"
        onClick={() => triggerMode === 'announcement' ? setChoiceOpen(true) : void enableNotifications()}
        disabled={loading}
        className="enable-push-button"
        aria-label="Enable push notifications"
        title={enabled ? "Disable push notifications" : "Enable push notifications"}
        style={{
          background: '#e56108',
          color: '#fff',
          border: 0,
          borderRadius: 8,
          padding: '10px 14px',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        <span className="push-button-desktop">
          {loading ? 'Please wait...' : enabled ? 'Disable Push Notifications' : 'Enable Push Notifications'}
        </span>
        <span className="push-button-mobile" aria-hidden="true">
          {loading ? '...' : triggerMode === 'announcement' ? <Megaphone size={20} strokeWidth={2} /> : <Bell size={20} strokeWidth={2} />}
        </span>
      </button>

      {choiceOpen && (
        <div className="push-status-overlay">
          <div className="push-status-modal" role="dialog" aria-modal="true" aria-labelledby="push-choice-title">
            <div className="push-status-icon"><Megaphone size={30} /></div>
            <h2 id="push-choice-title">Push Notifications</h2>
            <p>Choose whether to enable or disable push notifications on this device.</p>
            <button
              type="button"
              className="push-status-ok"
              disabled={loading}
              onClick={() => {
                setChoiceOpen(false);
                void enableNotifications('enable');
              }}
            >
              Enable Push Notifications
            </button>
            <button
              type="button"
              className="push-choice-disable"
              disabled={loading}
              onClick={() => {
                setChoiceOpen(false);
                void enableNotifications('disable');
              }}
            >
              Disable Notifications
            </button>
            <button
              type="button"
              className="push-choice-cancel"
              onClick={() => setChoiceOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <div className="push-status-overlay" role="presentation">
          <div
            className="push-status-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="push-status-title"
          >
            <div className="push-status-icon" aria-hidden="true">
              {message.toLowerCase().includes('enabled') ? <CheckCircle2 size={30} strokeWidth={2.5} color="#16a34a" /> : 'i'}
            </div>
            <h2 id="push-status-title">
              {message}
            </h2>
            <p>
              {message.toLowerCase().includes('enabled')
                ? 'Push notifications are now enabled on this device.'
                : message.toLowerCase().includes('disabled')
                  ? 'Push notifications have been disabled for this app.'
                  : message}
            </p>
            <button
              type="button"
              className="push-status-ok"
              onClick={() => setMessage('')}
              autoFocus
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



