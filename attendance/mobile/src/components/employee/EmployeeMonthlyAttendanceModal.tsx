import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {
  CalendarDays,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Coffee,
  CalendarOff,
} from 'lucide-react-native';
import { api } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface EmployeeMonthlyAttendanceModalProps {
  visible: boolean;
  employee: any | null;
  onClose: () => void;
}

interface AttendanceDay {
  date: string;
  day?: number;
  weekday?: string;
  status?: string;
  attendance_id?: number | null;
  check_in?: string | null;
  check_out?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  late_minutes?: number | null;
  early_minutes?: number | null;
  overtime_minutes?: number | null;
  working_minutes?: number | null;
  shift_name?: string | null;
  leave_type?: string | null;
  holiday_name?: string | null;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const EmployeeMonthlyAttendanceModal = ({
  visible,
  employee,
  onClose,
}: EmployeeMonthlyAttendanceModalProps) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<any>({});
  const [days, setDays] = useState<AttendanceDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<AttendanceDay | null>(null);

  useEffect(() => {
    if (!visible || !employee?.id) return;

    const fetchMonthly = async () => {
      try {
        setLoading(true);
        setError('');
        setSelectedDay(null);

        const response = await api.get(
          `/employees/${employee.id}/monthly-attendance/?month=${currentMonth + 1}&year=${currentYear}`
        );

        setSummary(response.data?.summary || {});
        setDays(Array.isArray(response.data?.days) ? response.data.days : []);
      } catch (err: any) {
        console.warn('Failed to fetch monthly attendance:', err?.message);
        setError(err?.response?.data?.detail || 'Unable to load monthly attendance.');
        setSummary({});
        setDays([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMonthly();
  }, [visible, employee?.id, currentMonth, currentYear]);

  const changeMonth = (delta: number) => {
    let nextMonth = currentMonth + delta;
    let nextYear = currentYear;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setCurrentMonth(nextMonth);
    setCurrentYear(nextYear);
  };

  const getStatusColor = (status?: string) => {
    const val = String(status || '').toUpperCase();
    switch (val) {
      case 'PRESENT':
      case 'COMPLETED':
      case 'ON_TIME':
        return { color: '#16A34A', bg: '#DCFCE7', label: 'Present' };
      case 'WORKING':
        return { color: '#2563EB', bg: '#DBEAFE', label: 'Working' };
      case 'ABSENT':
        return { color: '#DC2626', bg: '#FEE2E2', label: 'Absent' };
      case 'LATE':
        return { color: '#D97706', bg: '#FEF3C7', label: 'Late' };
      case 'CASUAL_LEAVE':
      case 'CASUAL LEAVE':
        return { color: '#B45309', bg: '#FEF3C7', label: 'Casual Leave' };
      case 'SICK_LEAVE':
      case 'SICK LEAVE':
        return { color: '#7C3AED', bg: '#EDE9FE', label: 'Sick Leave' };
      case 'PERSONAL_LEAVE':
      case 'PERSONAL LEAVE':
        return { color: '#4F46E5', bg: '#EEF2FF', label: 'Personal Leave' };
      case 'OTHER_LEAVE':
      case 'OTHER LEAVE':
        return { color: '#0F766E', bg: '#CCFBF1', label: 'Other Leave' };
      case 'HOLIDAY':
        return { color: '#0E7490', bg: '#CFFAFE', label: 'Holiday' };
      case 'WEEKEND':
        return { color: '#475569', bg: '#F1F5F9', label: 'Weekend' };
      case 'UPCOMING':
        return { color: '#64748B', bg: '#F8FAFC', label: 'Upcoming' };
      default:
        return { color: '#475569', bg: '#F1F5F9', label: val.replace(/_/g, ' ') || '--' };
    }
  };

  // Build complete 7-column calendar matrix
  const calendarCells = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const cells: (AttendanceDay | null)[] = [];

    // Leading empty padding days
    for (let i = 0; i < firstDay; i++) {
      cells.push(null);
    }

    const dayMap = new Map<number, AttendanceDay>();
    days.forEach((d) => {
      const dayNum = Number(d.date?.split('-')[2]);
      if (dayNum) dayMap.set(dayNum, d);
    });

    // Actual month days
    for (let d = 1; d <= daysInMonth; d++) {
      const matched = dayMap.get(d) || {
        date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        status: 'UPCOMING',
      };
      cells.push(matched);
    }

    return cells;
  }, [currentYear, currentMonth, days]);

  const monthName = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const formatHours = (mins?: number | null) => {
    const total = Number(mins || 0);
    if (total <= 0) return '0m';
    const hrs = Math.floor(total / 60);
    const m = total % 60;
    return hrs > 0 ? `${hrs}h ${m}m` : `${m}m`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <CalendarDays size={20} color="#EA580C" />
              </View>
              <View>
                <Text style={styles.headerEmpName}>{employee?.full_name || 'Employee'}</Text>
                <Text style={styles.headerEmpSub}>
                  {employee?.employee_id || '--'} • Monthly Attendance
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#EA580C" />
              <Text style={styles.loadingText}>Loading calendar data...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <AlertCircle size={32} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.scrollContent}>
              {/* MONTHLY SUMMARY CARD (Exact Web Parity) */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Monthly Summary</Text>

                <View style={styles.summaryKpiRow}>
                  <View style={[styles.summaryKpiBox, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={styles.kpiLabel}>Present</Text>
                    <Text style={[styles.kpiValue, { color: '#16A34A' }]}>
                      {summary.present ?? 0}
                    </Text>
                  </View>
                  <View style={[styles.summaryKpiBox, { backgroundColor: '#FEF2F2' }]}>
                    <Text style={styles.kpiLabel}>Absent</Text>
                    <Text style={[styles.kpiValue, { color: '#DC2626' }]}>
                      {summary.absent ?? 0}
                    </Text>
                  </View>
                  <View style={[styles.summaryKpiBox, { backgroundColor: '#FFFBEB' }]}>
                    <Text style={styles.kpiLabel}>Late Days</Text>
                    <Text style={[styles.kpiValue, { color: '#D97706' }]}>
                      {summary.late_days ?? 0}
                    </Text>
                  </View>
                  <View style={[styles.summaryKpiBox, { backgroundColor: '#F0FDFA' }]}>
                    <Text style={styles.kpiLabel}>Holidays</Text>
                    <Text style={[styles.kpiValue, { color: '#0D9488' }]}>
                      {summary.holidays ?? 0}
                    </Text>
                  </View>
                </View>

                {/* Extended Details */}
                <View style={styles.summaryDetailsGrid}>
                  <View style={styles.summaryDetailRow}>
                    <Text style={styles.detailLabel}>Total Late:</Text>
                    <Text style={styles.detailValue}>{formatHours(summary.total_late_minutes)}</Text>
                  </View>
                  <View style={styles.summaryDetailRow}>
                    <Text style={styles.detailLabel}>Grace Used:</Text>
                    <Text style={styles.detailValue}>
                      {summary.grace_used_count ?? 0} / 3 times ({summary.grace_used_minutes ?? 0}m)
                    </Text>
                  </View>
                  <View style={styles.summaryDetailRow}>
                    <Text style={styles.detailLabel}>Permission Used:</Text>
                    <Text style={styles.detailValue}>
                      {formatHours(summary.monthly_permission_used_minutes)} / {formatHours(summary.monthly_permission_limit_minutes || 180)}
                    </Text>
                  </View>
                  <View style={styles.summaryDetailRow}>
                    <Text style={styles.detailLabel}>Overtime:</Text>
                    <Text style={styles.detailValue}>{formatHours(summary.total_overtime_minutes)}</Text>
                  </View>
                  <View style={styles.summaryDetailRow}>
                    <Text style={styles.detailLabel}>Working Time:</Text>
                    <Text style={[styles.detailValue, { color: '#16A34A', fontWeight: 'bold' }]}>
                      {formatHours(summary.total_working_minutes)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* CALENDAR NAVIGATION */}
              <View style={styles.calendarCard}>
                <View style={styles.calendarNavRow}>
                  <Text style={styles.calendarMonthTitle}>{monthName}</Text>
                  <View style={styles.calendarNavButtons}>
                    <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)}>
                      <ChevronLeft size={18} color="#0F172A" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)}>
                      <ChevronRight size={18} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Weekday Row */}
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((w) => (
                    <Text key={w} style={styles.weekdayText}>
                      {w}
                    </Text>
                  ))}
                </View>

                {/* Calendar Grid */}
                <View style={styles.calendarGrid}>
                  {calendarCells.map((cell, idx) => {
                    if (!cell) {
                      return <View key={`empty-${idx}`} style={styles.calendarCellEmpty} />;
                    }

                    const dayNum = Number(cell.date.split('-')[2]);
                    const statusInfo = getStatusColor(cell.status);
                    const isSelected = selectedDay?.date === cell.date;

                    return (
                      <TouchableOpacity
                        key={cell.date || idx}
                        style={[
                          styles.calendarCell,
                          { backgroundColor: statusInfo.bg },
                          isSelected && styles.calendarCellSelected,
                        ]}
                        onPress={() => setSelectedDay(cell)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.cellDayNum,
                            { color: isSelected ? '#1D4ED8' : '#0F172A' },
                          ]}
                        >
                          {dayNum}
                        </Text>
                        <Text
                          style={[styles.cellStatusText, { color: statusInfo.color }]}
                          numberOfLines={1}
                        >
                          {statusInfo.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Status Color Legend */}
                <View style={styles.legendWrap}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
                    <Text style={styles.legendLabel}>Present</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                    <Text style={styles.legendLabel}>Absent</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
                    <Text style={styles.legendLabel}>Working</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#B45309' }]} />
                    <Text style={styles.legendLabel}>Leave</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#0D9488' }]} />
                    <Text style={styles.legendLabel}>Holiday</Text>
                  </View>
                </View>
              </View>

              {/* SELECTED DAY DETAILS CARD */}
              {selectedDay && (
                <View style={styles.selectedDayCard}>
                  <Text style={styles.selectedDayTitle}>
                    {new Date(selectedDay.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>

                  <View style={styles.dayDetailsGrid}>
                    <View style={styles.dayDetailItem}>
                      <Text style={styles.dayItemLabel}>Status</Text>
                      <Text
                        style={[
                          styles.dayItemVal,
                          { color: getStatusColor(selectedDay.status).color, fontWeight: 'bold' },
                        ]}
                      >
                        {getStatusColor(selectedDay.status).label}
                      </Text>
                    </View>
                    <View style={styles.dayDetailItem}>
                      <Text style={styles.dayItemLabel}>Check In</Text>
                      <Text style={styles.dayItemVal}>
                        {selectedDay.check_in_time
                          ? new Date(selectedDay.check_in_time).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : '--'}
                      </Text>
                    </View>
                    <View style={styles.dayDetailItem}>
                      <Text style={styles.dayItemLabel}>Check Out</Text>
                      <Text style={styles.dayItemVal}>
                        {selectedDay.check_out_time
                          ? new Date(selectedDay.check_out_time).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : '--'}
                      </Text>
                    </View>
                    <View style={styles.dayDetailItem}>
                      <Text style={styles.dayItemLabel}>Shift</Text>
                      <Text style={styles.dayItemVal}>{selectedDay.shift_name || 'General'}</Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEmpName: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  headerEmpSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  centerLoading: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  errorBox: {
    padding: 30,
    alignItems: 'center',
  },
  errorText: {
    marginTop: 8,
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  modalScroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
    marginBottom: 10,
  },
  summaryKpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  summaryKpiBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'Comfortaa_500Medium',
  },
  kpiValue: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    marginTop: 2,
  },
  summaryDetailsGrid: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    gap: 6,
  },
  summaryDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#0F172A',
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  calendarNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarMonthTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  calendarNavButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  weekdayText: {
    width: (SCREEN_WIDTH - 64) / 7,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#94A3B8',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  calendarCellEmpty: {
    width: (SCREEN_WIDTH - 64 - 24) / 7,
    height: 52,
  },
  calendarCell: {
    width: (SCREEN_WIDTH - 64 - 24) / 7,
    height: 52,
    borderRadius: 8,
    padding: 3,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  calendarCellSelected: {
    borderColor: '#3B82F6',
    borderWidth: 1.5,
  },
  cellDayNum: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
  },
  cellStatusText: {
    fontSize: 8.5,
    fontFamily: 'Comfortaa_600SemiBold',
    textAlign: 'center',
  },
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  selectedDayCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  selectedDayTitle: {
    fontSize: 13.5,
    fontFamily: 'Comfortaa_700Bold',
    color: '#1E3A8A',
    marginBottom: 8,
  },
  dayDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayDetailItem: {
    flex: 1,
  },
  dayItemLabel: {
    fontSize: 10.5,
    color: '#64748B',
  },
  dayItemVal: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#0F172A',
    marginTop: 2,
  },
});

