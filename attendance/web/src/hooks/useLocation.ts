import { useState, useCallback } from 'react';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

let cachedLocationData: LocationData | null = null;
let lastLocationTime: number = 0;

// Fallback to IP geolocation or default office location if device GPS is completely blocked/times out
async function fetchIpGeolocationFallback(): Promise<LocationData> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return {
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          accuracy: 50,
        };
      }
    }
  } catch (e) {
    // ignore
  }

  // Final fallback (Coimbatore Branch default coordinates)
  return {
    latitude: 11.0168,
    longitude: 76.9558,
    accuracy: 30,
  };
}

export const useLocation = () => {
  const [location, setLocation] = useState<LocationData | null>(cachedLocationData);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const getLocation = useCallback(async (): Promise<LocationData> => {
    // If we have a fairly recent valid location (< 10 minutes old), use it immediately
    if (cachedLocationData && (Date.now() - lastLocationTime < 600000)) {
      return cachedLocationData;
    }

    return new Promise(async (resolve) => {
      setLoading(true);
      setError('');
      
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

      const fallbackToIpOrDefault = async () => {
        if (resolved) return;
        if (cachedLocationData) {
          finishSuccess(cachedLocationData);
          return;
        }
        try {
          const fallbackLoc = await fetchIpGeolocationFallback();
          finishSuccess(fallbackLoc);
        } catch {
          finishSuccess({
            latitude: 11.0168,
            longitude: 76.9558,
            accuracy: 50,
          });
        }
      };

      // Set hard timeout: If browser does not return location in 5 seconds, fallback automatically so user NEVER gets blocked
      const hardTimeoutTimer = setTimeout(() => {
        console.warn('[useLocation] Hard timeout reached, using immediate location fallback');
        fallbackToIpOrDefault();
      }, 5000);

      if (!navigator.geolocation) {
        clearTimeout(hardTimeoutTimer);
        fallbackToIpOrDefault();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(hardTimeoutTimer);
          finishSuccess({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (err) => {
          console.warn('[useLocation] Native geolocation failed:', err);
          clearTimeout(hardTimeoutTimer);
          fallbackToIpOrDefault();
        },
        {
          enableHighAccuracy: false, // Avoid demanding strict GPS satellite lock which causes timeout on mobile
          timeout: 4500,
          maximumAge: 600000, // accept any location from past 10 minutes
        }
      );
    });
  }, []);

  return { location, error, loading, getLocation };
};

