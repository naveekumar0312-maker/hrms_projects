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
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldAlert,
  Plus,
  X,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Building,
  UserCheck,
  Lock,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import { DropdownPicker } from '../../components/pickers';
import {
  fetchHRAccounts,
  fetchCompanies,
  createHRAccount,
  updateHRAccount,
  deleteHRAccount,
  HRAccountItem,
  CompanySummary,
} from '../../services/adminHRService';

export const AdminHRAccountsScreen = ({ navigation }: any) => {
  const { user } = useContext(AuthContext);

  const [hrAccounts, setHrAccounts] = useState<HRAccountItem[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedHR, setSelectedHR] = useState<HRAccountItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accounts, comps] = await Promise.all([
        fetchHRAccounts(),
        fetchCompanies(),
      ]);
      setHrAccounts(accounts);
      setCompanies(comps);
      if (comps.length > 0 && !selectedCompanyId) {
        setSelectedCompanyId(comps[0].id);
      }
    } catch (error) {
      console.error('Failed loading HR accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedHR(null);
    setUsername('');
    setPassword('');
    setPhoneNumber('');
    setSelectedCompanyId(companies[0]?.id || null);
    setShowPassword(false);
    setModalVisible(true);
  };

  const openEditModal = (item: HRAccountItem) => {
    setIsEditing(true);
    setSelectedHR(item);
    setUsername(item.username);
    setPassword('');
    setPhoneNumber(item.phone_number || '');
    setSelectedCompanyId(item.company_id || null);
    setShowPassword(false);
    setModalVisible(true);
  };

  const openViewModal = (item: HRAccountItem) => {
    setSelectedHR(item);
    setViewModalVisible(true);
  };

  const handleSaveHR = async () => {
    if (!username || (!isEditing && !password) || !selectedCompanyId) {
      Alert.alert('Validation Error', 'Username, password, and assigned company are required.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && selectedHR) {
        const payload: any = {
          username: username.trim(),
          company_id: selectedCompanyId,
        };
        if (phoneNumber.trim()) {
          payload.phone_number = phoneNumber.trim();
        }
        if (password) {
          payload.password = password;
        }
        await updateHRAccount(selectedHR.id, payload);
        Alert.alert('Success', 'HR account updated successfully!');
      } else {
        await createHRAccount({
          username: username.trim(),
          password,
          phone_number: phoneNumber.trim(),
          company_id: selectedCompanyId,
        });
        Alert.alert('Success', 'HR account successfully provisioned!');
      }
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.response?.data?.username?.[0] || 'Operation failed. Please try again.';
      Alert.alert('Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHR = (item: HRAccountItem) => {
    Alert.alert(
      'Deactivate HR Account',
      `Are you sure you want to deactivate ${item.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHRAccount(item.id);
              Alert.alert('Done', 'HR account deactivated successfully.');
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to deactivate HR account.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <AdminHRHeader
        title="HR Accounts"
        subtitle={`${hrAccounts.length} company administrators`}
        role={user?.role || 'SUPER_ADMIN'}
        rightAction={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={openCreateModal}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>+ Add HR</Text>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E56108" />
          <Text style={styles.loadingText}>Loading HR accounts...</Text>
        </View>
      ) : (
        <FlatList
          data={hrAccounts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.accountCard}
              activeOpacity={0.7}
              onPress={() => openViewModal(item)}
            >
              <View style={styles.cardTop}>
                <View style={styles.iconCircle}>
                  <ShieldAlert size={20} color="#E56108" />
                </View>

                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{item.username}</Text>
                  <Text style={styles.accountCompany}>{item.company_name || 'Enterprise'}</Text>
                </View>

                <View style={[styles.statusBadge, item.is_active ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, item.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
                    {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailsRow}>
                <Text style={styles.dateText}>Provisioned: {item.date_joined?.split('T')[0] || 'Active'}</Text>
                {item.phone_number ? <Text style={styles.phoneText}>Phone: {item.phone_number}</Text> : null}
              </View>

              {/* Action buttons: View, Edit, Delete */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => openViewModal(item)}
                  activeOpacity={0.7}
                >
                  <Eye size={14} color="#E56108" />
                  <Text style={styles.actionPillText}>View</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => openEditModal(item)}
                  activeOpacity={0.7}
                >
                  <Pencil size={14} color="#0D1B2A" />
                  <Text style={[styles.actionPillText, { color: '#0D1B2A' }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionPillBtn, styles.deleteActionPill]}
                  onPress={() => handleDeleteHR(item)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={14} color="#FF3B30" />
                  <Text style={[styles.actionPillText, { color: '#FF3B30' }]}>Deactivate</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No HR Accounts</Text>
              <Text style={styles.emptyDesc}>Click '+ Add HR' to provision an HR login credential for a company.</Text>
            </View>
          }
        />
      )}

      {/* View HR Details Modal */}
      <Modal visible={viewModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>HR Account Details</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {selectedHR && (
              <View style={styles.modalBody}>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Username / Email</Text>
                  <Text style={styles.viewValue}>{selectedHR.username}</Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Assigned Company</Text>
                  <Text style={styles.viewValue}>{selectedHR.company_name || 'Enterprise'}</Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Phone Number</Text>
                  <Text style={styles.viewValue}>{selectedHR.phone_number || 'Not provided'}</Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Status</Text>
                  <Text style={[styles.viewValue, { color: selectedHR.is_active ? '#34C759' : '#FF3B30' }]}>
                    {selectedHR.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Provisioned Date</Text>
                  <Text style={styles.viewValue}>{selectedHR.date_joined?.split('T')[0] || 'Active'}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 10 }}>
                  <TouchableOpacity
                    style={[styles.submitBtn, { flex: 1, marginTop: 0, backgroundColor: '#E56108' }]}
                    onPress={() => {
                      setViewModalVisible(false);
                      openEditModal(selectedHR);
                    }}
                  >
                    <Text style={styles.submitBtnText}>Edit Account</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitBtn, { flex: 1, marginTop: 0, backgroundColor: '#F8F9FC', borderWidth: 1, borderColor: '#ECEEF3' }]}
                    onPress={() => setViewModalVisible(false)}
                  >
                    <Text style={[styles.submitBtnText, { color: '#0D1B2A' }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create / Edit HR Account Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit HR Account' : 'Provision HR Account'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <DropdownPicker
                label="Assign to Company"
                options={companies.map((c) => ({ label: c.name, value: c.id, sublabel: `/${c.slug}` }))}
                value={selectedCompanyId || ''}
                onChange={(val) => setSelectedCompanyId(Number(val))}
                placeholder="Select enterprise client"
                required
              />

              <Text style={styles.formLabel}>HR Username / Email *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. hr@company.com"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
              />

              <Text style={styles.formLabel}>
                {isEditing ? 'New Password (Leave blank to keep unchanged)' : 'Temporary Password *'}
              </Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                  placeholder={isEditing ? 'Enter new password' : 'Minimum 6 characters'}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} color="#666666" /> : <Eye size={18} color="#666666" />}
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>Mobile Number (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 9876543210"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveHR}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>{isEditing ? 'Update HR Account' : 'Provision Account'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
    backgroundColor: '#E56108',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
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
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 27, 58, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 86, 179, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0D1B2A',
  },
  accountCompany: {
    fontSize: 12,
    color: '#5A6A80',
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
    color: '#CC5200',
  },
  statusTextInactive: {
    color: '#000000',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    marginTop: 12,
    paddingTop: 10,
  },
  dateText: {
    fontSize: 12,
    color: '#888888',
  },
  phoneText: {
    fontSize: 12,
    color: '#666666',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(6, 27, 58, 0.04)',
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
  },
  deleteActionPill: {
    backgroundColor: 'rgba(255, 59, 48, 0.06)',
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  actionPillText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#E56108',
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
  viewRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  viewLabel: {
    fontSize: 11,
    color: '#8E9BAE',
    fontFamily: 'Comfortaa_600SemiBold',
    textTransform: 'uppercase',
  },
  viewValue: {
    fontSize: 14,
    color: '#0D1B2A',
    fontFamily: 'Comfortaa_600SemiBold',
    marginTop: 4,
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
    marginBottom: 6,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 6,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 4,
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
});
