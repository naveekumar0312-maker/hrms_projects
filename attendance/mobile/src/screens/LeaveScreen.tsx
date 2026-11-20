import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CalendarDays,
  ChevronDown,
  Edit2,
  Eye,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';

import EmployeeHeader from './EmployeeHeader';
import { COLORS } from '../constants/theme';
import { useAppMessage } from '../context/MessageContext';
import { DatePicker, DropdownPicker } from '../components/pickers';


import {
  createLeave,
  updateLeave,
  deleteLeave,
  getLeaves,
  getLeaveSummary,
  type LeaveRequest,
  type LeaveSummary,
} from '../services/leavePermissionService';

const LEAVE_TYPES = [
  { label: 'Casual Leave', value: 'CASUAL' },
  { label: 'Sick Leave', value: 'SICK' },
  { label: 'Annual Leave', value: 'ANNUAL' },
  { label: 'Half Day', value: 'HALF_DAY' },
  { label: 'Personal Leave', value: 'PERSONAL' },
  { label: 'Other', value: 'OTHER' },
];

const LeaveScreen = () => {
  const { showSuccess, showError } = useAppMessage();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showTypes, setShowTypes] = useState(false);

  const [leaveType, setLeaveType] = useState('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // View Modal State
  const [viewItem, setViewItem] = useState<LeaveRequest | null>(null);

  // Edit Modal State
  const [editItem, setEditItem] = useState<LeaveRequest | null>(null);
  const [editLeaveType, setEditLeaveType] = useState('CASUAL');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEditModal = (item: LeaveRequest) => {
    setEditItem(item);
    setEditLeaveType(item.leave_type || 'CASUAL');
    setEditStartDate(item.start_date || '');
    setEditEndDate(item.end_date || '');
    setEditReason(item.reason || '');
  };

  const handleSaveEdit = async () => {
    if (!editItem || !editItem.id) return;
    const cleanStartDate = editStartDate.trim();
    const cleanEndDate = editLeaveType === 'HALF_DAY' ? cleanStartDate : editEndDate.trim();
    const cleanReason = editReason.trim();

    if (!cleanStartDate || (editLeaveType !== 'HALF_DAY' && !cleanEndDate)) {
      showError('Validation Error', editLeaveType === 'HALF_DAY' ? 'Please select date.' : 'Please select both start and end date.');
      return;
    }
    if (!cleanReason) {
      showError('Validation Error', 'Please enter reason.');
      return;
    }
    if (cleanEndDate < cleanStartDate) {
      showError('Invalid Period', 'End date cannot be earlier than start date.');
      return;
    }

    try {
      setEditSubmitting(true);
      await updateLeave(editItem.id, {
        leave_type: editLeaveType,
        start_date: cleanStartDate,
        end_date: cleanEndDate,
        reason: cleanReason,
      });
      showSuccess('Updated', 'Leave request updated successfully.');
      setEditItem(null);
      await loadLeaves();
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data?.detail || data?.error || (typeof data === 'object' ? Object.values(data)[0] : null) || 'Failed to update leave.';
      showError('Update Failed', String(Array.isArray(msg) ? msg[0] : msg));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = (item: LeaveRequest) => {
    if (!item.id) return;
    Alert.alert(
      'Delete Leave Request?',
      'Are you sure you want to permanently delete this pending leave request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLeave(item.id!);
              showSuccess('Deleted', 'Leave request deleted successfully.');
              await loadLeaves();
            } catch (err: any) {
              const data = err?.response?.data;
              const msg = data?.detail || data?.error || 'Failed to delete leave.';
              showError('Delete Failed', String(msg));
            }
          },
        },
      ]
    );
  };

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const [leavesData, summaryData] = await Promise.all([
        getLeaves(),
        getLeaveSummary().catch(() => null),
      ]);
      setLeaves(Array.isArray(leavesData) ? leavesData : leavesData?.results || []);
      setSummary(summaryData);
    } catch (error: any) {
      console.error('Failed to load leaves:', error);
      showError('Unable to Load', error?.response?.data?.detail || error?.response?.data?.error || 'Unable to load leave requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const resetForm = () => {
    setLeaveType('CASUAL');
    setStartDate('');
    setEndDate('');
    setReason('');
    setShowTypes(false);
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
  };

  const formatDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDate = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date();
  };

  const getLeaveDays = () => {
    if (leaveType === 'HALF_DAY') {
      return startDate ? 0.5 : 0;
    }

    if (!startDate || !endDate) {
      return 0;
    }

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const difference = end.getTime() - start.getTime();

    return Math.floor(difference / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleSubmit = async () => {
    const cleanStartDate = startDate.trim();
    const cleanEndDate = leaveType === 'HALF_DAY'
      ? startDate.trim()
      : endDate.trim();
    const cleanReason = reason.trim();

    if (!cleanStartDate || (leaveType !== 'HALF_DAY' && !cleanEndDate)) {
      showError('Validation Error', leaveType === 'HALF_DAY' ? 'Please select the half-day date.' : 'Please select both start date and end date.');
      return;
    }

    if (!cleanReason) {
      showError('Validation Error', 'Please enter the reason for your leave.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanStartDate)) {
      showError('Validation Error', 'Please select a valid start date.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanEndDate)) {
      showError('Validation Error', 'Please select a valid end date.');
      return;
    }

    const start = parseDate(cleanStartDate);
    const end = parseDate(cleanEndDate);

    if (end.getTime() < start.getTime()) {
      showError('Invalid Leave Period', 'End date cannot be before the start date.');
      return;
    }

    try {
      setSubmitting(true);

      await createLeave({
        leave_type: leaveType,
        start_date: cleanStartDate,
        end_date: cleanEndDate,
        reason: cleanReason,
      });

      showSuccess('Leave Submitted', 'Leave request submitted successfully.');

      resetForm();
      setShowForm(false);
      await loadLeaves();
    } catch (error: any) {
      console.error('Failed to create leave:', error);

      const responseData = error?.response?.data;

      let message = 'Unable to submit leave request.';

      if (typeof responseData === 'string') {
        message = responseData;
      } else if (responseData?.detail) {
        message = responseData.detail;
      } else if (responseData?.error) {
        message = responseData.error;
      } else if (responseData && typeof responseData === 'object') {
        const firstError = Object.values(responseData)[0];
        if (Array.isArray(firstError)) {
          message = String(firstError[0]);
        } else if (firstError) {
          message = String(firstError);
        }
      }

      showError('Leave Request Failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const getLeaveTypeLabel = (value?: string) => {
    return (
      LEAVE_TYPES.find((item) => item.value === value)?.label ||
      value ||
      '-'
    );
  };

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case 'APPROVED':
        return styles.statusApproved;
      case 'REJECTED':
        return styles.statusRejected;
      default:
        return styles.statusPending;
    }
  };

  const renderLeave = ({ item }: { item: LeaveRequest }) => (
    <View style={styles.leaveCard}>
      <View style={styles.leaveTopRow}>
        <View style={styles.leaveTypeContainer}>
          <View style={styles.iconBox}>
            <CalendarDays size={18} color={COLORS.primary} strokeWidth={2.2} />
          </View>

          <View style={styles.leaveTitleContainer}>
            <Text style={styles.leaveType}>
              {getLeaveTypeLabel(item.leave_type)}
            </Text>
            <Text style={styles.leaveDates}>
              {item.start_date}{item.leave_type === 'HALF_DAY' ? '' : `  ${item.end_date}`}
            </Text>
          </View>
        </View>

        <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
          <Text style={styles.statusText}>
            {item.status || 'PENDING'}
          </Text>
        </View>
      </View>

      {item.reason ? (
        <Text style={styles.reasonText}>{item.reason}</Text>
      ) : null}

      {item.status === 'REJECTED' && item.rejection_reason ? (
        <View style={styles.rejectionBox}>
          <Text style={styles.rejectionLabel}>Rejection reason</Text>
          <Text style={styles.rejectionText}>
            {item.rejection_reason}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardActionsRow}>
        <TouchableOpacity
          style={styles.cardActionBtn}
          onPress={() => setViewItem(item)}
        >
          <Eye size={14} color="#47534C" />
          <Text style={styles.cardActionText}>View</Text>
        </TouchableOpacity>

        {item.status === 'PENDING' ? (
          <>
            <TouchableOpacity
              style={[styles.cardActionBtn, styles.editActionBtn]}
              onPress={() => openEditModal(item)}
            >
              <Edit2 size={14} color="#22C55E" />
              <Text style={[styles.cardActionText, styles.editActionText]}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cardActionBtn, styles.deleteActionBtn]}
              onPress={() => handleDelete(item)}
            >
              <Trash2 size={14} color="#EF4444" />
              <Text style={[styles.cardActionText, styles.deleteActionText]}>Delete</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <EmployeeHeader onApply={() => setShowForm(true)} />

      {showForm ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.formWrapper}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formContent}
          >
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Apply for Leave</Text>

              <Pressable
                onPress={() => {
                  resetForm();
                  setShowForm(false);
                }}
                style={styles.closeButton}
              >
                <X size={20} color="#66736B" strokeWidth={2.2} />
              </Pressable>
            </View>

            <DropdownPicker
              label="Leave Type"
              options={LEAVE_TYPES}
              value={leaveType}
              onChange={(val) => {
                setLeaveType(val);
                if (val === 'HALF_DAY') {
                  setEndDate('');
                }
              }}
              searchable={false}
              required
            />

            <DatePicker
              label={leaveType === 'HALF_DAY' ? 'Half Day Date' : 'Start Date'}
              value={startDate}
              onChange={(selected) => {
                setStartDate(selected);
                if (endDate && endDate < selected) {
                  setEndDate('');
                }
              }}
              placeholder="YYYY-MM-DD"
              required
            />

            {leaveType !== 'HALF_DAY' ? (
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(selected) => {
                  if (startDate && selected < startDate) {
                    showError('Invalid Leave Period', 'End date cannot be before start date.');
                    return;
                  }
                  setEndDate(selected);
                }}
                minDate={startDate || undefined}
                placeholder="YYYY-MM-DD"
                required
              />
            ) : undefined}

            {getLeaveDays() > 0 ? (
              <View style={styles.durationBox}>
                <Text style={styles.durationLabel}>
                  Leave Duration
                </Text>
                <Text style={styles.durationValue}>
                  {getLeaveDays()} {getLeaveDays() === 1 ? 'day' : 'days'}
                </Text>
              </View>
            ) : undefined}

            <Text style={styles.label}>Reason</Text>

            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Enter reason"
              placeholderTextColor="#9AA39D"
              style={[styles.input, styles.reasonInput]}
              multiline
              textAlignVertical="top"
            />

            <Pressable
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Submit Leave Request
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading leave requests...</Text>
        </View>
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={(item, index) =>
            String(item.id ?? `leave-${index}`)
          }
          renderItem={renderLeave}
          ListHeaderComponent={
            summary ? (
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeaderRow}>
                  <View>
                    <Text style={styles.summaryTitle}>Monthly Leave Cycle</Text>
                    <Text style={styles.summarySubtitle}>
                      {summary.cycle.start_date} → {summary.cycle.end_date}
                    </Text>
                  </View>
                  <View style={styles.summaryBadge}>
                    <Text style={styles.summaryBadgeText}>26th–25th</Text>
                  </View>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>APPROVED LEAVE TAKEN IN CYCLE</Text>
                  <Text style={styles.summaryValue}>{summary.cycle.used_days} {summary.cycle.used_days === 1 ? 'day' : 'days'}</Text>
                </View>
              </View>
            ) : undefined
          }
          contentContainerStyle={[
            styles.listContent,
            leaves.length === 0 && styles.emptyListContent,
          ]}
          refreshing={loading}
          onRefresh={loadLeaves}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <CalendarDays size={42} color="#A0AAA3" strokeWidth={2.2} />
              <Text style={styles.emptyTitle}>
                No Leave Requests
              </Text>
              <Text style={styles.emptyText}>
                Your submitted leave requests will appear here.
              </Text>
            </View>
          }
        />
      )}

      {/* VIEW DETAILS MODAL */}
      <Modal
        visible={!!viewItem}
        transparent
        animationType="fade"
        onRequestClose={() => setViewItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Leave Details</Text>
              <TouchableOpacity onPress={() => setViewItem(null)}>
                <X size={20} color="#66736B" />
              </TouchableOpacity>
            </View>

            {viewItem && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Leave Type</Text>
                  <Text style={styles.modalFieldValue}>
                    {getLeaveTypeLabel(viewItem.leave_type)}
                  </Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>
                    {viewItem.leave_type === 'HALF_DAY' ? 'Date' : 'Dates'}
                  </Text>
                  <Text style={styles.modalFieldValue}>
                    {viewItem.start_date}
                    {viewItem.leave_type === 'HALF_DAY' ? '' : ` to ${viewItem.end_date}`}
                  </Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Reason</Text>
                  <Text style={styles.modalFieldValue}>{viewItem.reason}</Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Status</Text>
                  <Text
                    style={[
                      styles.modalFieldValue,
                      {
                        color:
                          viewItem.status === 'APPROVED'
                            ? '#22C55E'
                            : viewItem.status === 'REJECTED'
                            ? '#EF4444'
                            : '#F59E0B',
                        fontFamily: 'Comfortaa_700Bold',
                      },
                    ]}
                  >
                    {viewItem.status || 'PENDING'}
                  </Text>
                </View>

                {viewItem.status === 'REJECTED' && !!viewItem.rejection_reason && (
                  <View style={styles.modalField}>
                    <Text style={[styles.modalFieldLabel, { color: '#EF4444' }]}>
                      Rejection Reason
                    </Text>
                    <Text style={[styles.modalFieldValue, { color: '#991B1B' }]}>
                      {viewItem.rejection_reason}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setViewItem(null)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        visible={!!editItem}
        transparent
        animationType="fade"
        onRequestClose={() => setEditItem(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Leave Request</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <X size={20} color="#66736B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <DropdownPicker
                label="Leave Type"
                options={LEAVE_TYPES}
                value={editLeaveType}
                onChange={(val) => {
                  setEditLeaveType(val);
                  if (val === 'HALF_DAY') setEditEndDate('');
                }}
                searchable={false}
                required
              />

              <DatePicker
                label={editLeaveType === 'HALF_DAY' ? 'Half Day Date' : 'Start Date'}
                value={editStartDate}
                onChange={(selected) => {
                  setEditStartDate(selected);
                  if (editEndDate && editEndDate < selected) setEditEndDate('');
                }}
                placeholder="YYYY-MM-DD"
                required
              />

              {editLeaveType !== 'HALF_DAY' ? (
                <DatePicker
                  label="End Date"
                  value={editEndDate}
                  onChange={(selected) => {
                    if (editStartDate && selected < editStartDate) {
                      showError('Invalid Period', 'End date cannot be earlier than start date.');
                      return;
                    }
                    setEditEndDate(selected);
                  }}
                  minDate={editStartDate || undefined}
                  placeholder="YYYY-MM-DD"
                  required
                />
              ) : null}

              <Text style={styles.label}>Reason</Text>
              <TextInput
                value={editReason}
                onChangeText={setEditReason}
                placeholder="Enter reason"
                placeholderTextColor="#9AA39D"
                style={[styles.input, styles.reasonInput]}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.modalCancelBtn]}
                onPress={() => setEditItem(null)}
                disabled={editSubmitting}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalActionBtn,
                  styles.modalSaveBtn,
                  editSubmitting && { opacity: 0.7 },
                ]}
                onPress={handleSaveEdit}
                disabled={editSubmitting}
              >
                {editSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: COLORS.secondary,
  },
  addButton: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  leaveCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 15,
  },
  leaveTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  leaveTypeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  leaveTitleContainer: {
    flex: 1,
  },
  leaveType: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
  },
  leaveDates: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.secondary,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusPending: {
    backgroundColor: COLORS.surfaceSecondary,
  },
  statusApproved: {
    backgroundColor: COLORS.surfaceSecondary,
  },
  statusRejected: {
    backgroundColor: COLORS.surfaceSecondary,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
    color: '#47534C',
  },
  reasonText: {
    marginTop: 13,
    fontSize: 13,
    lineHeight: 19,
    color: '#47534C',
  },
  rejectionBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 9,
    backgroundColor: COLORS.surfaceSecondary,
  },
  rejectionLabel: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#991B1B',
  },
  rejectionText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: '#7F1D1D',
  },
  formWrapper: {
    flex: 1,
  },
  formContent: {
    padding: 18,
    paddingBottom: 35,
  },
  formHeader: {
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formTitle: {
    fontSize: 20,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 14,
    marginBottom: 7,
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#344139',
  },
  dateInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#DCE3DF',
    borderRadius: 10,
    paddingHorizontal: 13,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: {
    color: COLORS.dark,
    fontSize: 14,
  },
  datePlaceholder: {
    color: '#9AA39D',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#DCE3DF',
    borderRadius: 10,
    paddingHorizontal: 13,
    backgroundColor: '#FFFFFF',
    color: COLORS.dark,
    fontSize: 14,
  },
  reasonInput: {
    minHeight: 105,
    paddingTop: 12,
  },

  durationBox: {
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: 'rgba(0, 86, 179, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  durationLabel: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#344139',
  },

  durationValue: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  select: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#DCE3DF',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    color: COLORS.dark,
    fontSize: 14,
  },
  dropdown: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#DCE3DF',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1EF',
  },
  dropdownText: {
    fontSize: 14,
    color: COLORS.dark,
  },
  submitButton: {
    minHeight: 50,
    marginTop: 22,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.secondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: '#344139',
  },
  emptyText: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: '#7A857E',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  summaryBadge: {
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  summaryBadgeText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.success,
  },
  summaryBox: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#666666',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 22,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.primary,
    marginTop: 4,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F3F1',
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCE3DF',
    backgroundColor: '#FFFFFF',
  },
  cardActionText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#47534C',
  },
  editActionBtn: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  editActionText: {
    color: '#22C55E',
  },
  deleteActionBtn: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  deleteActionText: {
    color: '#EF4444',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F1',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
  },
  modalBody: {
    marginTop: 14,
    maxHeight: 380,
  },
  modalField: {
    marginBottom: 12,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#66736B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  modalFieldValue: {
    fontSize: 14,
    color: COLORS.dark,
  },
  modalCloseBtn: {
    marginTop: 16,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#F0F3F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#47534C',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalActionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#F0F3F1',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#47534C',
  },
  modalSaveBtn: {
    backgroundColor: COLORS.primary,
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#FFFFFF',
  },
});

export default LeaveScreen;













