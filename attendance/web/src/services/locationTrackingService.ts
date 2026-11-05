import api from '../api';

export interface LocationSharingStatus {
  is_enabled: boolean;
  enabled_at: string | null;
  disabled_at: string | null;
}

/**
 * Calculate the great circle distance between two points on the earth in meters (Haversine formula).
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of the earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fetch current location sharing status from GET /tracking/sharing/
 */
export async function getLocationSharingStatus(): Promise<LocationSharingStatus> {
  const res = await api.get('/tracking/sharing/');
  return res.data;
}

/**
 * Enable or disable location sharing via POST /tracking/sharing/
 */
export async function setLocationSharing(enabled: boolean): Promise<LocationSharingStatus> {
  const res = await api.post('/tracking/sharing/', { enabled });
  return res.data;
}

/**
 * Upload employee location coordinates via POST /tracking/update/
 * Rounds lat/lon to 6 decimal places, and provides accuracy_meters.
 */
export async function uploadLocationUpdate(
  latitude: number,
  longitude: number,
  accuracy?: number | null
): Promise<any> {
  const res = await api.post('/tracking/update/', {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    accuracy_meters: accuracy != null && !isNaN(accuracy) ? Math.round(accuracy) : null,
  });
  return res.data;
}

/**
 * Helper to request browser's current position as a Promise.
 */
export function getCurrentPositionPromise(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => {
        let msg = 'Unable to retrieve location.';
        if (err.code === 1) msg = 'Location permission denied by browser. Please allow location access in your browser settings.';
        else if (err.code === 2) msg = 'Location information is unavailable.';
        else if (err.code === 3) msg = 'Location request timed out.';
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

