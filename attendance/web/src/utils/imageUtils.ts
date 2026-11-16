/**
 * Resolves media URLs (e.g. employee profile photos, attendance check-in photos, company logos)
 * to work seamlessly on both local development and live production environments.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // If it points to localhost or 127.0.0.1 while we are on production or another host
    if (trimmed.includes('127.0.0.1') || trimmed.includes('localhost')) {
      try {
        const path = new URL(trimmed).pathname;
        return `${window.location.origin}${path}`;
      } catch {
        return trimmed;
      }
    }
    // Upgrade http to https in production
    if (trimmed.startsWith('http://hrms.yaazh360digitech.in')) {
      return trimmed.replace('http://', 'https://');
    }
    return trimmed;
  }

  // Relative path like /media/employees/profile/...
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${window.location.origin}${cleanPath}`;
}
