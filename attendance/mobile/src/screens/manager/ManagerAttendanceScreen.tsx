import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  CalendarCheck,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  ArrowLeft,
  X,
  Eye,
  LogIn,
  LogOut as LogOutIcon,
  RotateCcw,
  MapPin,
  Building,
  Filter,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { getManagerTeamAttendance, ManagerAttendanceRow } from '../../services/managerService';
import { fetchCompanies, fetchBranches } from '../../services/adminHRService';
import { approveAttendanceRecord, rejectAttendanceRecord, undoAttendanceRecord } from '../../services/attendanceService';
import { resolveMediaUrl } from '../../utils/imageUtils';
import { formatAttendanceTime } from '../../utils/dateUtils';
import { useAppMessage } from '../../context/MessageContext';
import { COLORS } from '../../constants/theme';
import { colors } from '../../theme/colors';

export default function ManagerAttendanceScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, employee } = useContext(AuthContext);
  const { showSuccess, showError, showWarning, showConfirm } = useAppMessage();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceList, setAttendanceList] = useState<ManagerAttendanceRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE'>('ALL');

  // Company & Branch Filter State
  const [companies, setCompanies] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);

  // Reject Modal State
  const [rejectingItem, setRejectingItem] = useState<{ item: ManagerAttendanceRow; type: 'check_in' | 'check_out' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // View Details Modal State
  const [selectedRecord, setSelectedRecord] = useState<ManagerAttendanceRow | null>(null);

  const formatLateDuration = (minutes: number) => {
    if (!minutes || minutes <= 0) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `+${h}h ${m}m late`;
    if (h > 0) return `+${h}h late`;
    return `+${m}m late`;
  };

  useEffect(() => {
    fetchCompanies()
      .then((data) => setCompanies(Array.isArray(data) ? data : []))
      .catch((err) => console.log('Failed to fetch companies:', err));

    fetchBranches()
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch((err) => console.log('Failed to fetch branches:', err));
  }, []);

  const loadAttendance = useCallback(async (dateStr: string, companyId?: number | null, branchId?: number | null) => {
    try {
      setLoading(true);
      const data = await getManagerTeamAttendance(dateStr, companyId, branchId);
      setAttendanceList(data?.team_attendance || []);
      setSummary(data?.summary || null);
    } catch (error) {
      console.error('Failed to load team attendance:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance(selectedDate, selectedCompany, selectedBranch);
  }, [selectedDate, selectedCompany, selectedBranch, loadAttendance]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAttendance(selectedDate, selectedCompany, selectedBranch);
  };

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleApprovePunch = async (item: ManagerAttendanceRow, type: 'check_in' | 'check_out') => {
    if (!item.attendance_id) {
      showWarning('Notice', 'No attendance punch record found to approve.');
      return;
    }
    const label = type === 'check_in' ? 'Check In' : 'Check Out';
    try {
      setActionLoading(true);
      await approveAttendanceRecord(item.attendance_id, type);
      showSuccess('Success', `${label} for ${item.full_name} approved!`);
      loadAttendance(selectedDate);
    } catch (err: any) {
      showError(err?.message || `Failed to approve ${label.toLowerCase()}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReject = (item: ManagerAttendanceRow, type: 'check_in' | 'check_out') => {
    if (!item.attendance_id) {
      showWarning('Notice', 'No attendance punch record found to reject.');
      return;
    }
    setRejectingItem({ item, type });
    setRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem?.item?.attendance_id) return;
    const { item, type } = rejectingItem;
    const attendanceId = item.attendance_id;
    if (!attendanceId) return;

    if (!rejectReason.trim()) {
      showWarning('Validation Error', 'Please provide a reason for rejection.');
      return;
    }
    const label = type === 'check_in' ? 'Check In' : 'Check Out';
    try {
      setActionLoading(true);
      await rejectAttendanceRecord(attendanceId, rejectReason.trim(), type);
      showSuccess('Success', `${label} for ${item.full_name} rejected.`);
      setRejectingItem(null);
      setRejectReason('');
      loadAttendance(selectedDate);
    } catch (err: any) {
      showError(err?.message || `Failed to reject ${label.toLowerCase()}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUndoPunch = async (item: ManagerAttendanceRow, type: 'check_in' | 'check_out') => {
    if (!item.attendance_id) return;
    const attendanceId = item.attendance_id;
    const label = type === 'check_in' ? 'Check In' : 'Check Out';
    showConfirm({
      title: 'Undo Approval',
      message: `Revert ${label} decision for ${item.full_name} back to Pending?`,
      confirmText: 'Undo',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setActionLoading(true);
          await undoAttendanceRecord(attendanceId, type);
          showSuccess('Success', `${label} status reverted to pending.`);
          loadAttendance(selectedDate);
        } catch (err: any) {
          showError(err?.message || `Failed to undo ${label.toLowerCase()}.`);
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const filteredBranches = branches.filter((b) => {
    if (!selectedCompany) return true;
    return String(b.company) === String(selectedCompany) || String(b.company_id) === String(selectedCompany);
  });

  const filteredList = attendanceList.filter((row) => {
    const matchesSearch =
      !searchQuery ||
      row.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.employee_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.department?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCompany =
      !selectedCompany ||
      (row.company_id && Number(row.company_id) === Number(selectedCompany));

    const matchesBranch =
      !selectedBranch ||
      (row.branch_id && Number(row.branch_id) === Number(selectedBranch));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PRESENT' && (row.calculated_status === 'PRESENT' || row.calculated_status === 'HALF_DAY')) ||
      (statusFilter === 'LATE' && row.calculated_status === 'LATE') ||
      (statusFilter === 'ABSENT' && row.calculated_status === 'ABSENT') ||
      (statusFilter === 'ON_LEAVE' && (row.calculated_status === 'ON_LEAVE' || row.calculated_status === 'HOLIDAY'));

    return matchesSearch && matchesCompany && matchesBranch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return '#059669';
      case 'LATE':
        return '#D97706';
      case 'ABSENT':
        return '#DC2626';
      case 'ON_LEAVE':
        return '#7C3AED';
      case 'HOLIDAY':
        return '#22C55E';
      case 'WEEKLY_OFF':
        return '#4B5563';
      case 'HALF_DAY':
        return '#EA580C';
      default:
        return '#6B7280';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return '#ECFDF5';
      case 'LATE':
        return '#FFFBEB';
      case 'ABSENT':
        return '#FEF2F2';
      case 'ON_LEAVE':
        return '#F5F3FF';
      case 'HOLIDAY':
        return '#F0F9FF';
      case 'WEEKLY_OFF':
        return '#F3F4F6';
      case 'HALF_DAY':
        return '#F0FDF4';
      default:
        return '#F9FAFB';
    }
  };

  const renderApprovalBadge = (status?: string | null) => {
    const s = status || 'PENDING';
    const isApproved = s === 'APPROVED';
    const isRejected = s === 'REJECTED';
    return (
      <View
        style={[
          styles.punchApprovalPill,
          isApproved && styles.pillApproved,
          isRejected && styles.pillRejected,
          !isApproved && !isRejected && styles.pillPending,
        ]}
      >
        <Text
          style={[
            styles.punchApprovalPillText,
            isApproved && { color: '#16A34A' },
            isRejected && { color: '#DC2626' },
            !isApproved && !isRejected && { color: '#D97706' },
          ]}
        >
          {s}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ManagerAttendanceRow }) => {
    const statusColor = getStatusColor(item.calculated_status);
    const statusBg = getStatusBg(item.calculated_status);
    const photoUrl = resolveMediaUrl(item.profile_photo);

    const inApproved = item.check_in_approval_status === 'APPROVED';
    const outApproved = item.check_out_approval_status === 'APPROVED';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: '#E2E8F0' }]}>
                <Text style={styles.avatarText}>
                  {item.full_name?.charAt(0)?.toUpperCase() || 'E'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.empInfo}>
            <Text style={styles.empName}>{item.full_name}</Text>
            <Text style={styles.empCode}>
              {item.employee_code} • {item.designation || 'Staff'}
            </Text>
            {item.department ? (
              <Text style={styles.empDept}>{item.department}</Text>
            ) : null}
          </View>

          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {item.calculated_status.replace('_', ' ')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewDetailsBtn}
              onPress={() => setSelectedRecord(item)}
              activeOpacity={0.7}
            >
              <Eye size={12} color="#0284C7" />
              <Text style={styles.viewDetailsBtnText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CHECK IN CARD BLOCK */}
        <View style={styles.punchBlock}>
          <View style={styles.punchHeader}>
            <View style={styles.punchTypeLeft}>
              <LogIn size={15} color="#22C55E" />
              <Text style={styles.punchTypeTitle}>Check In</Text>
              <Text style={styles.punchTimeText}>
                {formatAttendanceTime(item.check_in_time || item.check_in)}
              </Text>
              {item.late_minutes > 0 ? (
                <View style={styles.lateTag}>
                  <Text style={styles.lateTagText}>{formatLateDuration(item.late_minutes)}</Text>
                </View>
              ) : null}
            </View>
            {item.check_in ? renderApprovalBadge(item.check_in_approval_status) : null}
          </View>

          {Boolean(item.check_in_location_name) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
              <MapPin size={11} color="#22C55E" />
              <Text style={{ fontSize: 11, color: '#475569', fontFamily: 'Comfortaa_500Medium', flex: 1 }} numberOfLines={1}>
                {item.check_in_location_name}
              </Text>
            </View>
          )}

          {item.check_in_rejection_reason ? (
            <Text style={styles.rejectionReasonText}>Reason: {item.check_in_rejection_reason}</Text>
          ) : null}

          {item.attendance_id && item.check_in ? (
            !inApproved && item.check_in_approval_status !== 'REJECTED' ? (
              <View style={styles.punchActionRow}>
                <TouchableOpacity
                  style={[styles.miniActionBtn, styles.miniApproveBtn]}
                  onPress={() => handleApprovePunch(item, 'check_in')}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <CheckCircle size={13} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.miniApproveBtnText}>Approve Check In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.miniActionBtn, styles.miniRejectBtn]}
                  onPress={() => handleOpenReject(item, 'check_in')}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <XCircle size={13} color="#DC2626" strokeWidth={2.2} />
                  <Text style={styles.miniRejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 8 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: '#F1F5F9',
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    gap: 4,
                  }}
                  onPress={() => handleUndoPunch(item, 'check_in')}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <RotateCcw size={12} color="#475569" strokeWidth={2.2} />
                  <Text style={{ color: '#334155', fontSize: 11, fontFamily: 'Comfortaa_700Bold' }}>Undo In Approval</Text>
                </TouchableOpacity>
              </View>
            )
          ) : null}
        </View>

        {/* CHECK OUT CARD BLOCK */}
        <View style={[styles.punchBlock, { marginTop: 8 }]}>
          <View style={styles.punchHeader}>
            <View style={styles.punchTypeLeft}>
              <LogOutIcon size={15} color="#0369A1" />
              <Text style={styles.punchTypeTitle}>Check Out</Text>
              <Text style={styles.punchTimeText}>
                {formatAttendanceTime(item.check_out_time || item.check_out)}
              </Text>
            </View>
            {item.check_out ? renderApprovalBadge(item.check_out_approval_status) : null}
          </View>

          {Boolean(item.check_out_location_name) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
              <MapPin size={11} color="#0369A1" />
              <Text style={{ fontSize: 11, color: '#475569', fontFamily: 'Comfortaa_500Medium', flex: 1 }} numberOfLines={1}>
                {item.check_out_location_name}
              </Text>
            </View>
          )}

          {item.check_out_rejection_reason ? (
            <Text style={styles.rejectionReasonText}>Reason: {item.check_out_rejection_reason}</Text>
          ) : null}

          {item.attendance_id && item.check_out ? (
            !outApproved && item.check_out_approval_status !== 'REJECTED' ? (
              <View style={styles.punchActionRow}>
                <TouchableOpacity
                  style={[styles.miniActionBtn, styles.miniApproveBtn]}
                  onPress={() => handleApprovePunch(item, 'check_out')}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <CheckCircle size={13} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.miniApproveBtnText}>Approve Check Out</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.miniActionBtn, styles.miniRejectBtn]}
                  onPress={() => handleOpenReject(item, 'check_out')}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <XCircle size={13} color="#DC2626" strokeWidth={2.2} />
                  <Text style={styles.miniRejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 8 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: '#F1F5F9',
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    gap: 4,
                  }}
                  onPress={() => handleUndoPunch(item, 'check_out')}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <RotateCcw size={12} color="#475569" strokeWidth={2.2} />
                  <Text style={{ color: '#334155', fontSize: 11, fontFamily: 'Comfortaa_700Bold' }}>Undo Out Approval</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            item.attendance_id && (
              <Text style={styles.noCheckOutText}>Check Out not punched yet</Text>
            )
          )}
        </View>

        {item.status_reason ? (
          <View style={styles.reasonRow}>
            <Text style={styles.reasonText}>Note: {item.status_reason}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" hidden={false} />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ManagerHomeTab')}
          >
            <ArrowLeft size={22} color={colors.textPrimary} strokeWidth={2.2} />
          </TouchableOpacity>
          <View style={styles.headerTextWrapper}>
            <Text style={styles.headerTitle}>Team Attendance</Text>
            <Text style={styles.headerSubtitle}>
              {employee?.company_name || 'My Reporting Team'}
            </Text>
          </View>
        </View>

        {/* Date Selector */}
        <View style={styles.dateSelectorContainer}>
          <TouchableOpacity style={styles.dateArrowBtn} onPress={() => changeDate(-1)}>
            <ChevronLeft size={18} color="#475569" strokeWidth={2.2} />
          </TouchableOpacity>
          <View style={styles.dateDisplay}>
            <Calendar size={14} color={colors.primary} />
            <Text style={styles.dateDisplayText}>{selectedDate}</Text>
          </View>
          <TouchableOpacity style={styles.dateArrowBtn} onPress={() => changeDate(1)}>
            <ChevronRight size={18} color="#475569" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Company & Branch Horizontal Filters */}
      {(companies.length > 0 || branches.length > 0) && (
        <View style={styles.dropdownFiltersWrapper}>
          {companies.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
              <TouchableOpacity
                style={[styles.dropdownChip, !selectedCompany && styles.dropdownChipActive]}
                onPress={() => {
                  setSelectedCompany(null);
                  setSelectedBranch(null);
                }}
              >
                <Building size={13} color={!selectedCompany ? '#FFFFFF' : '#475569'} />
                <Text style={[styles.dropdownChipText, !selectedCompany && styles.dropdownChipTextActive]}>
                  All Companies
                </Text>
              </TouchableOpacity>
              {companies.map((c) => {
                const active = selectedCompany === c.id;
                return (
                  <TouchableOpacity
                    key={`comp-${c.id}`}
                    style={[styles.dropdownChip, active && styles.dropdownChipActive]}
                    onPress={() => {
                      setSelectedCompany(active ? null : c.id);
                      setSelectedBranch(null);
                    }}
                  >
                    <Building size={13} color={active ? '#FFFFFF' : '#475569'} />
                    <Text style={[styles.dropdownChipText, active && styles.dropdownChipTextActive]} numberOfLines={1}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {filteredBranches.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterScrollContent, { marginTop: 6 }]}>
              <TouchableOpacity
                style={[styles.branchChip, !selectedBranch && styles.branchChipActive]}
                onPress={() => setSelectedBranch(null)}
              >
                <MapPin size={12} color={!selectedBranch ? '#FFFFFF' : '#475569'} />
                <Text style={[styles.branchChipText, !selectedBranch && styles.branchChipTextActive]}>
                  All Branches
                </Text>
              </TouchableOpacity>
              {filteredBranches.map((b) => {
                const active = selectedBranch === b.id;
                return (
                  <TouchableOpacity
                    key={`branch-${b.id}`}
                    style={[styles.branchChip, active && styles.branchChipActive]}
                    onPress={() => setSelectedBranch(active ? null : b.id)}
                  >
                    <MapPin size={12} color={active ? '#FFFFFF' : '#475569'} />
                    <Text style={[styles.branchChipText, active && styles.branchChipTextActive]} numberOfLines={1}>
                      {b.branch_name || `Branch ${b.id}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* Summary KPI Badges */}
      {summary ? (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#0F172A' }]}>{summary.total || 0}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#059669' }]}>{summary.present || 0}</Text>
            <Text style={styles.summaryLabel}>Present</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#D97706' }]}>{summary.late || 0}</Text>
            <Text style={styles.summaryLabel}>Late</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#DC2626' }]}>{summary.absent || 0}</Text>
            <Text style={styles.summaryLabel}>Absent</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#7C3AED' }]}>{summary.on_leave || 0}</Text>
            <Text style={styles.summaryLabel}>Leave</Text>
          </View>
        </View>
      ) : null}

      {/* Search & Filters */}
      <View style={styles.searchFilterContainer}>
        <View style={styles.searchBar}>
          <Search size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, code or department..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterChipsRow}>
          {(['ALL', 'PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.chip,
                statusFilter === filter && styles.chipActive,
              ]}
              onPress={() => setStatusFilter(filter)}
            >
              <Text
                style={[
                  styles.chipText,
                  statusFilter === filter && styles.chipTextActive,
                ]}
              >
                {filter === 'ON_LEAVE' ? 'Leave' : filter.charAt(0) + filter.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading team attendance...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => String(item.employee_id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: insets.bottom + 80 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <CalendarCheck size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Attendance Records</Text>
              <Text style={styles.emptySubtitle}>
                No team attendance recorded for {selectedDate}.
              </Text>
            </View>
          }
        />
      )}

      {/* Rejection Modal */}
      <Modal
        visible={!!rejectingItem}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Reject {rejectingItem?.type === 'check_in' ? 'Check In' : 'Check Out'}
              </Text>
              <TouchableOpacity onPress={() => setRejectingItem(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Please enter the reason for rejecting {rejectingItem?.type === 'check_in' ? 'Check In' : 'Check Out'} for {rejectingItem?.item?.full_name}:
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Incorrect location, invalid punch timing..."
              placeholderTextColor="#94A3B8"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectingItem(null)}
                disabled={actionLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleConfirmReject}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Confirm Rejection</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Attendance Details View Modal (Matches HR screen) */}
      <Modal statusBarTranslucent visible={!!selectedRecord} animationType="fade" transparent onRequestClose={() => setSelectedRecord(null)}>
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
              <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
                <View style={styles.modalEmpRow}>
                  <View style={styles.avatarCircle}>
                    {selectedRecord.profile_photo ? (
                      <Image source={{ uri: resolveMediaUrl(selectedRecord.profile_photo)! }} style={styles.avatarCircleImg} />
                    ) : (
                      <Text style={styles.avatarText}>
                        {selectedRecord.full_name?.substring(0, 2).toUpperCase() || 'EM'}
                      </Text>
                    )}
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.empName}>{selectedRecord.full_name}</Text>
                    <Text style={styles.empCode}>
                      {selectedRecord.employee_code} • {selectedRecord.designation || selectedRecord.department || 'Staff'}
                    </Text>
                    {selectedRecord.company_name ? (
                      <Text style={{ fontSize: 11, color: '#0284C7', fontFamily: 'Comfortaa_600SemiBold', marginTop: 2 }}>
                        {selectedRecord.company_name} {selectedRecord.branch_name ? `• ${selectedRecord.branch_name}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{selectedDate}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={[styles.detailValue, { fontFamily: 'Comfortaa_700Bold', color: getStatusColor(selectedRecord.calculated_status) }]}>
                    {selectedRecord.calculated_status.replace('_', ' ')}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Check In</Text>
                  <Text style={styles.detailValue}>
                    {formatAttendanceTime(selectedRecord.check_in_time || selectedRecord.check_in)}
                  </Text>
                </View>

                {Boolean(selectedRecord.check_in_location_name) && (
                  <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                    <Text style={styles.detailLabel}>In Location</Text>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 4 }}>
                      <MapPin size={12} color="#22C55E" style={{ marginTop: 2 }} />
                      <Text style={[styles.detailValue, { flexShrink: 1, textAlign: 'right', color: '#475569' }]}>
                        {selectedRecord.check_in_location_name}
                      </Text>
                    </View>
                  </View>
                )}

                {selectedRecord.late_minutes > 0 && (
                  <View style={[styles.detailRow, { backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8, marginTop: 4, marginBottom: 4 }]}>
                    <Text style={[styles.detailLabel, { color: '#DC2626' }]}>Late</Text>
                    <Text style={[styles.detailValue, { color: '#DC2626', fontFamily: 'Comfortaa_700Bold', flex: 1, textAlign: 'right' }]}>
                      {formatLateDuration(selectedRecord.late_minutes)} {selectedRecord.late_reason ? `(${selectedRecord.late_reason})` : ''}
                    </Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Check Out</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord.check_out_time || selectedRecord.check_out
                      ? formatAttendanceTime(selectedRecord.check_out_time || selectedRecord.check_out)
                      : 'Not punched yet'}
                  </Text>
                </View>

                {Boolean(selectedRecord.check_out_location_name) && (
                  <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                    <Text style={styles.detailLabel}>Out Location</Text>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 4 }}>
                      <MapPin size={12} color="#0369A1" style={{ marginTop: 2 }} />
                      <Text style={[styles.detailValue, { flexShrink: 1, textAlign: 'right', color: '#475569' }]}>
                        {selectedRecord.check_out_location_name}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Working Hours</Text>
                  <Text style={styles.detailValue}>{selectedRecord.working_hours || '--'}</Text>
                </View>

                {/* Punch Photos */}
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

                {/* Punch In / Out Actions in Modal */}
                {selectedRecord.attendance_id && (
                  <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 10 }}>
                    {/* Check In Action Row */}
                    {selectedRecord.check_in && (
                      <View>
                        <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_700Bold', color: '#1E293B', marginBottom: 6 }}>
                          Check In ({selectedRecord.check_in_approval_status || 'PENDING'})
                        </Text>
                        {selectedRecord.check_in_approval_status !== 'APPROVED' && selectedRecord.check_in_approval_status !== 'REJECTED' ? (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={[styles.miniActionBtn, styles.miniApproveBtn, { flex: 1, paddingVertical: 8 }]}
                              onPress={() => {
                                handleApprovePunch(selectedRecord, 'check_in');
                                setSelectedRecord(null);
                              }}
                              disabled={actionLoading}
                            >
                              <CheckCircle size={13} color="#FFFFFF" strokeWidth={2.2} />
                              <Text style={styles.miniApproveBtnText}>Approve In</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.miniActionBtn, styles.miniRejectBtn, { flex: 1, paddingVertical: 8 }]}
                              onPress={() => {
                                const cur = selectedRecord;
                                setSelectedRecord(null);
                                handleOpenReject(cur, 'check_in');
                              }}
                              disabled={actionLoading}
                            >
                              <XCircle size={13} color="#DC2626" strokeWidth={2.2} />
                              <Text style={styles.miniRejectBtnText}>Reject In</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.miniActionBtn, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', paddingVertical: 8, justifyContent: 'center' }]}
                            onPress={() => {
                              handleUndoPunch(selectedRecord, 'check_in');
                              setSelectedRecord(null);
                            }}
                            disabled={actionLoading}
                          >
                            <RotateCcw size={12} color="#475569" strokeWidth={2.2} />
                            <Text style={{ color: '#334155', fontSize: 11, fontFamily: 'Comfortaa_700Bold' }}>Undo In Approval</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Check Out Action Row */}
                    {selectedRecord.check_out && (
                      <View>
                        <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_700Bold', color: '#1E293B', marginBottom: 6 }}>
                          Check Out ({selectedRecord.check_out_approval_status || 'PENDING'})
                        </Text>
                        {selectedRecord.check_out_approval_status !== 'APPROVED' && selectedRecord.check_out_approval_status !== 'REJECTED' ? (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={[styles.miniActionBtn, styles.miniApproveBtn, { flex: 1, paddingVertical: 8 }]}
                              onPress={() => {
                                handleApprovePunch(selectedRecord, 'check_out');
                                setSelectedRecord(null);
                              }}
                              disabled={actionLoading}
                            >
                              <CheckCircle size={13} color="#FFFFFF" strokeWidth={2.2} />
                              <Text style={styles.miniApproveBtnText}>Approve Out</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.miniActionBtn, styles.miniRejectBtn, { flex: 1, paddingVertical: 8 }]}
                              onPress={() => {
                                const cur = selectedRecord;
                                setSelectedRecord(null);
                                handleOpenReject(cur, 'check_out');
                              }}
                              disabled={actionLoading}
                            >
                              <XCircle size={13} color="#DC2626" strokeWidth={2.2} />
                              <Text style={styles.miniRejectBtnText}>Reject Out</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.miniActionBtn, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', paddingVertical: 8, justifyContent: 'center' }]}
                            onPress={() => {
                              handleUndoPunch(selectedRecord, 'check_out');
                              setSelectedRecord(null);
                            }}
                            disabled={actionLoading}
                          >
                            <RotateCcw size={12} color="#475569" strokeWidth={2.2} />
                            <Text style={{ color: '#334155', fontSize: 11, fontFamily: 'Comfortaa_700Bold' }}>Undo Out Approval</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Comfortaa_500Medium',
    marginTop: 2,
  },
  dateSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateArrowBtn: {
    padding: 6,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  dateDisplayText: {
    fontSize: 14,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#0F172A',
  },
  dropdownFiltersWrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterScrollContent: {
    gap: 8,
    alignItems: 'center',
  },
  dropdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownChipActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  dropdownChipText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#475569',
  },
  dropdownChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
  },
  branchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  branchChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  branchChipText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#475569',
  },
  branchChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryVal: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'Comfortaa_500Medium',
    marginTop: 2,
  },
  searchFilterContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Comfortaa_500Medium',
    padding: 0,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  chipActive: {
    backgroundColor: '#22C55E',
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#64748B',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    padding: 14,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarContainer: {
    marginRight: 10,
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#475569',
  },
  empInfo: {
    flex: 1,
  },
  empName: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  empCode: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'Comfortaa_500Medium',
    marginTop: 2,
  },
  empDept: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'Comfortaa_500Medium',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    textTransform: 'uppercase',
  },
  punchBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  punchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  punchTypeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  punchTypeTitle: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  punchTimeText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#22C55E',
    marginLeft: 2,
  },
  lateTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  lateTagText: {
    fontSize: 10,
    color: '#B45309',
    fontFamily: 'Comfortaa_700Bold',
  },
  punchApprovalPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillApproved: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  pillRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  pillPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  punchApprovalPillText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
  },
  punchActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  miniActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  miniApproveBtn: {
    backgroundColor: '#22C55E',
  },
  miniBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.7,
  },
  miniApproveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
  },
  miniRejectBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    maxWidth: 90,
  },
  miniRejectBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
  },
  noCheckOutText: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'Comfortaa_500Medium',
    marginTop: 4,
    fontStyle: 'italic',
  },
  rejectionReasonText: {
    fontSize: 11,
    color: '#DC2626',
    fontFamily: 'Comfortaa_500Medium',
    marginTop: 4,
  },
  reasonRow: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  reasonText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    fontFamily: 'Comfortaa_500Medium',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Comfortaa_500Medium',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Comfortaa_500Medium',
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Comfortaa_500Medium',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    fontFamily: 'Comfortaa_500Medium',
    color: '#0F172A',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#64748B',
  },
  modalSubmitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#FFFFFF',
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F0F9FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  viewDetailsBtnText: {
    fontSize: 10,
    color: '#0284C7',
    fontFamily: 'Comfortaa_700Bold',
  },
  modalEmpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarCircleImg: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#1E293B',
  },
});
