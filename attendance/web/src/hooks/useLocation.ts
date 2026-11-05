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
        (err) => {
          setLoading(false);
          let errMsg = 'Unable to retrieve location.';
          if (err.code === 1) errMsg = 'Location permission denied.';
          if (err.code === 2) errMsg = 'Location unavailable.';
          if (err.code === 3) errMsg = 'Location request timed out.';
          setError(errMsg);
          reject(new Error(errMsg));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  return { location, error, loading, getLocation };
};

