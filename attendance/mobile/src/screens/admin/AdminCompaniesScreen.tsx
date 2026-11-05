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
  Building2,
  Plus,
  X,
  GitBranch,
  Users,
  Eye,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import {
  fetchCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  CompanySummary,
} from '../../services/adminHRService';

export const AdminCompaniesScreen = ({ navigation }: any) => {
  const { user } = useContext(AuthContext);

  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanySummary | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0056B3');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCompanies();
      setCompanies(data);
    } catch (error) {
      console.error('Failed loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedCompany(null);
    setName('');
    setSlug('');
    setEmail('');
    setPhone('');
    setAddress('');
    setPrimaryColor('#0056B3');
    setModalVisible(true);
  };

  const openEditModal = (c: CompanySummary) => {
    setIsEditing(true);
    setSelectedCompany(c);
    setName(c.name);
    setSlug(c.slug);
    setEmail((c as any).email || '');
    setPhone((c as any).phone_number || '');
    setAddress((c as any).address || '');
    setPrimaryColor(c.primary_color || '#0056B3');
    setModalVisible(true);
  };

  const openViewModal = (c: CompanySummary) => {
    setSelectedCompany(c);
    setViewModalVisible(true);
  };

  const handleSaveCompany = async () => {
    if (!name.trim() || !slug.trim()) {
      Alert.alert('Validation Error', 'Company Name and Slug are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        primary_color: primaryColor,
      };
      if (email.trim()) payload.email = email.trim();
      if (phone.trim()) payload.phone_number = phone.trim();
      if (address.trim()) payload.address = address.trim();

      if (isEditing && selectedCompany) {
        await updateCompany(selectedCompany.id, payload);
        Alert.alert('Success', `Company "${name}" updated successfully.`);
      } else {
        await createCompany(payload);
        Alert.alert('Success', `Company "${name}" onboarded successfully.`);
      }
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.response?.data?.slug?.[0] || 'Operation failed. Slug must be unique.';
      Alert.alert('Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (c: CompanySummary) => {
    Alert.alert(
      'Delete Organization',
      `Are you sure you want to delete ${c.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCompany(c.id);
              Alert.alert('Deleted', `${c.name} has been removed.`);
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete company.');
            }
          },
        },
      ]
    );
  };

  const filteredCompanies = companies.filter((c) =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.slug || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <AdminHRHeader
        title="Organizations"
        subtitle={`${companies.length} enterprise tenants`}
        role={user?.role || 'SUPER_ADMIN'}
        rightAction={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={openCreateModal}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        }
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={16} color="#7B8192" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search organizations by name or slug..."
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
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0056B3" />
          <Text style={styles.loadingText}>Loading organizations...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCompanies}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.companyCard}>
              <TouchableOpacity
                style={styles.cardTop}
                activeOpacity={0.7}
                onPress={() => openViewModal(item)}
              >
                <View style={[styles.avatarBox, { backgroundColor: item.primary_color || '#0056B3' }]}>
                  <Text style={styles.avatarText}>
                    {item.name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase() || 'CO'}
                  </Text>
                </View>

                <View style={styles.companyInfo}>
                  <Text style={styles.companyName}>{item.name}</Text>
                  <Text style={styles.companySlug}>Slug: /{item.slug}</Text>
                </View>

                <View style={[styles.statusBadge, item.status ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, item.status ? styles.statusTextActive : styles.statusTextInactive]}>
                    {item.status ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <GitBranch size={13} color="#5A6A80" />
                  <Text style={styles.statText}>{item.branch_count || 0} Branches</Text>
                </View>

                <View style={styles.statItem}>
                  <Users size={13} color="#5A6A80" />
                  <Text style={styles.statText}>{item.employee_count || 0} Employees</Text>
                </View>
              </View>

              {/* View, Edit & Delete action buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => openViewModal(item)}
                  activeOpacity={0.7}
                >
                  <Eye size={14} color="#0056B3" />
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
                  onPress={() => handleDelete(item)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={14} color="#FF3B30" />
                  <Text style={[styles.actionPillText, { color: '#FF3B30' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Organizations Found</Text>
              <Text style={styles.emptyDesc}>Click '+ New' to create an enterprise tenant.</Text>
            </View>
          }
        />
      )}

      {/* View Company Details Modal */}
      <Modal visible={viewModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Organization Details</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {selectedCompany && (
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Company Name</Text>
                  <Text style={styles.viewValue}>{selectedCompany.name}</Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Slug Identifier</Text>
                  <Text style={styles.viewValue}>/{selectedCompany.slug}</Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Branches</Text>
                  <Text style={styles.viewValue}>{selectedCompany.branch_count || 0}</Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Employees</Text>
                  <Text style={styles.viewValue}>{selectedCompany.employee_count || 0}</Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Status</Text>
                  <Text style={[styles.viewValue, { color: selectedCompany.status ? '#34C759' : '#FF3B30' }]}>
                    {selectedCompany.status ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 10 }}>
                  <TouchableOpacity
                    style={[styles.submitBtn, { flex: 1, marginTop: 0, backgroundColor: '#0056B3' }]}
                    onPress={() => {
                      setViewModalVisible(false);
                      openEditModal(selectedCompany);
                    }}
                  >
                    <Text style={styles.submitBtnText}>Edit Details</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitBtn, { flex: 1, marginTop: 0, backgroundColor: '#F8F9FC', borderWidth: 1, borderColor: '#ECEEF3' }]}
                    onPress={() => setViewModalVisible(false)}
                  >
                    <Text style={[styles.submitBtnText, { color: '#0D1B2A' }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Onboard / Edit Company Modal with KeyboardAvoidingView */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Organization' : 'Onboard New Company'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Company Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Acme Corp"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (!isEditing) {
                    setSlug(text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                  }
                }}
              />

              <Text style={styles.formLabel}>Slug Identifier (Unique URL Path) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. acme-corp"
                autoCapitalize="none"
                value={slug}
                onChangeText={setSlug}
              />

              <Text style={styles.formLabel}>Official Email (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. contact@acme.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.formLabel}>Official Phone (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. +91 9876543210"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.formLabel}>Physical Address (Optional)</Text>
              <TextInput
                style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Street address, City, Pincode"
                multiline
                numberOfLines={2}
                value={address}
                onChangeText={setAddress}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveCompany}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>{isEditing ? 'Save Changes' : 'Onboard Company'}</Text>
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
    backgroundColor: '#0056B3',
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(6, 27, 58, 0.04)',
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
  listContent: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    paddingBottom: 40,
  },
  companyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECEEF3',
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
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#FFFFFF',
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0D1B2A',
  },
  companySlug: {
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
    backgroundColor: '#F8F9FC',
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
  },
  statusTextActive: {
    color: '#34C759',
  },
  statusTextInactive: {
    color: '#FF3B30',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#F8F9FC',
    marginTop: 12,
    paddingTop: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#5A6A80',
    fontFamily: 'Comfortaa_500Medium',
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
    paddingHorizontal: 12,
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
    color: '#0056B3',
  },
  emptyContainer: {
    padding: 30,
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
    maxHeight: '88%',
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
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0D1B2A',
  },
  submitBtn: {
    backgroundColor: '#0056B3',
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
