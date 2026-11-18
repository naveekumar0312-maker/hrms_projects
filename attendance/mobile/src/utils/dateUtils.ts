export const formatAttendanceDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '--';
  const trimmed = dateString.trim();
  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const y = dateMatch[1];
    const m = parseInt(dateMatch[2], 10);
    const d = dateMatch[3];
    if (m >= 1 && m <= 12) {
      return `${d} ${months[m - 1]} ${y}`;
    }
  }

  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  };
  return date.toLocaleDateString('en-US', options);
};

export const formatAttendanceTime = (timeString: string | null | undefined): string => {
  if (!timeString) return '--';

  const trimmed = timeString.trim();
  if (trimmed === '' || trimmed === '--' || trimmed === '--:--' || trimmed === '-- : --') {
    return '--';
  }

  // 1. If already formatted with AM/PM (e.g. "10:56 AM" or "03:08 PM")
  if (/^[0-1]?\d:[0-5]\d(\s?[APap][Mm])$/.test(trimmed) || /(AM|PM)/i.test(trimmed)) {
    return trimmed;
  }

  // 2. Handle plain time string 'HH:MM' or 'HH:MM:SS' (e.g. "10:16:00" or "09:44")
  if (/^\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed)) {
    const parts = trimmed.split(':');
    let hour = parseInt(parts[0], 10);
    const minute = parts[1].padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour.toString().padStart(2, '0')}:${minute} ${ampm}`;
  }

  // 3. Match ISO or SQL datetime string:
  // e.g. '2026-11-18T09:44:14.110925+05:30', '2026-11-18 09:44:14', '2026-11-18T04:14:14.110Z'
  const match = trimmed.match(/[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:([+-]\d{2}:?\d{2})|Z)?/i);
  if (match) {
    let hour = parseInt(match[1], 10);
    let minute = parseInt(match[2], 10);
    const offset = match[4];
    const isZ = trimmed.toUpperCase().endsWith('Z') || (match[0].toUpperCase().endsWith('Z') && !offset);

    if (isZ || (offset && (offset.startsWith('+00') || offset.startsWith('-00')))) {
      // Pure UTC: add IST offset (+5 hours 30 minutes = +330 minutes)
      const totalMinutes = (hour * 60 + minute + 330) % 1440;
      hour = Math.floor(totalMinutes / 60);
      minute = totalMinutes % 60;
    } else if (offset) {
      // Has explicit timezone offset (e.g. +05:30, +08:00)
      const sign = offset[0] === '-' ? -1 : 1;
      const cleanOffset = offset.slice(1).replace(':', '');
      const offH = parseInt(cleanOffset.slice(0, 2), 10);
      const offM = parseInt(cleanOffset.slice(2, 4) || '0', 10);
      const offTotalMinutes = sign * (offH * 60 + offM);

      // Convert to UTC minutes, then add IST (+330 minutes)
      const utcMinutes = (hour * 60 + minute - offTotalMinutes + 1440 * 2) % 1440;
      const istMinutes = (utcMinutes + 330) % 1440;
      hour = Math.floor(istMinutes / 60);
      minute = istMinutes % 60;
    }
    // If no timezone offset (naive), Django stores and sends local time directly, so keep hour & minute as-is!

    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${ampm}`;
  }

  // 4. Fallback: Parse with Date but force IST timezone
  try {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  } catch {
    // fallback
  }

  return trimmed;
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
