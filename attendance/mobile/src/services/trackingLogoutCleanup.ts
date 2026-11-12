import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const TASK_NAME = 'attendance-background-location-task';
const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://hrms.yaazh360digitech.in/api';

export async function stopTrackingForLogout() {
  let cleanupError: unknown = null;

  // Expo Go on Android does not support background location.
  // Skip native background-task checks in Expo Go.
  if (Constants.appOwnership !== 'expo') {
    try {
      const started =
        await Location.hasStartedLocationUpdatesAsync(TASK_NAME);

      if (started) {
        await Location.stopLocationUpdatesAsync(TASK_NAME);
      }
    } catch (error) {
      cleanupError = error;
    }
  }

  // Disable server-side location sharing before logout.
  try {
    const token = await SecureStore.getItemAsync('access_token');

    if (token) {
      await axios.post(
        `${API_URL}/tracking/sharing/`,
        { enabled: false },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
    }
  } catch (error) {
    cleanupError ??= error;
  }

  if (cleanupError) {
    console.warn(
      '[LOCATION TRACKING] Logout cleanup incomplete.',
    );
  }
}



