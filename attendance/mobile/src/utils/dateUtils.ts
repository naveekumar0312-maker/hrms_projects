export const formatAttendanceDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '--';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
};

export const formatAttendanceTime = (timeString: string | null | undefined): string => {
  if (!timeString) return '--';

  const trimmed = timeString.trim();

  // If already formatted with AM/PM (e.g. "10:56 AM" or "03:08 PM")
  if (/^[0-1]?\d:[0-5]\d(\s?[APap][Mm])$/.test(trimmed) || /(AM|PM)/i.test(trimmed)) {
    return trimmed;
  }

  // Handle 'HH:MM' or 'HH:MM:SS' time string (e.g. "10:16:00" or "10:16")
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const parts = trimmed.split(':');
    let hour = parseInt(parts[0], 10);
    const minute = parts[1].padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour.toString().padStart(2, '0')}:${minute} ${ampm}`;
  }

  // Handle ISO datetime string like '2026-11-17T10:16:00+05:30' (Local ISO with offset)
  // Extract the local time directly from the string so Hermes on Android does not convert it back to UTC
  const localIsoMatch = trimmed.match(/T(\d{2}):(\d{2})(?::\d{2})?(?:[+-]\d{2}:?\d{2})/);
  if (localIsoMatch) {
    let hour = parseInt(localIsoMatch[1], 10);
    const minute = localIsoMatch[2];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour.toString().padStart(2, '0')}:${minute} ${ampm}`;
  }

  // Handle UTC ISO string ending with 'Z' (e.g. '2026-11-17T04:46:00Z' or '+00:00') -> convert to IST (+5:30)
  const utcIsoMatch = trimmed.match(/T(\d{2}):(\d{2})(?::\d{2})?(?:Z|\+00:?00)/i);
  if (utcIsoMatch) {
    let utcHour = parseInt(utcIsoMatch[1], 10);
    let utcMinute = parseInt(utcIsoMatch[2], 10);
    // Add 5 hours 30 mins
    let totalMinutes = (utcHour * 60 + utcMinute + 330) % 1440;
    let istHour = Math.floor(totalMinutes / 60);
    let istMinute = totalMinutes % 60;
    const ampm = istHour >= 12 ? 'PM' : 'AM';
    istHour = istHour % 12 || 12;
    return `${istHour.toString().padStart(2, '0')}:${istMinute.toString().padStart(2, '0')} ${ampm}`;
  }

  // Fallback to standard Date parsing
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return trimmed;

  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  return date.toLocaleTimeString('en-US', options);
};

export const formatWorkingHours = (hoursString: string | null | undefined): string => {
  if (!hoursString) return '--';
  // If it's already HH:MM
  const parts = hoursString.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return `${h}h ${m}m`;
    }
  }
  return hoursString;
};
export const formatMinutes = (totalMinutes: number | string | null | undefined): string => {
  if (totalMinutes === null || totalMinutes === undefined) return '--';
  const mins = typeof totalMinutes === 'string' ? parseInt(totalMinutes, 10) : totalMinutes;
  if (isNaN(mins)) return '--';
  
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};
