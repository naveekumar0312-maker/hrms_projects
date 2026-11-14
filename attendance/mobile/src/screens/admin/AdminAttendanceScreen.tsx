import { colors } from '../../theme/colors';
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarClock,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  X,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  LogIn,
  LogOut as LogOutIcon,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import {
  getAdminAttendanceList,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  approveAttendanceRecord,
  rejectAttendanceRecord,
} from '../../services/attendanceService';
import { resolveMediaUrl } from '../../utils/imageUtils';
import { formatAttendanceTime } from '../../utils/dateUtils';

export const AdminAttendanceScreen = ({ navigation }: any) => {
  const { user } = useContext(AuthContext);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT' | 'PENDING'>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  
  // Modals: View & Edit
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editStatus, setEditStatus] = useState('PRESENT');
  const [savingEdit, setSavingEdit] = useState(false);
  const [rejectingAction, setRejectingAction] = useState<{ record: any; type: 'check_in' | 'check_out' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleApprovePunch = async (rec: any, type: 'check_in' | 'check_out') => {
    try {
      setActionLoading(true);
      await approveAttendanceRecord(rec.id, type);
      const label = type === 'check_in' ? 'Check In' : 'Check Out';
      Alert.alert('Success', `${label} for ${rec.employee?.full_name || 'employee'} approved successfully!`);
      loadAttendance(selectedDate);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to approve punch.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingAction) return;
    if (!rejectReason.trim()) {
      Alert.alert('Validation Error', 'Please enter a rejection reason.');
      return;
    }
    try {
      setActionLoading(true);
      await rejectAttendanceRecord(rejectingAction.record.id, rejectReason.trim(), rejectingAction.type);
      const label = rejectingAction.type === 'check_in' ? 'Check In' : 'Check Out';
      Alert.alert('Success', `${label} rejected.`);
      setRejectingAction(null);
      setRejectReason('');
      loadAttendance(selectedDate);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to reject punch.');
    } finally {
      setActionLoading(false);
    }
  };

  const loadAttendance = async (dateStr: string) => {
    setLoading(true);
    try {
      const data = await getAdminAttendanceList(dateStr, user?.role === 'HR' ? user?.company_id : undefined);
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed fetching attendance records:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAttendance(selectedDate);
  };

  useEffect(() => {
    loadAttendance(selectedDate);
  }, [selectedDate]);

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const openEditModal = (rec: any) => {
    setEditingRecord(rec);
    const extractHM = (val: string | null | undefined, defaultVal: string) => {
      if (!val) return defaultVal;
      if (/^\d{1,2}:\d{2}/.test(val)) return val.substring(0, 5);
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }
      return defaultVal;
    };
    setEditCheckIn(extractHM(rec.check_in_time, '09:00'));
    setEditCheckOut(extractHM(rec.check_out_time, '18:00'));
    setEditStatus(rec.status || 'PRESENT');
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setSavingEdit(true);
    try {
      await updateAttendanceRecord(editingRecord.id, {
        check_in_time: editCheckIn ? `${editCheckIn}:00` : null,
        check_out_time: editCheckOut ? `${editCheckOut}:00` : null,
        status: editStatus,
      });
      Alert.alert('Success', 'Attendance record updated successfully!');
      setEditingRecord(null);
      loadAttendance(selectedDate);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to update attendance record.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteRecord = (rec: any) => {
    Alert.alert(
      'Delete Attendance',
      `Are you sure you want to delete attendance record for ${rec.employee?.full_name || 'this employee'} on ${rec.date}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAttendanceRecord(rec.id);
              Alert.alert('Deleted', 'Attendance record deleted successfully.');
              loadAttendance(selectedDate);
            } catch (e) {
              Alert.alert('Error', 'Failed to delete attendance record.');
            }
          },
        },
      ]
    );
  };

  const isPresentRecord = (r: any) => {
    return ['PRESENT', 'COMPLETED', 'ON_TIME', 'WORKING'].includes(r.status);
  };

  const isPendingRecord = (r: any) => {
    return r.approval_status === 'PENDING' || r.status === 'PENDING';
  };

  const dateFilteredRecords = records.filter((r) => {
    // Exclude super admin/admin records from attendance lists
    const empId = (r.employee?.employee_id || '').toUpperCase().replace(/[-_]/g, '');
    const empName = (r.employee?.full_name || '').toLowerCase().trim();
    const role = (r.employee?.role || r.employee?.user?.role || '').toUpperCase();
    if (empId.includes('SUPERADMIN') || empName === 'admin' || role === 'SUPER_ADMIN' || role === 'ADMIN') return false;

    // Filter strictly by selected date
    if (r.date && r.date !== selectedDate) return false;

    return true;
  });

  const filteredRecords = dateFilteredRecords.filter((r) => {
    const empName = (r.employee?.full_name || '').toLowerCase();
    const empId = (r.employee?.employee_id || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchSearch = empName.includes(query) || empId.includes(query);

    if (!matchSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PRESENT') return isPresentRecord(r);
    if (statusFilter === 'LATE') return r.status === 'LATE';
    if (statusFilter === 'ABSENT') return r.status === 'ABSENT';
    if (statusFilter === 'PENDING') return isPendingRecord(r);

    return r.status === statusFilter;
  });

  const getStatusBadge = (status: string, approvalStatus?: string) => {
    if (['PRESENT', 'COMPLETED', 'ON_TIME', 'WORKING'].includes(status)) {
      return { bg: '#E8F5E9', text: '#2E7D32', label: 'Present' };
    }
    if (status === 'LATE') {
      return { bg: '#FFF8E1', text: '#F57F17', label: 'Late' };
    }
    if (status === 'ABSENT') {
      return { bg: '#FFEBEE', text: '#C62828', label: 'Absent' };
    }
    if (status === 'ON_LEAVE') {
      return { bg: '#E0F2FE', text: '#0284C7', label: 'On Leave' };
    }
    if (status === 'HOLIDAY') {
      return { bg: '#FEF3C7', text: '#D97706', label: 'Holiday' };
    }
    if (status === 'WEEKLY_OFF') {
      return { bg: '#F3F4F6', text: '#6B7280', label: 'Weekly Off' };
    }
    if (status === 'PENDING' || approvalStatus === 'PENDING') {
      return { bg: '#FFFBEB', text: '#D97706', label: 'Pending' };
    }
    return { bg: '#F5F5F5', text: '#616161', label: status || 'Pending' };
  };

  const totalCount = dateFilteredRecords.length;
  const presentCount = dateFilteredRecords.filter(isPresentRecord).length;
  const lateCount = dateFilteredRecords.filter((r) => r.status === 'LATE').length;
  const absentCount = dateFilteredRecords.filter((r) => r.status === 'ABSENT').length;
  const pendingCount = dateFilteredRecords.filter(isPendingRecord).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar style="dark" hidden={false} />
      <AdminHRHeader
        title="Attendance Records"
        subtitle={`${filteredRecords.length} records on ${selectedDate}`}
        role={user?.role || 'ADMIN'}
        companyName={user?.company_name}
      />

      {/* Date Switcher */}
      <View style={styles.datePickerRow}>
        <TouchableOpacity
          style={styles.arrowBtn}
          onPress={() => changeDate(-1)}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#0D1B2A" />
        </TouchableOpacity>

        <View style={styles.dateDisplay}>
          <CalendarClock size={16} color="#E56108" />
          <Text style={styles.dateText}>{selectedDate}</Text>
        </View>

        <TouchableOpacity
          style={styles.arrowBtn}
          onPress={() => changeDate(1)}
          activeOpacity={0.7}
        >
          <ChevronRight size={20} color="#0D1B2A" />
        </TouchableOpacity>
      </View>

      {/* Modern Search & Filter Pill Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={16} color="#7B8192" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employee by name or ID..."
            placeholderTextColor="#7B8192"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#7B8192" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          {(['ALL', 'PRESENT', 'LATE', 'ABSENT', 'PENDING'] as const).map((st) => {
            const active = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setStatusFilter(st)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {st}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Summary KPI Badges */}
      <View style={styles.summaryRow}>
        <View style={styles.chip}>
          <Text style={[styles.chipVal, { color: '#E56108' }]}>{totalCount}</Text>
          <Text style={styles.chipLabel}>Total</Text>
        </View>
        <View style={styles.chip}>
          <Text style={[styles.chipVal, { color: '#34C759' }]}>{presentCount}</Text>
          <Text style={styles.chipLabel}>Present</Text>
        </View>
        <View style={styles.chip}>
          <Text style={[styles.chipVal, { color: '#FF9500' }]}>{lateCount}</Text>
          <Text style={styles.chipLabel}>Late</Text>
        </View>
        <View style={styles.chip}>
          <Text style={[styles.chipVal, { color: '#FF3B30' }]}>{absentCount}</Text>
          <Text style={styles.chipLabel}>Absent</Text>
        </View>
        <View style={styles.chip}>
          <Text style={[styles.chipVal, { color: '#D97706' }]}>{pendingCount}</Text>
          <Text style={styles.chipLabel}>Pending</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E56108" />
          <Text style={styles.loadingText}>Fetching attendance records...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item) => String(item.id || item.employee?.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#E56108']}
            />
          }
          renderItem={({ item }) => {
            const emp = item.employee || {};
            const badge = getStatusBadge(item.status, item.approval_status);
            return (
              <View style={styles.card}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedRecord(item)}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.avatarCircle}>
                      {emp.profile_photo ? (
                        <Image
                          source={{ uri: resolveMediaUrl(emp.profile_photo)! }}
                          style={styles.avatarImg}
                        />
                      ) : (
                        <Text style={styles.avatarText}>
                          {emp.full_name
                            ?.split(' ')
                            .map((n: string) => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase() || 'EM'}
                        </Text>
                      )}
                    </View>

                    <View style={styles.nameCol}>
                      <Text style={styles.empName}>{emp.full_name || 'Staff Member'}</Text>
                      <Text style={styles.empSub}>
                        ID: {emp.employee_id} {emp.department ? `• ${emp.department}` : ''}
                      </Text>
                    </View>

                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.timesRow}>
                    <View style={styles.timeCol}>
                      <Clock size={13} color="#5A6A80" />
                      <Text style={styles.timeText}>
                        In: {formatAttendanceTime(item.check_in_time)}
                      </Text>
                    </View>

                    <View style={styles.timeCol}>
                      <Clock size={13} color="#5A6A80" />
                      <Text style={styles.timeText}>
                        Out: {formatAttendanceTime(item.check_out_time)}
                      </Text>
                    </View>

                    <View style={styles.timeCol}>
                      <Text style={[styles.timeText, { color: '#E56108', fontFamily: 'Comfortaa_700Bold' }]}>
                        Hrs: {item.working_hours || '00:00'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Separate Punch In & Punch Out Approval Blocks */}
                {Boolean(item.check_in_time || item.check_in || item.check_out_time || item.check_out || (typeof item.id === 'number')) && (
                  <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8 }}>
                    {/* CHECK IN APPROVAL BLOCK */}
                    <View style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: 10,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: '#E2E8F0'
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <LogIn size={14} color="#E56108" />
                          <Text style={{ fontSize: 12, fontFamily: 'Comfortaa_700Bold', color: '#1E293B' }}>Check In</Text>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>
                            {formatAttendanceTime(item.check_in_time || item.check_in)}
                          </Text>
                        </View>
                        {item.check_in_time || item.check_in ? (
                          <View style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 10,
                            backgroundColor: item.check_in_approval_status === 'APPROVED' ? '#ECFDF5' : (item.check_in_approval_status === 'REJECTED' ? '#FEF2F2' : '#FFFBEB'),
                            borderWidth: 1,
                            borderColor: item.check_in_approval_status === 'APPROVED' ? '#A7F3D0' : (item.check_in_approval_status === 'REJECTED' ? '#FECACA' : '#FDE68A')
                          }}>
                            <Text style={{
                              fontSize: 10,
                              fontFamily: 'Comfortaa_700Bold',
                              color: item.check_in_approval_status === 'APPROVED' ? '#059669' : (item.check_in_approval_status === 'REJECTED' ? '#DC2626' : '#D97706')
                            }}>
                              {item.check_in_approval_status || 'PENDING'}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {item.late_reason ? (
                        <View style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 }}>
                          <Text style={{ fontSize: 11, color: '#DC2626', fontFamily: 'Comfortaa_600SemiBold' }}>
                            Late Reason: {item.late_reason}
                          </Text>
                        </View>
                      ) : null}

                      {item.check_in_rejection_reason ? (
                        <Text style={{ fontSize: 11, color: '#DC2626', fontStyle: 'italic', marginTop: 4 }}>
                          Reason: {item.check_in_rejection_reason}
                        </Text>
                      ) : null}

                      {/* Check In Action Buttons */}
                      {Boolean(item.check_in_time || item.check_in) && item.check_in_approval_status !== 'APPROVED' && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingVertical: 6,
                              borderRadius: 6,
                              backgroundColor: '#E56108',
                              gap: 4
                            }}
                            onPress={() => handleApprovePunch(item, 'check_in')}
                            disabled={actionLoading}
                            activeOpacity={0.8}
                          >
                            <CheckCircle size={12} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={{ color: '#FFFFFF', fontSize: 11, fontFamily: 'Comfortaa_700Bold' }}>Approve In</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingVertical: 6,
                              borderRadius: 6,
                              backgroundColor: '#FEF2F2',
                              borderWidth: 1,
                              borderColor: '#FECACA',
                              gap: 4
                            }}
                            onPress={() => {
                              setRejectingAction({ record: item, type: 'check_in' });
                              setRejectReason('');
                            }}
                            disabled={actionLoading}
                            activeOpacity={0.8}
                          >
                            <XCircle size={12} color="#DC2626" strokeWidth={2.2} />
                            <Text style={{ color: '#DC2626', fontSize: 11, fontFamily: 'Comfortaa_700Bold' }}>Reject In</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* CHECK OUT APPROVAL BLOCK */}
                    <View style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: 10,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: '#E2E8F0'
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <LogOutIcon size={14} color="#0369A1" />
                          <Text style={{ fontSize: 12, fontFamily: 'Comfortaa_700Bold', color: '#1E293B' }}>Check Out</Text>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>
                            {item.check_out_time || item.check_out
                              ? formatAttendanceTime(item.check_out_time || item.check_out)
                              : 'Not punched yet'}
                          </Text>
                        </View>
                        {item.check_out_time || item.check_out ? (
                          <View style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 10,
                            backgroundColor: item.check_out_approval_status === 'APPROVED' ? '#ECFDF5' : (item.check_out_approval_status === 'REJECTED' ? '#FEF2F2' : '#FFFBEB'),
                            borderWidth: 1,
                            borderColor: item.check_out_approval_status === 'APPROVED' ? '#A7F3D0' : (item.check_out_approval_status === 'REJECTED' ? '#FECACA' : '#FDE68A')
                          }}>
                            <Text style={{
                              fontSize: 10,
                              fontFamily: 'Comfortaa_700Bold',
                              color: item.check_out_approval_status === 'APPROVED' ? '#059669' : (item.check_out_approval_status === 'REJECTED' ? '#DC2626' : '#D97706')
                            }}>
                              {item.check_out_approval_status || 'PENDING'}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {item.check_out_rejection_reason ? (
                        <Text style={{ fontSize: 11, color: '#DC2626', fontStyle: 'italic', marginTop: 4 }}>
                          Reason: {item.check_out_rejection_reason}
                        </Text>
                      ) : null}

                      {/* Check Out Action Buttons */}
                      {Boolean(item.check_out_time || item.check_out) && item.check_out_approval_status !== 'APPROVED' && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingVertical: 6,
                              borderRadius: 6,
                              backgroundColor: '#E56108',
                              gap: 4
                            }}
                            onPress={() => handleApprovePunch(item, 'check_out')}
                            disabled={actionLoading}
                            activeOpacity={0.8}
                          >
                            <CheckCircle size={12} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={{ color: '#FFFFFF', fontSize: 11, fontFamily: 'Comfortaa_700Bold' }}>Approve Out</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingVertical: 6,
                              borderRadius: 6,
                              backgroundColor: '#FEF2F2',
                              borderWidth: 1,
                              borderColor: '#FECACA',
                              gap: 4
                            }}
                            onPress={() => {
                              setRejectingAction({ record: item, type: 'check_out' });
                              setRejectReason('');
                            }}
                            disabled={actionLoading}
                            activeOpacity={0.8}
                          >
                            <XCircle size={12} color="#DC2626" strokeWidth={2.2} />
                            <Text style={{ color: '#DC2626', fontSize: 11, fontFamily: 'Comfortaa_700Bold' }}>Reject Out</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* View, Edit, Delete Actions */}
                <View style={styles.cardActionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.viewBtn]}
                    onPress={() => setSelectedRecord(item)}
                    activeOpacity={0.7}
                  >
                    <Eye size={13} color="#E56108" />
                    <Text style={[styles.actionBtnText, { color: '#E56108' }]}>View</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn]}
                    onPress={() => openEditModal(item)}
                    activeOpacity={0.7}
                  >
                    <Pencil size={13} color="#E56108" />
                    <Text style={[styles.actionBtnText, { color: '#E56108' }]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDeleteRecord(item)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={13} color="#EF4444" />
                    <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Attendance Records</Text>
              <Text style={styles.emptyDesc}>No activity matching your search filters for this date.</Text>
            </View>
          }
        />
      )}

      {/* Attendance Detail Modal */}
      <Modal statusBarTranslucent visible={!!selectedRecord} animationType="fade" transparent>
        <StatusBar style="dark" hidden={false} />
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attendance Details</Text>
              <TouchableOpacity onPress={() => setSelectedRecord(null)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {selectedRecord && (
              <View style={styles.modalBody}>
                <View style={styles.modalEmpRow}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {selectedRecord.employee?.full_name?.substring(0, 2).toUpperCase() || 'EM'}
                    </Text>
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.empName}>{selectedRecord.employee?.full_name}</Text>
                    <Text style={styles.empSub}>
                      {selectedRecord.employee?.employee_id} • {selectedRecord.employee?.department || 'Staff'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{selectedRecord.date}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={[styles.detailValue, { fontFamily: 'Comfortaa_700Bold', color: '#E56108' }]}>
                    {selectedRecord.status}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Check In</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord.check_in_time || selectedRecord.check_in
                      ? formatAttendanceTime(selectedRecord.check_in_time || selectedRecord.check_in)
                      : 'Not punched'}
                  </Text>
                </View>
                {selectedRecord.late_reason ? (
                  <View style={[styles.detailRow, { backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8, marginTop: 4, marginBottom: 4 }]}>
                    <Text style={[styles.detailLabel, { color: '#DC2626' }]}>Late Reason</Text>
                    <Text style={[styles.detailValue, { color: '#DC2626', fontFamily: 'Comfortaa_700Bold', flex: 1, textAlign: 'right' }]}>
                      {selectedRecord.late_reason}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Check Out</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord.check_out_time || selectedRecord.check_out
                      ? formatAttendanceTime(selectedRecord.check_out_time || selectedRecord.check_out)
                      : 'Not punched'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Working Hours</Text>
                  <Text style={styles.detailValue}>{selectedRecord.working_hours || '00:00'}</Text>
                </View>

                {/* Photos Row */}
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.detailLabel, { marginBottom: 6 }]}>Punch Photos</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1, backgroundColor: '#F8F9FC', borderRadius: 10, padding: 6, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, fontFamily: 'Comfortaa_700Bold', color: '#444', marginBottom: 4 }}>Check In</Text>
                      {selectedRecord.check_in_photo ? (
                        <Image
                          source={{ uri: resolveMediaUrl(selectedRecord.check_in_photo)! }}
                          style={{ width: '100%', height: 90, borderRadius: 6, backgroundColor: '#E2E8F0' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ width: '100%', height: 90, borderRadius: 6, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: 9, color: '#94A3B8' }}>No Photo</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flex: 1, backgroundColor: '#F8F9FC', borderRadius: 10, padding: 6, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, fontFamily: 'Comfortaa_700Bold', color: '#444', marginBottom: 4 }}>Check Out</Text>
                      {selectedRecord.check_out_photo ? (
                        <Image
                          source={{ uri: resolveMediaUrl(selectedRecord.check_out_photo)! }}
                          style={{ width: '100%', height: 90, borderRadius: 6, backgroundColor: '#E2E8F0' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ width: '100%', height: 90, borderRadius: 6, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: 9, color: '#94A3B8' }}>No Photo</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.viewActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn, { flex: 1, paddingVertical: 10 }]}
                    onPress={() => {
                      const cur = selectedRecord;
                      setSelectedRecord(null);
                      openEditModal(cur);
                    }}
                  >
                    <Pencil size={15} color="#E56108" />
                    <Text style={[styles.actionBtnText, { color: '#E56108', fontSize: 13 }]}>Edit Record</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn, { flex: 1, paddingVertical: 10 }]}
                    onPress={() => {
                      const cur = selectedRecord;
                      setSelectedRecord(null);
                      handleDeleteRecord(cur);
                    }}
                  >
                    <Trash2 size={15} color="#EF4444" />
                    <Text style={[styles.actionBtnText, { color: '#EF4444', fontSize: 13 }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Attendance Record Modal */}
      <Modal visible={!!editingRecord} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Attendance Record</Text>
              <TouchableOpacity onPress={() => setEditingRecord(null)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {editingRecord && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.formLabel}>Employee</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: '#F1F5F9', color: '#64748B' }]}
                  value={`${editingRecord.employee?.full_name} (${editingRecord.employee?.employee_id})`}
                  editable={false}
                />

                <Text style={styles.formLabel}>Check-In Time (HH:MM)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="09:00"
                  value={editCheckIn}
                  onChangeText={setEditCheckIn}
                />

                <Text style={styles.formLabel}>Check-Out Time (HH:MM)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="18:00"
                  value={editCheckOut}
                  onChangeText={setEditCheckOut}
                />

                <Text style={styles.formLabel}>Status</Text>
                <View style={styles.statusSelectRow}>
                  {['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY'].map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.statusSelectPill,
                        editStatus === st && styles.statusSelectPillActive,
                      ]}
                      onPress={() => setEditStatus(st)}
                    >
                      <Text
                        style={[
                          styles.statusSelectText,
                          editStatus === st && styles.statusSelectTextActive,
                        ]}
                      >
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>Save Attendance</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
          {/* Rejection Reason Modal */}
      <Modal visible={!!rejectingAction} transparent animationType='fade' onRequestClose={() => setRejectingAction(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 300 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Reject {rejectingAction?.type === 'check_in' ? 'Check In' : 'Check Out'}
              </Text>
              <TouchableOpacity onPress={() => setRejectingAction(null)}>
                <X size={20} color='#64748B' />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: '#64748B', marginVertical: 8 }}>
              Enter reason for rejecting {rejectingAction?.type === 'check_in' ? 'Check In' : 'Check Out'} for {rejectingAction?.record?.employee?.full_name}:
            </Text>
            <TextInput
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#CBD5E1',
                borderRadius: 8,
                padding: 10,
                fontSize: 13,
                minHeight: 70,
                textAlignVertical: 'top',
                marginBottom: 14
              }}
              placeholder='e.g., Unverified shift, incorrect location...'
              placeholderTextColor='#94A3B8'
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity
                style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, backgroundColor: '#F1F5F9' }}
                onPress={() => setRejectingAction(null)}
                disabled={actionLoading}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Comfortaa_600SemiBold', color: '#64748B' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, backgroundColor: '#DC2626' }}
                onPress={handleConfirmReject}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size='small' color='#FFFFFF' />
                ) : (
                  <Text style={{ fontSize: 13, fontFamily: 'Comfortaa_700Bold', color: '#FFFFFF' }}>Confirm Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(6, 27, 58, 0.04)',
  },
  arrowBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8F9FC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECEEF3',
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0D1B2A',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0D1B2A',
    fontFamily: 'Comfortaa_500Medium',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
  },
  filterPillActive: {
    backgroundColor: '#E56108',
    borderColor: '#E56108',
  },
  filterPillText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#5A6A80',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  chip: {
    flex: 1,
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECEEF3',
  },
  chipVal: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
  },
  chipLabel: {
    fontSize: 10,
    fontFamily: 'Comfortaa_500Medium',
    color: '#5A6A80',
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#5A6A80',
  },
  listContent: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECEEF3',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 86, 179, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#E56108',
  },
  nameCol: {
    flex: 1,
  },
  empName: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0D1B2A',
  },
  empSub: {
    fontSize: 11,
    color: '#5A6A80',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
  },
  timesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F8F9FC',
    marginTop: 10,
    paddingTop: 8,
  },
  timeCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#5A6A80',
    fontFamily: 'Comfortaa_500Medium',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    justifyContent: 'center',
  },
  viewBtn: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  editBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  actionBtnText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0D1B2A',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#5A6A80',
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0D1B2A',
  },
  modalBody: {
    marginTop: 14,
  },
  modalEmpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FC',
  },
  detailLabel: {
    fontSize: 12,
    color: '#8E9BAE',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  detailValue: {
    fontSize: 13,
    color: '#0D1B2A',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  viewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    marginBottom: 10,
  },
  formLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#222222',
    marginTop: 8,
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#000000',
    fontFamily: 'Comfortaa_500Medium',
  },
  statusSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  statusSelectPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
  },
  statusSelectPillActive: {
    backgroundColor: '#E56108',
    borderColor: '#E56108',
  },
  statusSelectText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#5A6A80',
  },
  statusSelectTextActive: {
    color: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: '#E56108',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 14,
  },
});
