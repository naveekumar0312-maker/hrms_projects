/**
 * Utility to share attendance PDF reports to employee WhatsApp.
 */

export interface ShareReportOptions {
  employeeName: string;
  employeeId: string;
  phoneNumber?: string | null;
  monthName: string;
  year: number | string;
  pdfUrl: string;
  summary?: any;
}

export const formatWhatsAppReportMessage = (options: ShareReportOptions): string => {
  const { employeeName, employeeId, monthName, year, pdfUrl, summary } = options;

  const present = summary?.present ?? 0;
  const absent = summary?.absent ?? 0;
  const lateDays = summary?.late_days ?? 0;
  const holidays = summary?.holidays ?? 0;
  const totalMins = summary?.total_working_minutes ?? 0;
  const workHrsStr = totalMins ? `${Math.floor(totalMins / 60)}h ${String(totalMins % 60).padStart(2, '0')}m` : '0h 00m';

  const monthYearHeader = `${String(monthName).toUpperCase()} ${year}`;

  return `*OFFICIAL ATTENDANCE RECORD - ${monthYearHeader}*
========================================
Employee : ${employeeName}
Staff ID : ${employeeId}

ATTENDANCE METRICS
------------------
Present Days       : ${present}
Absent Days        : ${absent}
Late Days          : ${lateDays}
Company Holidays   : ${holidays}
Total Working Time : ${workHrsStr}

DOCUMENT LINK
-------------
Please download your full PDF report below:
${pdfUrl}

Yaazh 360 HRMS - Human Resources Department`;
};

export const shareAttendanceReportWhatsApp = (options: ShareReportOptions) => {
  const { phoneNumber } = options;
  const text = encodeURIComponent(formatWhatsAppReportMessage(options));

  // Clean phone number (strip spaces, symbols, ensure 91 prefix for Indian 10-digit numbers)
  let cleanPhone = (phoneNumber || '').replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${text}`
    : `https://wa.me/?text=${text}`;

  window.open(url, '_blank', 'noopener,noreferrer');
};
