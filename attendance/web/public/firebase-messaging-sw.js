importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDXMhItJeW_4m2YHwovR40_7cd05d354rc',
  authDomain: 'attendance-management-6a7a6.firebaseapp.com',
  projectId: 'attendance-management-6a7a6',
  storageBucket: 'attendance-management-6a7a6.firebasestorage.app',
  messagingSenderId: '408047924981',
  appId: '1:408047924981:web:9feb25ea1cd00b9bedf7bc'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Attendance Notification';
  const options = {
    body: payload.notification?.body || 'You have a new notification.',
    icon: '/favicon.svg',
    data: payload.data || {}
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
