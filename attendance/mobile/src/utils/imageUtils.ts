export const resolveMediaUrl = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== 'string' || !url.trim()) return null;

  const rawUrl = url.trim();
  const apiBase = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.10:8000/api').replace(/\/api\/?$/, '');

  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    try {
      const parsed = new URL(rawUrl);
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '10.0.2.2'
      ) {
        return `${apiBase}${parsed.pathname}${parsed.search}`;
      }
      return rawUrl;
    } catch {
      return rawUrl;
    }
  }

  const cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return `${apiBase}${cleanPath}`;
};

