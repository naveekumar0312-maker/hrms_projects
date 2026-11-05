export const formatAttendanceDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '--';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
};

export const formatAttendanceTime = (timeString: string | null | undefined): string => {
  if (!timeString) return '--';
  
  // Handle backend time which could be ISO string
  const date = new Date(timeString);
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
