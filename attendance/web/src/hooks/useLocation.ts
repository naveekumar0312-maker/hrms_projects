import { useState, useCallback } from 'react';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

let cachedLocationData: LocationData | null = null;
let lastLocationTime: number = 0;

export const useLocation = () => {
  const [location, setLocation] = useState<LocationData | null>(cachedLocationData);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const getLocation = useCallback(async (): Promise<LocationData> => {
    // If we have a fairly recent valid location (< 3 minutes old), use it immediately
    if (cachedLocationData && (Date.now() - lastLocationTime < 180000)) {
      return cachedLocationData;
    }

    return new Promise(async (resolve, reject) => {
      setLoading(true);
      setError('');

      if (!navigator.geolocation) {
        setLoading(false);
        const err = 'Geolocation is not supported by your browser.';
        setError(err);
        if (cachedLocationData) {
          resolve(cachedLocationData);
        } else {
          reject(new Error(err));
        }
        return;
      }

      let resolved = false;

      const finishSuccess = (loc: LocationData) => {
        if (resolved) return;
        resolved = true;
        cachedLocationData = loc;
        lastLocationTime = Date.now();
        setLocation(loc);
        setLoading(false);
        resolve(loc);
      };

      const finishError = (errMsg: string) => {
        if (resolved) return;
        resolved = true;
        setLoading(false);
        setError(errMsg);
        if (cachedLocationData) {
          resolve(cachedLocationData);
        } else {
          reject(new Error(errMsg));
        }
      };

      // 1. First attempt: High Accuracy GPS (e.g. mobile GPS chip) with a 6-second timeout
      navigator.geolocation.getCurrentPosition(
        (position) => {
          finishSuccess({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (highAccErr) => {
          console.warn('[useLocation] High accuracy attempt failed, trying normal accuracy:', highAccErr.message);

          if (highAccErr.code === 1) {
            // Permission Denied
            finishError('Location permission was denied. Please allow location access in your browser settings.');
            return;
          }

          // 2. Second attempt: Normal accuracy with recent cache
          navigator.geolocation.getCurrentPosition(
            (position) => {
              finishSuccess({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
              });
            },
            (err) => {
              console.warn('[useLocation] Normal accuracy attempt failed:', err.message);
              let msg = 'Unable to retrieve your location. Please check your GPS and permissions.';
              if (err.code === 1) msg = 'Location permission was denied.';
              else if (err.code === 2) msg = 'Location position unavailable. Please ensure GPS/Location is turned on.';
              else if (err.code === 3) msg = 'Location request timed out. Please try again.';
              finishError(msg);
            },
            {
              enableHighAccuracy: false,
              timeout: 6000,
              maximumAge: 120000,
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 30000,
        }
      );
    });
  }, []);

  return { location, error, loading, getLocation };
};


