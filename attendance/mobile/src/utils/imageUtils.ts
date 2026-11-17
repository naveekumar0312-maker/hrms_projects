export const resolveMediaUrl = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== 'string' || !url.trim()) return null;

  const rawUrl = url.trim();

  // Return local device file, content, data, or blob URIs as-is
  if (
    rawUrl.startsWith('file://') ||
    rawUrl.startsWith('content://') ||
    rawUrl.startsWith('data:') ||
    rawUrl.startsWith('blob:')
  ) {
    return rawUrl;
  }

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
        // Enforce HTTPS if scheme was http on production domain
        if (parsed.protocol === 'http:' && parsed.hostname.includes('yaazh360digitech.in')) {
          parsed.protocol = 'https:';
        }
        fullUrl = parsed.toString();
      }
    } catch {
      fullUrl = rawUrl.replace(/^http:\/\//i, 'https://');
    }
  } else {
    let cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    // If relative path is e.g. /profile_photos/... or /task_attachments/... prepend /media
    if (!cleanPath.startsWith('/media/') && !cleanPath.startsWith('/static/')) {
      cleanPath = `/media${cleanPath}`;
    }
    fullUrl = `${apiBase}${cleanPath}`;
  }

  // Ensure URI spaces and special characters are properly encoded for React Native Image component
  try {
    return encodeURI(decodeURI(fullUrl));
  } catch {
    return fullUrl;
  }
};
