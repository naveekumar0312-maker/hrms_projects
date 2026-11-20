import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { CalendarDays, Edit2, Eye, Plus, Trash2, X, House } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmployeeHeader from './EmployeeHeader';
import { COLORS } from '../constants/theme';
import { useAppMessage } from '../context/MessageContext';
import { DatePicker } from '../components/pickers';
import {
  createWFHRequest,
  updateWFHRequest,
  deleteWFHRequest,
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

  // View Modal State
  const [viewItem, setViewItem] = useState<WFHRequest | null>(null);

  // Edit Modal State
  const [editItem, setEditItem] = useState<WFHRequest | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEditModal = (item: WFHRequest) => {
    setEditItem(item);
    setEditDate(item.date || '');
    setEditReason(item.reason || '');
  };

  const handleSaveEdit = async () => {
    if (!editItem || !editItem.id) return;
    const cleanDate = editDate.trim();
    const cleanReason = editReason.trim();

    if (!cleanDate) {
      showError('Validation Error', 'Please select WFH date.');
      return;
    }
    if (!cleanReason) {
      showError('Validation Error', 'Please enter reason for working from home.');
      return;
    }

    try {
      setEditSubmitting(true);
      await updateWFHRequest(editItem.id, {
        date: cleanDate,
        reason: cleanReason,
      });
      showSuccess('Updated', 'WFH request updated successfully.');
      setEditItem(null);
      await loadRequests();
    } catch (err: any) {
      console.error('Failed to update WFH request:', err);
      showError('Update Failed', getErrorMessage(err));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = (item: WFHRequest) => {
    if (!item.id) return;
    Alert.alert(
      'Delete WFH Request?',
      'Are you sure you want to permanently delete this pending WFH request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWFHRequest(item.id);
              showSuccess('Deleted', 'WFH request deleted successfully.');
              await loadRequests();
            } catch (err: any) {
              console.error('Failed to delete WFH request:', err);
              showError('Delete Failed', getErrorMessage(err));
            }
          },
        },
      ]
    );
  };

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
              <Text style={styles.modalTitle}>WFH Details</Text>
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

                {viewItem.status === 'APPROVED' && !!viewItem.approved_by_name && (
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>Approved By</Text>
                    <Text style={styles.modalFieldValue}>{viewItem.approved_by_name}</Text>
                  </View>
                )}

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
              <Text style={styles.modalTitle}>Edit WFH Request</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <X size={20} color="#66736B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <DatePicker
                label="WFH Date"
                value={editDate}
                onChange={setEditDate}
                placeholder="YYYY-MM-DD"
                required
              />

              <Text style={styles.label}>Reason</Text>
              <TextInput
                value={editReason}
                onChangeText={setEditReason}
                placeholder="Enter reason for working from home"
                placeholderTextColor="#9AA39D"
                style={styles.reasonInput}
                multiline
                textAlignVertical="top"
                maxLength={1000}
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

export default WFHScreen;
