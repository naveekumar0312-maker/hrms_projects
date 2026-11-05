import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Clock3,
  Plus,
  X,
} from 'lucide-react-native';

import EmployeeHeader from './EmployeeHeader';
import { COLORS } from '../constants/theme';
import { useAppMessage } from '../context/MessageContext';
import { DatePicker, DropdownPicker } from '../components/pickers';

import {
  createPermission,
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
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

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
                    onPress={() => setDuration(minutes)}
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
});

export default PermissionScreen;






