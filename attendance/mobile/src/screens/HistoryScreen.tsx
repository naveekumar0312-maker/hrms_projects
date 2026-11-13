import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { getReports } from '../services/attendanceService';
import { AuthContext } from '../context/AuthContext';
import { Calendar as CalendarIcon, ChevronDown, Check, Clock, X, Sparkles, ChevronRight, PartyPopper, Image as ImageIcon, Briefcase, FileText } from 'lucide-react-native';
import { formatAttendanceTime, formatWorkingHours } from '../utils/dateUtils';
import { resolveMediaUrl } from '../utils/imageUtils';
import { COLORS } from '../constants/theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function HistoryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { logout } = useContext(AuthContext);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(new Date().toLocaleDateString('en-CA'));

  // Calculate the 26th to 25th cycle date range
  const cycleInfo = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // 1-indexed

    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }

    const startDateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-26`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-25`;

    const cycleLabel = `26 ${MONTHS[prevMonth - 1].substring(0, 3)} - 25 ${MONTHS[month - 1].substring(0, 3)} ${year}`;

    return {
      year,
      month,
      prevYear,
      prevMonth,
      startDateStr,
      endDateStr,
      cycleLabel,
    };
  }, [currentDate]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch cycle attendance from 26th to 25th
      const data = await getReports(cycleInfo.month, cycleInfo.year, cycleInfo.startDateStr, cycleInfo.endDateStr);
      setReport(data);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        logout();
      } else {
        setError('Unable to load attendance. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [cycleInfo]);

  useFocusEffect(
    useCallback(() => {
      fetchReport();
    }, [cycleInfo])
  );

  // Generate continuous calendar days from 26th of previous month to 25th of current month
  const calendarDays = useMemo(() => {
    const source = report?.calendar || [];
    const existing = new Map<string, any>(source.map((item: any) => [item.date, item]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: any[] = [];
    const start = new Date(cycleInfo.prevYear, cycleInfo.prevMonth - 1, 26);
    start.setHours(0, 0, 0, 0);

    const end = new Date(cycleInfo.year, cycleInfo.month - 1, 25);
    end.setHours(0, 0, 0, 0);

    const curr = new Date(start);
    while (curr <= end) {
      const year = curr.getFullYear();
      const month = String(curr.getMonth() + 1).padStart(2, '0');
      const day = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      let record = existing.get(dateStr);
      let status = record?.status;

      if (!record) {
        if (curr.getDay() === 0) {
          status = 'WEEKEND';
        } else if (curr > today) {
          status = 'FUTURE';
        } else if (curr.getTime() === today.getTime()) {
          status = 'PENDING';
        } else {
          status = 'ABSENT';
        }
      } else {
        status = record.status;
      }

      days.push({
        dayNum: curr.getDate(),
        dayName: curr.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr,
        status,
        record,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return days;
  }, [cycleInfo, report]);

  // Filter history records for employee:
  // User asked: "present absent late venam holiday kattanum for employee"
  // So we show Holiday records + all relevant working/holiday schedule items
  const historyRecords = useMemo(() => {
    return calendarDays
      .filter((day: any) => day.status !== 'FUTURE')
      .map((day: any) => {
        if (day.record) {
          return day.record;
        }

        return {
          id: `cycle-${day.dateStr}`,
          date: day.dateStr,
          status: day.status,
          check_in_time: null,
          check_out_time: null,
          approval_status: null,
          rejection_reason: null,
          late_minutes: 0,
          early_minutes: 0,
          overtime_minutes: 0,
          working_hours: null,
          holiday_name: day.record?.holiday_name,
        };
      })
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [calendarDays]);

  const holidaysList = useMemo(() => {
    return calendarDays.filter((d: any) => d.status === 'HOLIDAY');
  }, [calendarDays]);

  const handleMonthSelect = (monthIdx: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(monthIdx);
    setCurrentDate(newDate);
    setShowMonthPicker(false);
  };

  const renderStatusDot = (status: string) => {
    if (status === 'HOLIDAY') return <View style={[styles.dot, { backgroundColor: COLORS.gold }]} />;
    if (status === 'WEEKLY_OFF' || status === 'WEEKEND') return <View style={[styles.dot, { backgroundColor: COLORS.primaryLight }]} />;
    if (['PRESENT', 'COMPLETED', 'ON_TIME', 'WORKING'].includes(status)) return <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />;
    if (status === 'LATE') return <View style={[styles.dot, { backgroundColor: COLORS.gold }]} />;
    if (status === 'WFH') return <View style={[styles.dot, { backgroundColor: '#7C3AED' }]} />;
    if (status === 'PERMISSION') return <View style={[styles.dot, { backgroundColor: '#0284C7' }]} />;
    if (status === 'ABSENT') return <View style={[styles.dot, { backgroundColor: '#8E9BAE' }]} />;
    if (status === 'ON_LEAVE' || status === 'HALF DAY' || status === 'HALF_DAY') return <View style={[styles.dot, { backgroundColor: COLORS.navy }]} />;
    return <View style={[styles.dot, { backgroundColor: '#E5E9F0' }]} />;
  };

  const getStatusBadge = (status: string, holidayName?: string) => {
    if (status === 'HOLIDAY') {
      return { bg: 'rgba(212, 160, 23, 0.14)', text: COLORS.goldDark, label: holidayName || 'Holiday' };
    }
    if (status === 'WEEKLY_OFF' || status === 'WEEKEND') {
      return { bg: 'rgba(0, 86, 179, 0.08)', text: COLORS.primary, label: 'Weekly Off' };
    }
    if (status === 'WFH') {
      return { bg: 'rgba(124, 58, 237, 0.12)', text: '#7C3AED', label: 'WFH' };
    }
    if (status === 'PERMISSION') {
      return { bg: 'rgba(2, 132, 199, 0.12)', text: '#0284C7', label: 'Permission' };
    }
    if (status === 'ON_LEAVE') {
      return { bg: 'rgba(6, 27, 58, 0.08)', text: COLORS.navy, label: 'On Leave' };
    }
    if (status === 'HALF_DAY' || status === 'HALF DAY') {
      return { bg: 'rgba(212, 160, 23, 0.12)', text: COLORS.goldDark, label: 'Half Day' };
    }
    if (['PRESENT', 'COMPLETED', 'ON_TIME', 'WORKING'].includes(status)) {
      return { bg: 'rgba(0, 86, 179, 0.08)', text: COLORS.primary, label: 'Present' };
    }
    if (status === 'LATE') {
      return { bg: 'rgba(212, 160, 23, 0.12)', text: COLORS.goldDark, label: 'Late' };
    }
    if (status === 'ABSENT') {
      return { bg: '#F0F4F8', text: '#5A6A80', label: 'Absent' };
    }
    return { bg: '#F8F9FC', text: COLORS.primary, label: status || 'Day Off' };
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar style="dark" hidden={false} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER SECTION - APPLE & YAAZH 360 LUXURY STYLE */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Attendance</Text>
              <Text style={styles.headerSubtitle}>Pay Cycle: {cycleInfo.cycleLabel}</Text>
            </View>
            <TouchableOpacity style={styles.monthSelectorBtn} onPress={() => setShowMonthPicker(true)} activeOpacity={0.8}>
              <Text style={styles.monthSelectorText}>{MONTHS[currentDate.getMonth()].substring(0, 3)} {currentDate.getFullYear()}</Text>
              <ChevronDown size={14} color={COLORS.navy} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* CALENDAR STRIP (26th to 25th) */}
        <View style={styles.calendarStripWrapper}>
          <View style={styles.stripHeaderRow}>
            <Text style={styles.stripLabel}>Cycle Days (26th — 25th)</Text>
            <Text style={styles.stripCountText}>{calendarDays.length} Days</Text>
          </View>
          {loading && !report ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={calendarDays}
              keyExtractor={(item) => item.dateStr}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => {
                const isSelected = item.dateStr === selectedDateStr;
                const isHoliday = item.status === 'HOLIDAY';
                return (
                  <TouchableOpacity
                    style={styles.calendarStripItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedDateStr(item.dateStr);
                      if (item.record) {
                        setSelectedRecord(item.record);
                      } else {
                        setSelectedRecord({
                          id: `cycle-${item.dateStr}`,
                          date: item.dateStr,
                          status: item.status,
                          check_in_time: null,
                          check_out_time: null,
                          approval_status: null,
                          late_minutes: 0,
                          early_minutes: 0,
                          overtime_minutes: 0,
                          working_hours: null,
                          holiday_name: item.record?.holiday_name,
                        });
                      }
                    }}
                  >
                    <Text style={[styles.calendarStripDay, isSelected && { color: COLORS.primary, fontFamily: 'Comfortaa_700Bold', }]}>
                      {item.dayName}
                    </Text>
                    <View
                      style={[
                        styles.calendarStripDateBox,
                        isHoliday && { borderColor: COLORS.gold, borderWidth: 1.5 },
                        isSelected && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                      ]}
                    >
                      <Text style={[styles.calendarStripDate, isSelected && { color: '#FFF' }, isHoliday && !isSelected && { color: COLORS.goldDark }]}>
                        {item.dayNum}
                      </Text>
                    </View>
                    {item.status !== 'FUTURE' && renderStatusDot(item.status)}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>

        {/* HOLIDAY & CYCLE SUMMARY HIGHLIGHTS (Clean Apple Card Grid) */}
        <View style={styles.summaryGrid}>
          {/* Holidays Card */}
          <View style={[styles.summaryCard, { backgroundColor: '#FFFFFF', borderColor: COLORS.goldLight, borderWidth: 1 }]}>
            <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(212, 160, 23, 0.12)' }]}>
              <PartyPopper size={18} color={COLORS.goldDark} strokeWidth={2.2} />
            </View>
            <Text style={styles.summaryLabel}>Holidays</Text>
            <Text style={[styles.summaryValue, { color: COLORS.goldDark }]}>{holidaysList.length}</Text>
          </View>

          {/* Working Days Card */}
          <View style={[styles.summaryCard, { backgroundColor: '#FFFFFF' }]}>
            <View style={[styles.summaryIconBox, { backgroundColor: COLORS.primaryLight }]}>
              <CalendarIcon size={18} color={COLORS.primary} strokeWidth={2.2} />
            </View>
            <Text style={styles.summaryLabel}>Working Days</Text>
            <Text style={styles.summaryValue}>{report?.summary?.working_days || 0}</Text>
          </View>

          {/* Cycle Days Total */}
          <View style={[styles.summaryCard, { backgroundColor: '#FFFFFF' }]}>
            <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(6, 27, 58, 0.06)' }]}>
              <Sparkles size={18} color={COLORS.navy} strokeWidth={2.2} />
            </View>
            <Text style={styles.summaryLabel}>Pay Period</Text>
            <Text style={[styles.summaryValue, { fontSize: 13, marginTop: 4 }]}>26 - 25</Text>
          </View>
        </View>

        {/* UPCOMING / CYCLE HOLIDAYS LIST */}
        {holidaysList.length > 0 && (
          <View style={styles.holidaysSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Holidays in this Cycle</Text>
              <Text style={styles.holidaysCountBadge}>{holidaysList.length} Holidays</Text>
            </View>
            <View style={styles.holidaysCardGroup}>
              {holidaysList.map((h: any, idx: number) => (
                <View key={`${h.dateStr}-${idx}`} style={styles.holidayTile}>
                  <View style={styles.holidayLeft}>
                    <View style={styles.holidayDatePill}>
                      <Text style={styles.holidayDateDay}>{h.dayNum}</Text>
                      <Text style={styles.holidayDateMonth}>{h.dayName}</Text>
                    </View>
                    <View style={styles.holidayInfo}>
                      <Text style={styles.holidayTitle}>{h.record?.holiday_name || 'Official Company Holiday'}</Text>
                      <Text style={styles.holidayDateFull}>{h.dateStr}</Text>
                    </View>
                  </View>
                  <View style={styles.holidayBadge}>
                    <Text style={styles.holidayBadgeText}>HOLIDAY</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* CYCLE SCHEDULE & ATTENDANCE LOG */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Cycle Schedule & Log</Text>
          
        </View>

        {loading && !report ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: COLORS.error, marginBottom: 16 }}>{error}</Text>
            <TouchableOpacity onPress={fetchReport} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : historyRecords.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No records in cycle</Text>
            <Text style={styles.emptySubtitle}>No calendar schedule available for this 26th-25th pay cycle.</Text>
          </View>
        ) : (
          <View style={styles.historyTable}>
            <View style={styles.historyTableHeader}>
              <Text style={[styles.historyTableHeaderText, styles.historyDateWidth]}>Date</Text>
              <Text style={[styles.historyTableHeaderText, styles.historyTimeWidth]}>Check In</Text>
              <Text style={[styles.historyTableHeaderText, styles.historyTimeWidth]}>Check Out</Text>
              <Text style={[styles.historyTableHeaderText, styles.historyHoursWidth]}>Hours</Text>
              <Text style={[styles.historyTableHeaderText, styles.historyStatusWidth]}>Status / Event</Text>
            </View>

            {historyRecords.map((item: any, index: number) => {
              const [year, month, day] = item.date.split('-').map(Number);
              const d = new Date(year, month - 1, day);
              const dayNum = String(d.getDate()).padStart(2, '0');
              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
              const badge = getStatusBadge(item.status, item.holiday_name);

              return (
                <TouchableOpacity
                  key={`${item.id || item.date}-${index}`}
                  style={styles.historyTableRow}
                  onPress={() => setSelectedRecord(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.historyDateWidth}>
                    <Text style={styles.historyTableDay}>{dayNum}</Text>
                    <Text style={styles.historyTableWeekday}>{dayName}</Text>
                  </View>

                  <Text style={[styles.historyTableValue, styles.historyTimeWidth]}>
                    {formatAttendanceTime(item.check_in_time)}
                  </Text>

                  <Text style={[styles.historyTableValue, styles.historyTimeWidth]}>
                    {formatAttendanceTime(item.check_out_time)}
                  </Text>

                  <Text style={[styles.historyTableValue, styles.historyHoursWidth]}>
                    {item.working_hours ? formatWorkingHours(item.working_hours) : '--'}
                  </Text>

                  <View style={styles.historyStatusWidth}>
                    <View style={[styles.historyCompactBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.historyCompactBadgeText, { color: badge.text }]} numberOfLines={1}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={15} color={COLORS.muted} strokeWidth={2} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* MONTH PICKER MODAL */}
      <Modal statusBarTranslucent visible={showMonthPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.monthPickerCard}>
            <Text style={styles.modalTitle}>Select Pay Cycle</Text>
            <View style={styles.monthGrid}>
              {MONTHS.map((m, idx) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.monthItem, currentDate.getMonth() === idx && styles.monthItemActive]}
                  onPress={() => handleMonthSelect(idx)}
                >
                  <Text style={[styles.monthItemText, currentDate.getMonth() === idx && { color: '#FFF' }]}>
                    {m.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowMonthPicker(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DATE DETAILS MODAL */}
      <Modal statusBarTranslucent visible={!!selectedRecord} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.detailsCard}>
            {selectedRecord && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Cycle Day Details</Text>
                
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Date:</Text>
                  <Text style={styles.detailsValue}>{selectedRecord.date}</Text>
                </View>

                {selectedRecord.holiday_name && (
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsLabel}>Holiday Event:</Text>
                    <Text style={[styles.detailsValue, { color: COLORS.goldDark, fontFamily: 'Comfortaa_700Bold' }]}>
                      {selectedRecord.holiday_name}
                    </Text>
                  </View>
                )}

                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Status:</Text>
                  <View style={[styles.historyCompactBadge, { backgroundColor: getStatusBadge(selectedRecord.status, selectedRecord.holiday_name).bg }]}>
                    <Text style={[styles.historyCompactBadgeText, { color: getStatusBadge(selectedRecord.status, selectedRecord.holiday_name).text }]}>
                      {getStatusBadge(selectedRecord.status, selectedRecord.holiday_name).label}
                    </Text>
                  </View>
                </View>

                {/* LEAVE SECTION IF PRESENT */}
                {selectedRecord.leave && (
                  <View style={styles.detailSectionBox}>
                    <View style={styles.detailSectionHeader}>
                      <FileText size={15} color="#D97706" />
                      <Text style={styles.detailSectionTitle}>Leave Request ({selectedRecord.leave.leave_type})</Text>
                    </View>
                    <Text style={styles.detailSectionText}>Status: {selectedRecord.leave.status}</Text>
                    {selectedRecord.leave.reason && (
                      <Text style={styles.detailSectionSubText}>Reason: {selectedRecord.leave.reason}</Text>
                    )}
                  </View>
                )}

                {/* WFH SECTION IF PRESENT */}
                {selectedRecord.wfh && (
                  <View style={[styles.detailSectionBox, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                    <View style={styles.detailSectionHeader}>
                      <Briefcase size={15} color="#7C3AED" />
                      <Text style={[styles.detailSectionTitle, { color: '#6D28D9' }]}>Work From Home (WFH)</Text>
                    </View>
                    <Text style={[styles.detailSectionText, { color: '#5B21B6' }]}>Status: {selectedRecord.wfh.status}</Text>
                    {selectedRecord.wfh.reason && (
                      <Text style={[styles.detailSectionSubText, { color: '#7C3AED' }]}>Reason: {selectedRecord.wfh.reason}</Text>
                    )}
                  </View>
                )}

                {/* PERMISSION SECTION IF PRESENT */}
                {selectedRecord.permissions && selectedRecord.permissions.length > 0 && (
                  <View style={[styles.detailSectionBox, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                    <View style={styles.detailSectionHeader}>
                      <Clock size={15} color="#0284C7" />
                      <Text style={[styles.detailSectionTitle, { color: '#0369A1' }]}>Permissions Used</Text>
                    </View>
                    {selectedRecord.permissions.map((p: any, pIdx: number) => (
                      <View key={p.id || pIdx} style={{ marginTop: 4 }}>
                        <Text style={[styles.detailSectionText, { color: '#0369A1' }]}>
                          • {p.duration_minutes} Minutes ({p.status})
                        </Text>
                        {p.start_time && p.end_time && (
                          <Text style={[styles.detailSectionSubText, { color: '#0284C7' }]}>
                            Time: {p.start_time} - {p.end_time}
                          </Text>
                        )}
                        {p.reason && (
                          <Text style={[styles.detailSectionSubText, { color: '#64748B' }]}>
                            Note: {p.reason}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Check In:</Text>
                  <Text style={styles.detailsValue}>{formatAttendanceTime(selectedRecord.check_in_time)}</Text>
                </View>

                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Check Out:</Text>
                  <Text style={styles.detailsValue}>{formatAttendanceTime(selectedRecord.check_out_time)}</Text>
                </View>

                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Working Hours:</Text>
                  <Text style={styles.detailsValue}>
                    {selectedRecord.working_hours ? formatWorkingHours(selectedRecord.working_hours) : '--'}
                  </Text>
                </View>

                {/* ATTENDANCE PHOTOS (CHECK-IN & CHECK-OUT) */}
                <View style={{ marginTop: 14 }}>
                  <Text style={[styles.detailsLabel, { marginBottom: 8 }]}>Punch Photos</Text>
                  <View style={styles.photoGrid}>
                    <View style={styles.photoBox}>
                      <Text style={styles.photoLabel}>Check In Photo</Text>
                      {selectedRecord.check_in_photo ? (
                        <Image
                          source={{ uri: resolveMediaUrl(selectedRecord.check_in_photo)! }}
                          style={styles.modalPhotoImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.noPhotoBox}>
                          <ImageIcon size={20} color="#94A3B8" />
                          <Text style={styles.noPhotoText}>No Punch In Photo</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.photoBox}>
                      <Text style={styles.photoLabel}>Check Out Photo</Text>
                      {selectedRecord.check_out_photo ? (
                        <Image
                          source={{ uri: resolveMediaUrl(selectedRecord.check_out_photo)! }}
                          style={styles.modalPhotoImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.noPhotoBox}>
                          <ImageIcon size={20} color="#94A3B8" />
                          <Text style={styles.noPhotoText}>No Punch Out Photo</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.closeDetailsBtn} onPress={() => setSelectedRecord(null)}>
                  <Text style={styles.closeDetailsBtnText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },

  header: {
    backgroundColor: COLORS.white,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitleContainer: { flex: 1, paddingRight: 12 },
  headerTitle: { fontSize: 24, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark, letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, color: COLORS.secondary, marginTop: 3, fontFamily: 'Comfortaa_500Medium', },
  monthSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(70, 89, 199, 0.08)',
  },
  monthSelectorText: { fontSize: 12, fontFamily: 'Comfortaa_700Bold', color: COLORS.primary },

  calendarStripWrapper: { marginTop: 14, marginBottom: 8 },
  stripHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  stripLabel: { fontSize: 12, fontFamily: 'Comfortaa_700Bold', color: COLORS.textSecondary },
  stripCountText: { fontSize: 11, fontFamily: 'Comfortaa_600SemiBold', color: COLORS.primary },

  calendarStripItem: { alignItems: 'center', marginHorizontal: 7 },
  calendarStripDay: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  calendarStripDateBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(6, 27, 58, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  calendarStripDate: { fontSize: 16, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },

  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 12, gap: 8 },
  summaryCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 27, 58, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryIconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, fontFamily: 'Comfortaa_600SemiBold', textAlign: 'center', marginBottom: 2 },
  summaryValue: { fontSize: 18, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },

  holidaysSection: { marginTop: 16, paddingHorizontal: 16 },
  holidaysCountBadge: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.goldDark,
    backgroundColor: 'rgba(212, 160, 23, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  holidaysCardGroup: { gap: 8, marginTop: 6 },
  holidayTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  holidayLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  holidayDatePill: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 160, 23, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holidayDateDay: { fontSize: 16, fontFamily: 'Comfortaa_700Bold', color: COLORS.goldDark },
  holidayDateMonth: { fontSize: 9, fontFamily: 'Comfortaa_700Bold', color: COLORS.goldDark, textTransform: 'uppercase' },
  holidayInfo: { flex: 1 },
  holidayTitle: { fontSize: 14, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  holidayDateFull: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  holidayBadge: {
    backgroundColor: 'rgba(212, 160, 23, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  holidayBadgeText: { fontSize: 10, fontFamily: 'Comfortaa_700Bold', color: COLORS.goldDark },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  viewReportsText: { fontSize: 13, fontFamily: 'Comfortaa_700Bold', color: COLORS.primary },

  historyTable: {
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(6, 27, 58, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  historyTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FC',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(6, 27, 58, 0.06)',
  },
  historyTableHeaderText: { fontSize: 10, fontFamily: 'Comfortaa_700Bold', color: COLORS.textSecondary, textTransform: 'uppercase' },
  historyTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(6, 27, 58, 0.04)',
  },
  historyDateWidth: { width: 44 },
  historyTimeWidth: { flex: 1, minWidth: 54 },
  historyHoursWidth: { width: 48, textAlign: 'center' },
  historyStatusWidth: { width: 84 },
  historyTableDay: { fontSize: 15, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  historyTableWeekday: { fontSize: 10, color: COLORS.textSecondary },
  historyTableValue: { fontSize: 12, color: COLORS.dark, fontFamily: 'Comfortaa_600SemiBold', },
  historyCompactBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  historyCompactBadgeText: { fontSize: 10, fontFamily: 'Comfortaa_700Bold', },

  emptyState: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.primary, borderRadius: 12 },
  retryBtnText: { color: '#FFF', fontFamily: 'Comfortaa_700Bold', },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  monthPickerCard: { width: '90%', backgroundColor: '#FFF', borderRadius: 24, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark, marginBottom: 16 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, width: '100%' },
  monthItem: { width: '30%', paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#F8F9FC' },
  monthItemActive: { backgroundColor: COLORS.primary },
  monthItemText: { fontSize: 13, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  closeBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20 },
  closeBtnText: { fontSize: 14, fontFamily: 'Comfortaa_700Bold', color: COLORS.textSecondary },

  detailsCard: { width: '92%', maxHeight: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 22 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8F9FC' },
  detailsLabel: { fontSize: 13, color: COLORS.textSecondary },
  detailsValue: { fontSize: 13, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  closeDetailsBtn: { marginTop: 18, backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  closeDetailsBtnText: { color: '#FFF', fontFamily: 'Comfortaa_700Bold', fontSize: 14 },

  detailSectionBox: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  detailSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  detailSectionTitle: { fontSize: 12, fontFamily: 'Comfortaa_700Bold', color: '#B45309' },
  detailSectionText: { fontSize: 12, fontFamily: 'Comfortaa_600SemiBold', color: '#92400E' },
  detailSectionSubText: { fontSize: 11, color: '#78350F', marginTop: 2 },

  photoGrid: { flexDirection: 'row', gap: 10, marginTop: 4 },
  photoBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  photoLabel: { fontSize: 11, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark, marginBottom: 6 },
  modalPhotoImg: { width: '100%', height: 110, borderRadius: 8, backgroundColor: '#E2E8F0' },
  noPhotoBox: { height: 110, width: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8 },
  noPhotoText: { fontSize: 10, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
});
