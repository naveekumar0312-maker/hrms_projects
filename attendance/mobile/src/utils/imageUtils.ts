export const resolveMediaUrl = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== 'string' || !url.trim()) return null;

  const rawUrl = url.trim();
  const apiBase = (process.env.EXPO_PUBLIC_API_URL || 'https://hrms.yaazh360digitech.in/api').replace(/\/api\/?$/, '');

  let fullUrl = '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    try {
      const parsed = new URL(rawUrl);
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '10.0.2.2' ||
        parsed.hostname === 'testserver'
      ) {
        fullUrl = `${apiBase}${parsed.pathname}${parsed.search}`;
      } else {
        fullUrl = rawUrl;
      }
    } catch {
      fullUrl = rawUrl;
    }
  } else {
    const cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    fullUrl = `${apiBase}${cleanPath}`;
  }

  // Ensure URI spaces and special characters are properly encoded for React Native Image component
  try {
    return encodeURI(decodeURI(fullUrl));
  } catch {
    return fullUrl;
  }
};

