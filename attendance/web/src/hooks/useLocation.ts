import { useState, useCallback } from 'react';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const useLocation = () => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const getLocation = useCallback(async (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      setLoading(true);
      setError('');
      
      if (!navigator.geolocation) {
        setLoading(false);
        const err = 'Geolocation is not supported by your browser.';
        setError(err);
        reject(new Error(err));
        return;
      }

      // Try High Accuracy first; if it times out (common on mobile browsers indoors), fallback to standard accuracy
      const requestPosition = (highAccuracy: boolean, timeoutMs: number, onFail: (err: GeolocationPositionError) => void) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const loc = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            };
            setLocation(loc);
            setLoading(false);
            resolve(loc);
          },
          onFail,
          {
            enableHighAccuracy: highAccuracy,
            timeout: timeoutMs,
            maximumAge: 30000, // accept cached position up to 30 seconds
          }
        );
      };

      requestPosition(true, 10000, (err) => {
        // If timed out or unavailable, try fallback with enableHighAccuracy: false and wider timeout
        if (err.code === 3 || err.code === 2) {
          console.warn('[useLocation] High accuracy failed/timed out, attempting standard accuracy fallback...');
          requestPosition(false, 15000, (fallbackErr) => {
            setLoading(false);
            let errMsg = 'Unable to retrieve location.';
            if (fallbackErr.code === 1) errMsg = 'Location permission denied. Please allow location access in your browser.';
            else if (fallbackErr.code === 2) errMsg = 'Location unavailable. Please make sure device location is enabled.';
            else if (fallbackErr.code === 3) errMsg = 'Location request timed out. Please check your GPS signal and try again.';
            setError(errMsg);
            reject(new Error(errMsg));
          });
        } else {
          setLoading(false);
          let errMsg = 'Unable to retrieve location.';
          if (err.code === 1) errMsg = 'Location permission denied. Please allow location access in your browser.';
          else if (err.code === 2) errMsg = 'Location unavailable. Please make sure device location is enabled.';
          else if (err.code === 3) errMsg = 'Location request timed out. Please check your GPS signal and try again.';
          setError(errMsg);
          reject(new Error(errMsg));
        }
      });
    });
  }, []);

  return { location, error, loading, getLocation };
};

