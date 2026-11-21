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

  const present = summary?.present ?? '--';
  const absent = summary?.absent ?? '--';
  const lateDays = summary?.late_days ?? 0;
  const holidays = summary?.holidays ?? 0;
  const totalMins = summary?.total_working_minutes ?? 0;
  const workHrsStr = totalMins ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m` : '--';

  return `*ATTENDANCE REPORT - ${monthName} ${year}*
👤 Employee: ${employeeName} (${employeeId})

📊 *Monthly Highlights:*
✅ Present Days: ${present}
❌ Absent Days: ${absent}
⏰ Late Days: ${lateDays}
🏖️ Holidays: ${holidays}
⏳ Total Working Time: ${workHrsStr}

📄 *Download your full Official Attendance PDF Report here:*
${pdfUrl}

_Sent via Yaazh360 HRMS_`;
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
