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
  Clock3,
  Edit2,
  Eye,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { formatAttendanceTime } from '../utils/dateUtils';

import EmployeeHeader from './EmployeeHeader';
import { COLORS } from '../constants/theme';
import { useAppMessage } from '../context/MessageContext';
import { DatePicker, DropdownPicker, TimePicker } from '../components/pickers';

import {
  createPermission,
  updatePermission,
  deletePermission,
  getPermissions,
  getPermissionSummary,
  type PermissionRequest,
  type PermissionSummary,
} from '../services/leavePermissionService';

const DURATION_OPTIONS = [30, 60];

const PermissionScreen = () => {
  const { showSuccess, showError } = useAppMessage();
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [summary, setSummary] = useState<PermissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // View Modal State
  const [viewItem, setViewItem] = useState<PermissionRequest | null>(null);

  // Edit Modal State
  const [editItem, setEditItem] = useState<PermissionRequest | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editDuration, setEditDuration] = useState(30);
  const [editReason, setEditReason] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEditModal = (item: PermissionRequest) => {
    setEditItem(item);
    setEditDate(item.date || '');
    setEditStartTime(item.start_time || '');
    setEditEndTime(item.end_time || '');
    setEditDuration(item.duration_minutes || 30);
    setEditReason(item.reason || '');
  };

  const handleEditStartTimeChange = (val: string) => {
    setEditStartTime(val);
    if (val && /^\d{2}:\d{2}/.test(val)) {
      const [h, m] = val.split(':').map(Number);
      const totalMinutes = h * 60 + m + editDuration;
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      setEditEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`);
    }
  };

  const handleEditDurationChange = (minutes: number) => {
    setEditDuration(minutes);
    if (editStartTime && /^\d{2}:\d{2}/.test(editStartTime)) {
      const [h, m] = editStartTime.split(':').map(Number);
      const totalMinutes = h * 60 + m + minutes;
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      setEditEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`);
    }
  };

  const handleSaveEdit = async () => {
    if (!editItem || !editItem.id) return;
    if (!editDate.trim()) {
      showError('Validation Error', 'Please enter permission date.');
      return;
    }
    if (!editReason.trim()) {
      showError('Validation Error', 'Please enter reason.');
      return;
    }
    try {
      setEditSubmitting(true);
      await updatePermission(editItem.id, {
        date: editDate.trim(),
        duration_minutes: editDuration,
        start_time: editStartTime ? editStartTime.substring(0, 8) : undefined,
        end_time: editEndTime ? editEndTime.substring(0, 8) : undefined,
        reason: editReason.trim(),
      });
      showSuccess('Updated', 'Permission request updated successfully.');
      setEditItem(null);
      await loadPermissions();
      await loadPermissionSummary();
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data?.detail || data?.error || (typeof data === 'object' ? Object.values(data)[0] : null) || 'Failed to update permission.';
      showError('Update Failed', String(Array.isArray(msg) ? msg[0] : msg));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = (item: PermissionRequest) => {
    if (!item.id) return;
    Alert.alert(
      'Delete Permission Request?',
      'Are you sure you want to permanently delete this pending permission request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePermission(item.id!);
              showSuccess('Deleted', 'Permission request deleted successfully.');
              await loadPermissions();
              await loadPermissionSummary();
            } catch (err: any) {
              const data = err?.response?.data;
              const msg = data?.detail || data?.error || 'Failed to delete permission.';
              showError('Delete Failed', String(msg));
            }
          },
        },
      ]
    );
  };

  const loadPermissionSummary = async (selectedDate?: string) => {
    try {
      setSummaryLoading(true);
      const data = await getPermissionSummary(selectedDate);
      setSummary(data);
    } catch (error: any) {
      console.error('Failed to load permission summary:', error);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      setLoading(true);

      const data = await getPermissions();

      setPermissions(
        Array.isArray(data) ? data : data?.results || []
      );
    } catch (error: any) {
      console.error('Failed to load permissions:', error);

      showError('Unable to Load', error?.response?.data?.detail || error?.response?.data?.error || 'Unable to load permission requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
    loadPermissionSummary();
  }, []);

  const resetForm = () => {
    setDate('');
    setStartTime('');
    setEndTime('');
    setDuration(30);
    setReason('');
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

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    if (val && /^\d{2}:\d{2}/.test(val)) {
      const [h, m] = val.split(':').map(Number);
      const totalMinutes = h * 60 + m + duration;
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      const formattedEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
      setEndTime(formattedEnd);
    }
  };

  const handleDurationChange = (minutes: number) => {
    setDuration(minutes);
    if (startTime && /^\d{2}:\d{2}/.test(startTime)) {
      const [h, m] = startTime.split(':').map(Number);
      const totalMinutes = h * 60 + m + minutes;
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      const formattedEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
      setEndTime(formattedEnd);
    }
  };

  const handleSubmit = async () => {
    if (!date.trim()) {
      showError('Validation Error', 'Please enter the permission date.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      showError('Validation Error', 'Use date format YYYY-MM-DD.');
      return;
    }

    if (!reason.trim()) {
      showError('Validation Error', 'Please enter the reason.');
      return;
    }

    try {
      setSubmitting(true);

      await createPermission({
        date: date.trim(),
        duration_minutes: duration,
        start_time: startTime ? startTime.substring(0, 8) : undefined,
        end_time: endTime ? endTime.substring(0, 8) : undefined,
        reason: reason.trim(),
      });

      showSuccess('Permission Submitted', 'Permission request submitted successfully.');

      resetForm();
      setShowForm(false);
      await loadPermissions();
      await loadPermissionSummary(date.trim());
    } catch (error: any) {
      console.error('Failed to create permission:', error);

      const responseData = error?.response?.data;

      let message = 'Unable to submit permission request.';

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

      showError('Permission Request Failed', message);
    } finally {
      setSubmitting(false);
    }
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

  const renderPermission = ({
    item,
  }: {
    item: PermissionRequest;
  }) => (
    <View style={styles.permissionCard}>
      <View style={styles.topRow}>
        <View style={styles.titleSection}>
          <View style={styles.iconBox}>
            <Clock3 size={18} color={COLORS.primary} strokeWidth={2.2} />
          </View>

          <View style={styles.titleText}>
            <Text style={styles.permissionTitle}>
              {item.duration_minutes} Minutes Permission
            </Text>

            <Text style={styles.permissionDate}>
              {item.date}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            getStatusStyle(item.status),
          ]}
        >
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
          <Text style={styles.rejectionLabel}>
            Rejection reason
          </Text>

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

      {summaryLoading ? (
        <View style={styles.summaryCard}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.summaryLoadingText}>
            Loading permission balance...
          </Text>
        </View>
      ) : summary ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <View>
              <Text style={styles.summaryTitle}>
                Permission Balance
              </Text>

              <Text style={styles.summarySubtitle}>
                {summary.date}
              </Text>
            </View>

            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                ACTIVE
              </Text>
            </View>
          </View>

          <View style={styles.summaryBoxes}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                TODAY
              </Text>

              <Text style={styles.summaryRemaining}>
                {summary.daily.remaining_minutes} min
              </Text>

              <Text style={styles.summaryMeta}>
                {summary.daily.used_minutes} min used
              </Text>

              <Text style={styles.summaryLimit}>
                Limit: {summary.daily.limit_minutes} min
              </Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                ATTENDANCE CYCLE
              </Text>

              <Text style={styles.summaryRemaining}>
                {summary.cycle.remaining_minutes} min
              </Text>

              <Text style={styles.summaryMeta}>
                {summary.cycle.used_minutes} min used
              </Text>

              <Text style={styles.summaryLimit}>
                Limit: {summary.cycle.limit_minutes} min
              </Text>
            </View>
          </View>

          <View style={styles.cycleInfo}>
            <Text style={styles.cycleInfoText}>
              Cycle: {summary.cycle.start_date}  {summary.cycle.end_date}
            </Text>
          </View>
        </View>
      ) : null}

      {showForm ? (
        <KeyboardAvoidingView
          behavior={
            Platform.OS === 'ios' ? 'padding' : undefined
          }
          style={styles.formWrapper}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formContent}
          >
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                Apply for Permission
              </Text>

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

            <DatePicker
              label="Date"
              value={date}
              onChange={(selected) => {
                setDate(selected);
                loadPermissionSummary(selected);
              }}
              placeholder="YYYY-MM-DD"
              required
            />

            <Text style={styles.label}>Duration</Text>

            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((minutes) => {
                const selected = duration === minutes;

                return (
                  <Pressable
                    key={minutes}
                    style={[
                      styles.durationButton,
                      selected &&
                        styles.durationButtonSelected,
                    ]}
                    onPress={() => handleDurationChange(minutes)}
                  >
                    <Clock3
                      size={16}
                      color={
                        selected ? '#FFFFFF' : '#66736B'
                      } strokeWidth={2.2} />

                    <Text
                      style={[
                        styles.durationText,
                        selected &&
                          styles.durationTextSelected,
                      ]}
                    >
                      {minutes} Minutes
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <TimePicker
                  label="Start Time"
                  value={startTime}
                  onChange={handleStartTimeChange}
                  placeholder="Select Start"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TimePicker
                  label="End Time"
                  value={endTime}
                  onChange={(val) => setEndTime(val)}
                  placeholder="Select End"
                />
              </View>
            </View>

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
                submitting &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Submit Permission Request
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text style={styles.loadingText}>
            Loading permission requests...
          </Text>
        </View>
      ) : (
        <FlatList
          data={permissions}
          keyExtractor={(item, index) =>
            String(
              item.id ?? `permission-${index}`
            )
          }
          renderItem={renderPermission}
          contentContainerStyle={[
            styles.listContent,
            permissions.length === 0 &&
              styles.emptyListContent,
          ]}
          refreshing={loading}
          onRefresh={loadPermissions}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Clock3 size={42} color="#A0AAA3" strokeWidth={2.2} />

              <Text style={styles.emptyTitle}>
                No Permission Requests
              </Text>

              <Text style={styles.emptyText}>
                Your submitted permission requests will
                appear here.
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
              <Text style={styles.modalTitle}>Permission Details</Text>
              <TouchableOpacity onPress={() => setViewItem(null)}>
                <X size={20} color="#66736B" />
              </TouchableOpacity>
            </View>

            {viewItem && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Date</Text>
                  <Text style={styles.modalFieldValue}>{viewItem.date}</Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Start Time</Text>
                  <Text style={styles.modalFieldValue}>
                    {formatAttendanceTime(viewItem.start_time)}
                  </Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>End Time</Text>
                  <Text style={styles.modalFieldValue}>
                    {formatAttendanceTime(viewItem.end_time)}
                  </Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Duration</Text>
                  <Text style={styles.modalFieldValue}>
                    {viewItem.duration_minutes} minutes
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
              <Text style={styles.modalTitle}>Edit Permission</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <X size={20} color="#66736B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <DatePicker
                label="Date"
                value={editDate}
                onChange={setEditDate}
                placeholder="YYYY-MM-DD"
                required
              />

              <Text style={styles.label}>Duration</Text>
              <View style={styles.durationRow}>
                {DURATION_OPTIONS.map((minutes) => {
                  const selected = editDuration === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      style={[
                        styles.durationButton,
                        selected && styles.durationButtonSelected,
                      ]}
                      onPress={() => handleEditDurationChange(minutes)}
                    >
                      <Clock3
                        size={16}
                        color={selected ? '#FFFFFF' : '#66736B'}
                        strokeWidth={2.2}
                      />
                      <Text
                        style={[
                          styles.durationText,
                          selected && styles.durationTextSelected,
                        ]}
                      >
                        {minutes} Minutes
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <TimePicker
                    label="Start Time"
                    value={editStartTime}
                    onChange={handleEditStartTimeChange}
                    placeholder="Select Start"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TimePicker
                    label="End Time"
                    value={editEndTime}
                    onChange={(val) => setEditEndTime(val)}
                    placeholder="Select End"
                  />
                </View>
              </View>

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
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  summaryLoadingText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    color: COLORS.secondary,
  },

  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  summaryTitle: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
  },

  summarySubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.secondary,
  },

  summaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
  },

  summaryBadgeText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },

  summaryBoxes: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  summaryBox: {
    flex: 1,
    padding: 13,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  summaryLabel: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.secondary,
    letterSpacing: 0.5,
  },

  summaryRemaining: {
    marginTop: 7,
    fontSize: 22,
    fontFamily: 'Comfortaa_700Bold',
    color: '#3F7D20',
  },

  summaryMeta: {
    marginTop: 3,
    fontSize: 11,
    color: '#555555',
  },

  summaryLimit: {
    marginTop: 3,
    fontSize: 10,
    color: '#999999',
  },

  cycleInfo: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#D9F99D',
  },

  cycleInfoText: {
    fontSize: 11,
    color: '#777777',
    textAlign: 'center',
  },


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
  permissionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 15,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleSection: {
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
  titleText: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
  },
  permissionDate: {
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
  durationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#DCE3DF',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  durationButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  durationText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: COLORS.secondary,
  },
  durationTextSelected: {
    color: '#FFFFFF',
  },
  reasonInput: {
    minHeight: 105,
    paddingTop: 12,
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

export default PermissionScreen;






