import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api } from '../context/AuthContext';

export const LOCATION_TRACKING_TASK = 'attendance-background-location-task';

TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[LOCATION TRACKING] Task error:', error.message);
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const latest = locations?.[locations.length - 1];

  if (!latest) return;

  try {
    await api.post('/tracking/update/', {
      latitude: Number(latest.coords.latitude.toFixed(6)),
      longitude: Number(latest.coords.longitude.toFixed(6)),
      accuracy_meters: latest.coords.accuracy ?? null,
    });
  } catch (requestError: any) {
    if (requestError?.response?.status === 401) {
      // User is logged out or token is invalid; unregister background tracking task
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
        }
      } catch (cleanupErr) {
        // Ignore unregister errors
      }
      return;
    }
    console.warn('[LOCATION TRACKING] Upload failed:', requestError?.response?.status ?? requestError?.message);
  }
});

export async function getLocationSharingStatus() {
  return (await api.get('/tracking/sharing/')).data;
}

export async function enableLocationSharing() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    throw new Error('Location permission is required to enable sharing.');
  }

  if (Constants.appOwnership === 'expo') {
    console.warn('[LOCATION TRACKING] Background tracking requires a development build.');
    return;
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    throw new Error('Allow background location access in device settings to enable sharing.');
  }

  await api.post('/tracking/sharing/', { enabled: true });

  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);

    if (!started) {
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000,
        distanceInterval: 50,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Attendance location sharing',
          notificationBody: 'Location sharing is enabled. You can turn it off in the Attendance app.',
          notificationColor: '#E56108',
        },
      });
    }

    return getLocationSharingStatus();
  } catch (error) {
    try {
      await api.post('/tracking/sharing/', { enabled: false });
    } catch {}
    throw error;
  }
}

export async function disableLocationSharing() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);

  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  }

  await api.post('/tracking/sharing/', { enabled: false });

  return getLocationSharingStatus();
}

