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
  CalendarDays,
  Plus,
  Trash2,
  X,
  Eye,
  Pencil,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import { DatePicker } from '../../components/pickers';
import {
  fetchHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  HolidayItem,
} from '../../services/adminHRService';

export const AdminHolidaysScreen = ({ navigation }: any) => {
  const { user, employee } = useContext(AuthContext);
  const isHR = user?.role === 'HR';
  const companyId = user?.company_id || employee?.company_id || employee?.branch?.company_id || employee?.branch?.company?.id || undefined;

  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit / View state
  const [editingHoliday, setEditingHoliday] = useState<HolidayItem | null>(null);
  const [viewingHoliday, setViewingHoliday] = useState<HolidayItem | null>(null);

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const data = await fetchHolidays(companyId);
      setHolidays(data);
    } catch (error) {
      console.error('Failed loading holidays:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  const openCreateModal = () => {
    setEditingHoliday(null);
    setName('');
    setDate('');
    setDescription('');
    setModalVisible(true);
  };

  const openEditModal = (h: HolidayItem) => {
    setEditingHoliday(h);
    setName(h.name);
    setDate(h.date);
    setDescription(h.description || '');
    setModalVisible(true);
  };

  const handleSaveHoliday = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter holiday name.');
      return;
    }
    if (!date) {
      Alert.alert('Required', 'Please select holiday date.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: name.trim(),
        date,
        description: description.trim() || undefined,
        company: companyId,
      };

      if (editingHoliday) {
        await updateHoliday(editingHoliday.id, payload);
        Alert.alert('Success', 'Holiday updated successfully!');
      } else {
        await createHoliday(payload);
        Alert.alert('Success', 'Holiday added successfully!');
      }

      setModalVisible(false);
      setEditingHoliday(null);
      setName('');
      setDate('');
      setDescription('');
      loadHolidays();
    } catch (error: any) {
      console.error('Failed to save holiday:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save holiday.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (holiday: HolidayItem) => {
    Alert.alert(
      'Delete Holiday',
      `Are you sure you want to delete ${holiday.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHoliday(holiday.id);
              Alert.alert('Deleted', 'Holiday has been removed.');
              loadHolidays();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete holiday.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <AdminHRHeader
        role={user?.role || "Admin"}
        title="Company Holidays"
        subtitle={`${holidays.length} listed holidays`}
        rightAction={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={openCreateModal}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading holidays...</Text>
        </View>
      ) : (
        <FlatList
          data={holidays}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.holidayCard}>
              <View style={styles.cardHeader}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateDay}>{item.date.split('-')[2]}</Text>
                  <Text style={styles.dateMonth}>
                    {new Date(item.date).toLocaleString('default', { month: 'short' }).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.holidayInfo}>
                  <Text style={styles.holidayName}>{item.name}</Text>
                  <Text style={styles.holidayDate}>{item.date}</Text>
                  {item.description ? <Text style={styles.holidayDesc}>{item.description}</Text> : null}
                </View>
              </View>

              {/* Action Buttons: View, Edit, Delete */}
              <View style={styles.cardActionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.viewBtn]}
                  onPress={() => setViewingHoliday(item)}
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
                  onPress={() => handleDelete(item)}
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
              <Text style={styles.emptyTitle}>No Holidays Defined</Text>
              <Text style={styles.emptyDesc}>Add company holidays to exempt staff attendance.</Text>
            </View>
          }
        />
      )}

      {/* Add / Edit Holiday Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingHoliday ? 'Edit Company Holiday' : 'Add Company Holiday'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.formLabel}>Holiday Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. New Year's Day"
                placeholderTextColor="#999999"
                value={name}
                onChangeText={setName}
              />

              <DatePicker
                label="Holiday Date"
                value={date}
                onChange={(d) => setDate(d)}
                placeholder="YYYY-MM-DD"
                required
              />

              <Text style={styles.formLabel}>Description (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Details..."
                placeholderTextColor="#999999"
                value={description}
                onChangeText={setDescription}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveHoliday}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingHoliday ? 'Save Changes' : 'Add Holiday'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View Holiday Modal */}
      <Modal visible={!!viewingHoliday} animationType="fade" transparent>
        <View style={styles.viewModalOverlay}>
          <View style={styles.viewModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={20} color="#E56108" />
                <Text style={styles.modalTitle}>Holiday Details</Text>
              </View>
              <TouchableOpacity onPress={() => setViewingHoliday(null)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {viewingHoliday && (
              <View style={styles.viewBody}>
                <View style={styles.viewDetailRow}>
                  <Text style={styles.viewLabel}>Holiday Name:</Text>
                  <Text style={styles.viewValue}>{viewingHoliday.name}</Text>
                </View>

                <View style={styles.viewDetailRow}>
                  <Text style={styles.viewLabel}>Date:</Text>
                  <Text style={styles.viewValue}>{viewingHoliday.date}</Text>
                </View>

                {viewingHoliday.description ? (
                  <View style={styles.viewDetailRow}>
                    <Text style={styles.viewLabel}>Description:</Text>
                    <Text style={styles.viewValue}>{viewingHoliday.description}</Text>
                  </View>
                ) : null}

                <View style={styles.viewActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn, { flex: 1, paddingVertical: 10 }]}
                    onPress={() => {
                      const cur = viewingHoliday;
                      setViewingHoliday(null);
                      openEditModal(cur);
                    }}
                  >
                    <Pencil size={15} color="#E56108" />
                    <Text style={[styles.actionBtnText, { color: '#E56108', fontSize: 13 }]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn, { flex: 1, paddingVertical: 10 }]}
                    onPress={() => {
                      const cur = viewingHoliday;
                      setViewingHoliday(null);
                      handleDelete(cur);
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
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666666',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E56108',
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
    paddingBottom: 40,
  },
  holidayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECEEF3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  dateBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  dateMonth: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    letterSpacing: 0.5,
  },
  holidayInfo: {
    flex: 1,
  },
  holidayName: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  holidayDate: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  holidayDesc: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
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
  submitBtn: {
    backgroundColor: '#E56108',
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
