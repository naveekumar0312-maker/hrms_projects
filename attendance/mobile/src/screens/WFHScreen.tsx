import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { CalendarDays, Plus, X, House } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmployeeHeader from './EmployeeHeader';
import { COLORS } from '../constants/theme';
import { useAppMessage } from '../context/MessageContext';
import { DatePicker } from '../components/pickers';
import {
  createWFHRequest,
  getWFHRequests,
  type WFHRequest,
  type WFHStatus,
} from '../services/wfhService';

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value?: string) => {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date();
};

const getErrorMessage = (error: any) => {
  const data = error?.response?.data;

  if (typeof data === 'string') return data;
  if (data?.detail) return String(data.detail);
  if (data?.error) return String(data.error);

  if (data && typeof data === 'object') {
    const firstError = Object.values(data)[0];
    if (Array.isArray(firstError)) return String(firstError[0]);
    if (firstError) return String(firstError);
  }

  return 'Please check your connection and try again.';
};

const WFHScreen = () => {
  const { showSuccess, showError } = useAppMessage();
  const [requests, setRequests] = useState<WFHRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getWFHRequests();
      setRequests(Array.isArray(data) ? data : data?.results || []);
    } catch (error: any) {
      console.error('Failed to load WFH requests:', error);
      showError('Unable to Load', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const resetForm = () => {
    setDate('');
    setReason('');
    setShowDatePicker(false);
  };

  const handleSubmit = async () => {
    const cleanDate = date.trim();
    const cleanReason = reason.trim();

    if (!cleanDate) {
      showError('Validation Error', 'Please select your WFH date.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      showError('Validation Error', 'Please select a valid WFH date.');
      return;
    }

    if (!cleanReason) {
      showError('Validation Error', 'Please enter the reason for working from home.');
      return;
    }

    try {
      setSubmitting(true);

      await createWFHRequest({
        date: cleanDate,
        reason: cleanReason,
      });

      resetForm();
      setShowForm(false);
      await loadRequests();

      showSuccess('WFH Submitted', 'Your WFH request has been submitted successfully.');
    } catch (error: any) {
      console.error('Failed to submit WFH request:', error);
      showError('WFH Request Failed', getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStyle = (status?: WFHStatus) => {
    switch (status) {
      case 'APPROVED':
        return styles.statusApproved;
      case 'REJECTED':
        return styles.statusRejected;
      default:
        return styles.statusPending;
    }
  };

  const renderRequest = ({ item }: { item: WFHRequest }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestTopRow}>
        <View style={styles.requestInfo}>
          <View style={styles.iconBox}>
            <House size={19} color={COLORS.primary} strokeWidth={2.2} />
          </View>

          <View style={styles.requestTitleContainer}>
            <Text style={styles.requestTitle}>Work From Home</Text>
            <Text style={styles.requestDate}>{item.date}</Text>
          </View>
        </View>

        <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
          <Text style={styles.statusText}>{item.status || 'PENDING'}</Text>
        </View>
      </View>

      {!!item.reason && (
        <Text style={styles.reasonText}>{item.reason}</Text>
      )}

      {item.status === 'REJECTED' && !!item.rejection_reason && (
        <View style={styles.rejectionBox}>
          <Text style={styles.rejectionLabel}>Rejection reason</Text>
          <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
        </View>
      )}

      {item.status === 'APPROVED' && !!item.approved_by_name && (
        <Text style={styles.approvedBy}>
          Approved by {item.approved_by_name}
        </Text>
      )}
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
              <Text style={styles.formTitle}>Apply for WFH</Text>

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
              label="WFH Date"
              value={date}
              onChange={(selected) => setDate(selected)}
              placeholder="Select date"
              minDate={new Date().toISOString().split('T')[0]}
              required
            />

            <Text style={styles.label}>Reason</Text>

            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Enter reason for working from home"
              placeholderTextColor="#9AA39D"
              style={styles.reasonInput}
              multiline
              textAlignVertical="top"
              maxLength={1000}
            />

            <Pressable
              style={[styles.submitButton, submitting && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit WFH Request</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading WFH requests...</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item, index) => String(item.id ?? `wfh-${index}`)}
          renderItem={renderRequest}
          contentContainerStyle={[
            styles.listContent,
            requests.length === 0 && styles.emptyListContent,
          ]}
          refreshing={loading}
          onRefresh={loadRequests}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View>
                <Text style={styles.listTitle}>My WFH Requests</Text>
                <Text style={styles.listSubtitle}>
                  View your submitted requests and their status.
                </Text>
              </View>
              <Pressable
                style={styles.newRequestButton}
                onPress={() => setShowForm(true)}
              >
                <Plus size={17} color="#FFFFFF" />
                <Text style={styles.newRequestText}>Apply</Text>
              </Pressable>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <House size={42} color="#A0AAA3" strokeWidth={2.2} />
              <Text style={styles.emptyTitle}>No WFH Requests</Text>
              <Text style={styles.emptyText}>
                Your submitted work-from-home requests will appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  formWrapper: { flex: 1 },
  formContent: { padding: 18, paddingBottom: 35 },
  formHeader: {
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formTitle: { fontSize: 20, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
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
  dateInputText: { color: COLORS.dark, fontSize: 14 },
  placeholder: { color: '#9AA39D' },
  reasonInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#DCE3DF',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    color: COLORS.dark,
    fontSize: 14,
  },
  submitButton: {
    minHeight: 50,
    marginTop: 22,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: { opacity: 0.65 },
  submitButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Comfortaa_700Bold', },
  listContent: { padding: 16, gap: 12 },
  emptyListContent: { flexGrow: 1 },
  listHeader: {
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  listTitle: { fontSize: 20, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  listSubtitle: { marginTop: 4, fontSize: 12, color: COLORS.secondary },
  newRequestButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newRequestText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Comfortaa_700Bold', },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 15,
  },
  requestTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  requestInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  requestTitleContainer: { flex: 1 },
  requestTitle: { fontSize: 15, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  requestDate: { marginTop: 4, fontSize: 12, color: COLORS.secondary },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  statusPending: { backgroundColor: COLORS.surfaceSecondary },
  statusApproved: { backgroundColor: COLORS.surfaceSecondary },
  statusRejected: { backgroundColor: COLORS.surfaceSecondary },
  statusText: { fontSize: 10, fontFamily: 'Comfortaa_700Bold', color: '#47534C' },
  reasonText: { marginTop: 13, fontSize: 13, lineHeight: 19, color: '#47534C' },
  rejectionBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 9,
    backgroundColor: COLORS.surfaceSecondary,
  },
  rejectionLabel: { fontSize: 11, fontFamily: 'Comfortaa_700Bold', color: '#991B1B' },
  rejectionText: { marginTop: 3, fontSize: 12, lineHeight: 17, color: '#7F1D1D' },
  approvedBy: { marginTop: 10, fontSize: 12, color: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25 },
  loadingText: { marginTop: 10, fontSize: 13, color: COLORS.secondary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 35, paddingVertical: 40 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontFamily: 'Comfortaa_700Bold', color: '#344139' },
  emptyText: { marginTop: 6, textAlign: 'center', fontSize: 13, lineHeight: 19, color: '#7A857E' },
});

export default WFHScreen;
