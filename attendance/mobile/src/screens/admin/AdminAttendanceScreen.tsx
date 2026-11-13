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
} from 'react-native';
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
  
  // Modals: View & Edit
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editStatus, setEditStatus] = useState('PRESENT');
  const [savingEdit, setSavingEdit] = useState(false);
  const [rejectingRecord, setRejectingRecord] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleApproveRecord = async (rec: any) => {
    try {
      setActionLoading(true);
      await approveAttendanceRecord(rec.id);
      Alert.alert('Success', 'Attendance record approved successfully!');
      loadAttendance(selectedDate);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to approve attendance.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingRecord) return;
    if (!rejectReason.trim()) {
      Alert.alert('Validation Error', 'Please enter a rejection reason.');
      return;
    }
    try {
      setActionLoading(true);
      await rejectAttendanceRecord(rejectingRecord.id, rejectReason.trim());
      Alert.alert('Success', 'Attendance record rejected.');
      setRejectingRecord(null);
      setRejectReason('');
      loadAttendance(selectedDate);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to reject attendance.');
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
    }
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

  const filteredRecords = records.filter((r) => {
    const empName = (r.employee?.full_name || '').toLowerCase();
    const empId = (r.employee?.employee_id || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchSearch = empName.includes(query) || empId.includes(query);

    if (statusFilter === 'ALL') return matchSearch;
    return matchSearch && r.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return { bg: '#E8F5E9', text: '#2E7D32', label: 'Present' };
      case 'LATE':
        return { bg: '#FFF8E1', text: '#F57F17', label: 'Late' };
      case 'ABSENT':
        return { bg: '#FFEBEE', text: '#C62828', label: 'Absent' };
      case 'HALF_DAY':
        return { bg: '#E0F7FA', text: '#00838F', label: 'Half Day' };
      default:
        return { bg: '#F5F5F5', text: '#616161', label: status || 'Pending' };
    }
  };

  const totalCount = records.length;
  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const lateCount = records.filter((r) => r.status === 'LATE').length;
  const absentCount = records.filter((r) => r.status === 'ABSENT').length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
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
          renderItem={({ item }) => {
            const emp = item.employee || {};
            const badge = getStatusBadge(item.status);
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

                {/* Approval Status & Actions: Only show if employee actually punched in/out */}
                {Boolean(item.check_in_time || item.check_out_time || (typeof item.id === 'number')) && (
                  <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 11, color: '#64748B', fontFamily: 'Comfortaa_500Medium' }}>Approval:</Text>
                        <View style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 10,
                          backgroundColor: item.approval_status === 'APPROVED' ? '#ECFDF5' : (item.approval_status === 'REJECTED' ? '#FEF2F2' : '#FFFBEB'),
                          borderWidth: 1,
                          borderColor: item.approval_status === 'APPROVED' ? '#A7F3D0' : (item.approval_status === 'REJECTED' ? '#FECACA' : '#FDE68A')
                        }}>
                          <Text style={{
                            fontSize: 10,
                            fontFamily: 'Comfortaa_700Bold',
                            color: item.approval_status === 'APPROVED' ? '#059669' : (item.approval_status === 'REJECTED' ? '#DC2626' : '#D97706')
                          }}>
                            {item.approval_status || 'PENDING'}
                          </Text>
                        </View>
                      </View>
                      {item.rejection_reason ? (
                        <Text style={{ fontSize: 11, color: '#DC2626', fontStyle: 'italic', maxWidth: '55%' }} numberOfLines={1}>
                          {item.rejection_reason}
                        </Text>
                      ) : null}
                    </View>

                    {/* Only show Approve and Reject buttons if pending (once approved or rejected, hide buttons) */}
                    {item.approval_status !== 'APPROVED' && item.approval_status !== 'REJECTED' && (
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 7,
                            borderRadius: 6,
                            backgroundColor: '#E56108',
                            gap: 4
                          }}
                          onPress={() => handleApproveRecord(item)}
                          disabled={actionLoading}
                          activeOpacity={0.8}
                        >
                          <CheckCircle size={13} color='#FFFFFF' strokeWidth={2.2} />
                          <Text style={{ color: '#FFFFFF', fontSize: 11, fontFamily: 'Comfortaa_700Bold' }}>Approve</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 7,
                            borderRadius: 6,
                            backgroundColor: '#FEF2F2',
                            borderWidth: 1,
                            borderColor: '#FECACA',
                            gap: 4
                          }}
                          onPress={() => {
                            setRejectingRecord(item);
                            setRejectReason('');
                          }}
                          disabled={actionLoading}
                          activeOpacity={0.8}
                        >
                          <XCircle size={13} color='#DC2626' strokeWidth={2.2} />
                          <Text style={{ color: '#DC2626', fontSize: 11, fontFamily: 'Comfortaa_700Bold' }}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
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
      <Modal visible={!!rejectingRecord} transparent animationType='fade' onRequestClose={() => setRejectingRecord(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 300 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Attendance</Text>
              <TouchableOpacity onPress={() => setRejectingRecord(null)}>
                <X size={20} color='#64748B' />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: '#64748B', marginVertical: 8 }}>
              Enter reason for rejecting {rejectingRecord?.employee?.full_name}:
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
                onPress={() => setRejectingRecord(null)}
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
