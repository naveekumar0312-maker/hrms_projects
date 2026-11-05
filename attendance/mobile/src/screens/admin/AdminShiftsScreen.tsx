import { colors } from '../../theme/colors';
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Clock,
  Plus,
  X,
  ShieldCheck,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import { TimePicker } from '../../components/pickers';
import {
  fetchShifts,
  createShift,
  updateShift,
  deleteShift,
  ShiftItem,
} from '../../services/adminHRService';

export const AdminShiftsScreen = ({ navigation }: any) => {
  const { user, employee } = useContext(AuthContext);
  const isHR = user?.role === 'HR';
  const companyId = user?.company_id || employee?.company_id || employee?.branch?.company_id || employee?.branch?.company?.id || undefined;

  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit / View state
  const [editingShift, setEditingShift] = useState<ShiftItem | null>(null);
  const [viewingShift, setViewingShift] = useState<ShiftItem | null>(null);

  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00:00');
  const [endTime, setEndTime] = useState('18:00:00');
  const [gracePeriod, setGracePeriod] = useState('15');

  const loadShifts = async () => {
    setLoading(true);
    try {
      const data = await fetchShifts(companyId);
      setShifts(data);
    } catch (error) {
      console.error('Failed loading shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, []);

  const openCreateModal = () => {
    setEditingShift(null);
    setName('');
    setStartTime('09:00:00');
    setEndTime('18:00:00');
    setGracePeriod('15');
    setModalVisible(true);
  };

  const openEditModal = (shift: ShiftItem) => {
    setEditingShift(shift);
    setName(shift.name);
    setStartTime(shift.start_time);
    setEndTime(shift.end_time);
    setGracePeriod(String(shift.grace_period_minutes || 15));
    setModalVisible(true);
  };

  const handleSaveShift = async () => {
    if (!name || !startTime || !endTime) {
      Alert.alert('Validation Error', 'Please fill in Shift Name, Start Time, and End Time.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name,
        start_time: startTime,
        end_time: endTime,
        grace_period_minutes: parseInt(gracePeriod, 10) || 15,
        is_active: true,
      };
      if (companyId) {
        payload.company = companyId;
      }

      if (editingShift) {
        await updateShift(editingShift.id, payload);
        Alert.alert('Success', 'Shift updated successfully!');
      } else {
        await createShift(payload);
        Alert.alert('Success', 'Shift created successfully!');
      }

      setModalVisible(false);
      setEditingShift(null);
      setName('');
      setStartTime('09:00:00');
      setEndTime('18:00:00');
      setGracePeriod('15');
      loadShifts();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to save shift schedule. Check timings format.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShift = (shift: ShiftItem) => {
    Alert.alert(
      'Delete Shift',
      `Are you sure you want to permanently delete "${shift.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteShift(shift.id);
              Alert.alert('Deleted', 'Shift has been deleted successfully.');
              loadShifts();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete shift.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <AdminHRHeader
        title="Work Shifts"
        subtitle={`${shifts.length} active work schedules`}
        role={user?.role || 'ADMIN'}
        companyName={user?.company_name}
        rightAction={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={openCreateModal}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0757B8" />
          <Text style={styles.loadingText}>Loading shifts...</Text>
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.shiftCard}>
              <View style={styles.cardTop}>
                <View style={styles.shiftIconBg}>
                  <Clock size={20} color="#0757B8" />
                </View>
                <View style={styles.shiftDetails}>
                  <Text style={styles.shiftName}>{item.name}</Text>
                  <Text style={styles.shiftTiming}>
                    {item.start_time} - {item.end_time}
                  </Text>
                </View>
                <View style={[styles.statusBadge, item.is_active ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, item.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
                    {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.graceCol}>
                  <ShieldCheck size={14} color="#222222" />
                  <Text style={styles.graceText}>Grace Period: {item.grace_period_minutes} mins</Text>
                </View>
              </View>

              {/* Action Buttons: View, Edit, Delete */}
              <View style={styles.cardActionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.viewBtn]}
                  onPress={() => setViewingShift(item)}
                  activeOpacity={0.7}
                >
                  <Eye size={13} color="#0284C7" />
                  <Text style={[styles.actionBtnText, { color: '#0284C7' }]}>View</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.editBtn]}
                  onPress={() => openEditModal(item)}
                  activeOpacity={0.7}
                >
                  <Pencil size={13} color="#0757B8" />
                  <Text style={[styles.actionBtnText, { color: '#0757B8' }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDeleteShift(item)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={13} color="#EF4444" />
                  <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Shifts</Text>
              <Text style={styles.emptyDesc}>Click the 'Add' button to configure your first shift schedule.</Text>
            </View>
          }
        />
      )}

      {/* Add / Edit Shift Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingShift ? 'Edit Work Shift' : 'Add Work Shift'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Shift Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. General Morning Shift"
                value={name}
                onChangeText={setName}
              />

              <TimePicker
                label="Start Time"
                value={startTime}
                onChange={(t) => setStartTime(t)}
                required
              />

              <TimePicker
                label="End Time"
                value={endTime}
                onChange={(t) => setEndTime(t)}
                required
              />

              <Text style={styles.formLabel}>Grace Period (Minutes)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="15"
                keyboardType="numeric"
                value={gracePeriod}
                onChangeText={setGracePeriod}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveShift}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingShift ? 'Save Changes' : 'Create Shift'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View Shift Modal */}
      <Modal visible={!!viewingShift} animationType="fade" transparent>
        <View style={styles.viewModalOverlay}>
          <View style={styles.viewModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock size={20} color="#0757B8" />
                <Text style={styles.modalTitle}>Shift Details</Text>
              </View>
              <TouchableOpacity onPress={() => setViewingShift(null)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {viewingShift && (
              <View style={styles.viewBody}>
                <View style={styles.viewDetailRow}>
                  <Text style={styles.viewLabel}>Shift Name:</Text>
                  <Text style={styles.viewValue}>{viewingShift.name}</Text>
                </View>

                <View style={styles.viewDetailRow}>
                  <Text style={styles.viewLabel}>Timing:</Text>
                  <Text style={styles.viewValue}>{viewingShift.start_time} - {viewingShift.end_time}</Text>
                </View>

                <View style={styles.viewDetailRow}>
                  <Text style={styles.viewLabel}>Grace Period:</Text>
                  <Text style={styles.viewValue}>{viewingShift.grace_period_minutes} Minutes</Text>
                </View>

                <View style={styles.viewDetailRow}>
                  <Text style={styles.viewLabel}>Status:</Text>
                  <Text style={[styles.viewValue, { color: viewingShift.is_active ? '#014B9D' : '#666666' }]}>
                    {viewingShift.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>

                <View style={styles.viewActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn, { flex: 1, paddingVertical: 10 }]}
                    onPress={() => {
                      const cur = viewingShift;
                      setViewingShift(null);
                      openEditModal(cur);
                    }}
                  >
                    <Pencil size={15} color="#0757B8" />
                    <Text style={[styles.actionBtnText, { color: '#0757B8', fontSize: 13 }]}>Edit Shift</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn, { flex: 1, paddingVertical: 10 }]}
                    onPress={() => {
                      const cur = viewingShift;
                      setViewingShift(null);
                      handleDeleteShift(cur);
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666666',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0056B3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    backgroundColor: colors.surfaceSecondary,
    paddingBottom: 40,
  },
  shiftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECEEF3',
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shiftIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shiftDetails: {
    flex: 1,
  },
  shiftName: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  shiftTiming: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#ECFDF5',
  },
  statusInactive: {
    backgroundColor: colors.surfaceSecondary,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
  },
  statusTextActive: {
    color: '#014B9D',
  },
  statusTextInactive: {
    color: '#000000',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    marginTop: 12,
    paddingTop: 10,
  },
  graceCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  graceText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#222222',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
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
    maxHeight: '85%',
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
    color: '#000000',
  },
  modalBody: {
    marginTop: 10,
  },
  formLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#222222',
    marginTop: 8,
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#000000',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 14,
  },
  viewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  viewModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  viewBody: {
    marginTop: 14,
  },
  viewDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  viewLabel: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#666666',
  },
  viewValue: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  viewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
});
