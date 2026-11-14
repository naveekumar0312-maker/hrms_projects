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

    return new Promise((resolve, reject) => {
      setLoading(true);
      setError('');
      
      if (!navigator.geolocation) {
        setLoading(false);
        const err = 'Geolocation is not supported by your browser.';
        setError(err);
        if (cachedLocationData) {
          resolve(cachedLocationData);
          return;
        }
        reject(new Error(err));
        return;
      }

      const finishSuccess = (position: GeolocationPosition) => {
        const loc: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        cachedLocationData = loc;
        lastLocationTime = Date.now();
        setLocation(loc);
        setLoading(false);
        resolve(loc);
      };

      const requestPosition = (
        highAccuracy: boolean,
        timeoutMs: number,
        maxAgeMs: number,
        onFail: (err: GeolocationPositionError) => void
      ) => {
        navigator.geolocation.getCurrentPosition(
          finishSuccess,
          onFail,
          {
            enableHighAccuracy: highAccuracy,
            timeout: timeoutMs,
            maximumAge: maxAgeMs,
          }
        );
      };

      // Step 1: Try high accuracy with cached position accepted (up to 2 minutes)
      requestPosition(true, 7000, 120000, (err) => {
        console.warn('[useLocation] High accuracy attempt failed, falling back to network/cell location:', err);

        // Step 2: Try standard accuracy (WiFi/Cellular) with longer timeout
        requestPosition(false, 10000, 300000, (fallbackErr) => {
          console.warn('[useLocation] Standard accuracy attempt failed:', fallbackErr);

          // If we have ANY cached location from this session, fallback to it
          if (cachedLocationData) {
            setLoading(false);
            resolve(cachedLocationData);
            return;
          }

          setLoading(false);
          let errMsg = 'Unable to retrieve location.';
          if (fallbackErr.code === 1) errMsg = 'Location permission denied. Please allow location access in your browser settings.';
          else if (fallbackErr.code === 2) errMsg = 'Location unavailable. Please ensure GPS is turned on.';
          else if (fallbackErr.code === 3) errMsg = 'Location request timed out. Please ensure GPS is active and try again.';
          setError(errMsg);
          reject(new Error(errMsg));
        });
      });
    });
  }, []);

  return { location, error, loading, getLocation };
};

