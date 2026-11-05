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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  GitBranch,
  MapPin,
  Plus,
  X,
  Compass,
  Search,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import {
  fetchBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  BranchItem,
} from '../../services/adminHRService';

export const AdminBranchesScreen = ({ navigation }: any) => {
  const { user } = useContext(AuthContext);
  const isHR = user?.role === 'HR';
  const companyId = isHR ? user?.company_id : undefined;

  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('100');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const loadBranches = async () => {
    setLoading(true);
    try {
      const data = await fetchBranches(companyId);
      setBranches(data);
    } catch (error) {
      console.error('Failed loading branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const openViewModal = (b: BranchItem) => {
    setSelectedBranch(b);
    setViewModalVisible(true);
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedBranch(null);
    setName('');
    setCode('');
    setLatitude('');
    setLongitude('');
    setRadius('200');
    setModalVisible(true);
  };

  const openEditModal = (b: BranchItem) => {
    setIsEditing(true);
    setSelectedBranch(b);
    setName(b.name);
    setCode(b.code || '');
    setLatitude(String(b.latitude || ''));
    setLongitude(String(b.longitude || ''));
    setRadius(String(b.radius || 200));
    setSelectedCompanyId(b.company || null);
    setModalVisible(true);
  };

  const handleDeleteBranch = (b: BranchItem) => {
    Alert.alert(
      'Delete Branch',
      `Are you sure you want to delete ${b.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBranch(b.id);
              Alert.alert('Done', 'Branch deleted successfully.');
              loadBranches();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete branch.');
            }
          },
        },
      ]
    );
  };

  const handleCreateBranch = async () => {
    if (!name || !latitude || !longitude) {
      Alert.alert('Validation Error', 'Please fill in Branch Name, Latitude, and Longitude.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name,
        code,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseInt(radius, 10) || 100,
        is_active: true,
      };
      if (companyId) {
        payload.company = companyId;
      }

      await createBranch(payload);
      Alert.alert('Success', 'Branch created successfully!');
      setModalVisible(false);
      setName('');
      setCode('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setRadius('100');
      loadBranches();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to create branch. Check network or permissions.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <AdminHRHeader
        title="Branch Geofences"
        subtitle={`${branches.length} office zones configured`}
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

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={16} color="#7B8192" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search branches by name or code..."
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
          <ActivityIndicator size="large" color="#0757B8" />
          <Text style={styles.loadingText}>Loading branches...</Text>
        </View>
      ) : (
        <FlatList
          data={branches.filter((b) =>
            (b.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (b.code || '').toLowerCase().includes(searchQuery.toLowerCase())
          )}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.branchCard}>
              <View style={styles.cardTop}>
                <View style={styles.branchIconBg}>
                  <GitBranch size={20} color="#0757B8" />
                </View>
                <View style={styles.branchDetails}>
                  <Text style={styles.branchName}>{item.name}</Text>
                  {item.code ? <Text style={styles.branchCode}>Code: {item.code}</Text> : null}
                </View>
                <View style={[styles.statusBadge, item.is_active ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, item.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
                    {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>
              </View>

              {item.address ? (
                <View style={styles.addressRow}>
                  <MapPin size={14} color="#666666" />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {item.address}
                  </Text>
                </View>
              ) : null}

              <View style={styles.geofenceDetails}>
                <View style={styles.geoCol}>
                  <Compass size={14} color="#0284C7" />
                  <Text style={styles.geoCoord}>
                    {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                  </Text>
                </View>
                <View style={styles.radiusBadge}>
                  <Text style={styles.radiusText}>Radius: {item.radius}m</Text>
                </View>
              </View>

              {/* Action Buttons: View, Edit, Delete */}
              <View style={styles.branchActionsRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openViewModal(item)}
                  activeOpacity={0.7}
                >
                  <Eye size={13} color="#0284C7" />
                  <Text style={[styles.actionBtnText, { color: '#0284C7' }]}>View</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEditModal(item)}
                  activeOpacity={0.7}
                >
                  <Pencil size={13} color="#0757B8" />
                  <Text style={[styles.actionBtnText, { color: '#0757B8' }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteActionBtn]}
                  onPress={() => handleDeleteBranch(item)}
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
              <Text style={styles.emptyTitle}>No Branches</Text>
              <Text style={styles.emptyDesc}>Click the 'Add' button to create your first geofenced branch.</Text>
            </View>
          }
        />
      )}

      {/* Add Branch Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Geofenced Branch</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Branch Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Headquarters"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.formLabel}>Branch Code</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. HQ01"
                value={code}
                onChangeText={setCode}
              />

              <Text style={styles.formLabel}>Office Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Address line..."
                value={address}
                onChangeText={setAddress}
              />

              <View style={styles.coordRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.formLabel}>Latitude *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="12.9716"
                    keyboardType="numeric"
                    value={latitude}
                    onChangeText={setLatitude}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Longitude *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="77.5946"
                    keyboardType="numeric"
                    value={longitude}
                    onChangeText={setLongitude}
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Allowed Radius (Meters) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="100"
                keyboardType="numeric"
                value={radius}
                onChangeText={setRadius}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateBranch}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Branch Zone</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* VIEW BRANCH MODAL */}
      <Modal visible={viewModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Branch Location Details</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {selectedBranch && (
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Branch Name</Text>
                  <Text style={styles.viewValue}>{selectedBranch.name}</Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Branch Code</Text>
                  <Text style={styles.viewValue}>{selectedBranch.code || 'None'}</Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Company</Text>
                  <Text style={styles.viewValue}>{selectedBranch.company_name || 'Enterprise'}</Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>GPS Coordinates</Text>
                  <Text style={styles.viewValue}>{selectedBranch.latitude}, {selectedBranch.longitude}</Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Geofence Radius</Text>
                  <Text style={[styles.viewValue, { color: '#0056B3', fontFamily: 'Comfortaa_700Bold' }]}>{selectedBranch.radius} Meters</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 10 }}>
                  <TouchableOpacity
                    style={[styles.submitBtn, { flex: 1, marginTop: 0 }]}
                    onPress={() => {
                      setViewModalVisible(false);
                      openEditModal(selectedBranch);
                    }}
                  >
                    <Text style={styles.submitBtnText}>Edit Branch</Text>
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
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  branchActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ECEEF3',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
  },
  deleteActionBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.06)',
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  actionBtnText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0056B3',
  },

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
  searchSection: {
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
  listContent: {
    padding: 16,
    backgroundColor: colors.surfaceSecondary,
    paddingBottom: 40,
  },
  branchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  branchIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  branchDetails: {
    flex: 1,
  },
  branchName: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  branchCode: {
    fontSize: 12,
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
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  addressText: {
    fontSize: 12,
    color: '#666666',
    flex: 1,
  },
  geofenceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    marginTop: 12,
    paddingTop: 10,
  },
  geoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  geoCoord: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#0284C7',
  },
  radiusBadge: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  radiusText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#444444',
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
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#000000',
  },
  coordRow: {
    flexDirection: 'row',
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

