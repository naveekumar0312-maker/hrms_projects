export const formatTimeAMPM = (timeStr?: string | null) => {
  if (!timeStr) return '--';

  try {
    // ISO datetime from Django, e.g.
    // 2026-10-07T17:09:00Z
    // 2026-10-07T17:09:00+00:00
    if (
      timeStr.includes('T') ||
      timeStr.includes('Z') ||
      /[+-]\d{2}:\d{2}$/.test(timeStr)
    ) {
      const date = new Date(timeStr);

      if (Number.isNaN(date.getTime())) {
        return '--';
      }

      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    }

    // Plain time value: HH:mm or HH:mm:ss
    const parts = timeStr.split(':');

    if (parts.length < 2) {
      return '--';
    }

    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];

    if (Number.isNaN(hours)) {
      return '--';
    }

    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours || 12;

    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  } catch {
    return '--';
  }
};
