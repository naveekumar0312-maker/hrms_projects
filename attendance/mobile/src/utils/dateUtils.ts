export const formatAttendanceDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '--';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
};

export const formatAttendanceTime = (timeString: string | null | undefined): string => {
  if (!timeString) return '--';

  // Handle 'HH:MM' or 'HH:MM:SS' time string
  const trimmed = timeString.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const parts = trimmed.split(':');
    let hour = parseInt(parts[0], 10);
    const minute = parts[1].padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour.toString().padStart(2, '0')}:${minute} ${ampm}`;
  }

  // Handle ISO datetime string like '2026-11-05T06:13:50.953165+00:00'
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return '--';

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
