import { Linking, Alert } from 'react-native';

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

export const shareAttendanceReportWhatsApp = async (options: ShareReportOptions) => {
  const { phoneNumber } = options;
  const text = encodeURIComponent(formatWhatsAppReportMessage(options));

  let cleanPhone = (phoneNumber || '').replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const whatsappAppUrl = cleanPhone
    ? `whatsapp://send?phone=${cleanPhone}&text=${text}`
    : `whatsapp://send?text=${text}`;

  const webUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${text}`
    : `https://wa.me/?text=${text}`;

  try {
    const supported = await Linking.canOpenURL(whatsappAppUrl);
    if (supported) {
      await Linking.openURL(whatsappAppUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    console.warn('Could not open WhatsApp directly, trying web url:', error);
    try {
      await Linking.openURL(webUrl);
    } catch (err) {
      Alert.alert('Error', 'Unable to open WhatsApp.');
    }
  }
};
