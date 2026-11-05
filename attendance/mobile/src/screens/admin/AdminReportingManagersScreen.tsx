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
  ScrollView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  UserCheck,
  Building,
  Mail,
  Phone,
  Users,
  X,
  Plus,
  Lock,
  User,
  Shield,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import {
  fetchReportingManagers,
  fetchEmployees,
  createReportingManager,
  assignTeamToManager,
  updateReportingManager,
  deleteReportingManager,
  ManagerAccountItem,
  EmployeeItem,
} from '../../services/adminHRService';
import { promoteEmployeeToTeamLeader } from '../../services/managerService';

export const AdminReportingManagersScreen = ({ navigation }: any) => {
  const { user } = useContext(AuthContext);
  const isHR = user?.role === 'HR';
  const companyId = isHR ? user?.company_id : undefined;

  const [managers, setManagers] = useState<ManagerAccountItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign Team Modal State
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedManager, setSelectedManager] = useState<ManagerAccountItem | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Add Manager Modal State
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [department, setDepartment] = useState('Management');
  const [designation, setDesignation] = useState('Reporting Manager');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewManager, setViewManager] = useState<ManagerAccountItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingManagerId, setEditingManagerId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mgrList, empList] = await Promise.all([
        fetchReportingManagers(companyId),
        fetchEmployees(companyId),
      ]);
      setManagers(mgrList);
      setEmployees(empList);
    } catch (error) {
      console.error('Failed fetching managers/employees:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAssignModal = (manager: ManagerAccountItem) => {
    setSelectedManager(manager);
    setSelectedEmployeeIds([]);
    setAssignModalVisible(true);
  };

  const toggleSelectEmployee = (id: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveAssignment = async () => {
    if (!selectedManager || selectedEmployeeIds.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one employee to assign.');
      return;
    }

    setAssigning(true);
    try {
      await assignTeamToManager(selectedManager.id, selectedEmployeeIds);
      Alert.alert('Success', 'Team members assigned successfully!');
      setAssignModalVisible(false);
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to assign team members to manager.');
    } finally {
      setAssigning(false);
    }
  };

  const openViewModal = (manager: ManagerAccountItem) => {
    setViewManager(manager);
    setViewModalVisible(true);
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingManagerId(null);
    setFullName('');
    setUsername('');
    setPassword('');
    setPhoneNumber('');
    setDepartment('Management');
    setDesignation('Reporting Manager');
    setAddModalVisible(true);
  };

  const openEditModal = (manager: ManagerAccountItem) => {
    setIsEditing(true);
    setEditingManagerId(manager.id);
    setFullName(manager.full_name);
    setUsername(manager.email || manager.employee_id);
    setPassword('');
    setPhoneNumber(manager.phone_number || '');
    setDepartment(manager.department || 'Management');
    setDesignation(manager.designation || 'Reporting Manager');
    setAddModalVisible(true);
  };

  const handleDeleteManager = (manager: ManagerAccountItem) => {
    Alert.alert(
      'Remove Reporting Manager',
      `Are you sure you want to remove ${manager.full_name}? Assigned staff will be unlinked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReportingManager(manager.id);
              Alert.alert('Done', 'Reporting Manager removed successfully.');
              loadData();
            } catch (err) {
              Alert.alert('Error', 'Failed to remove reporting manager.');
            }
          },
        },
      ]
    );
  };

  const handleCreateManager = async () => {
    const trimmedName = fullName.trim();
    const trimmedUsername = username.trim();
    const trimmedPwd = password.trim();

    if (!trimmedName) {
      Alert.alert('Validation Error', 'Manager full name is required.');
      return;
    }
    if (!trimmedUsername) {
      Alert.alert('Validation Error', 'Username is required.');
      return;
    }
    if (!trimmedPwd || trimmedPwd.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await createReportingManager({
        full_name: trimmedName,
        username: trimmedUsername,
        password: trimmedPwd,
        status: 'ACTIVE',
        phone_number: phoneNumber.trim() || undefined,
        department: department.trim() || 'Management',
        designation: designation.trim() || 'Reporting Manager',
      });

      Alert.alert('Success', `Reporting Manager "${trimmedName}" created successfully!`);
      setAddModalVisible(false);
      setFullName('');
      setUsername('');
      setPassword('');
      setPhoneNumber('');
      loadData();
    } catch (error: any) {
      const respData = error?.response?.data;
      let errMsg = 'Failed to create reporting manager.';
      if (typeof respData === 'string') {
        errMsg = respData;
      } else if (respData?.username) {
        errMsg = Array.isArray(respData.username) ? respData.username[0] : respData.username;
      } else if (respData?.detail) {
        errMsg = respData.detail;
      }
      Alert.alert('Creation Failed', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <AdminHRHeader
        title="Reporting Managers"
        subtitle={`${managers.length} designated managers`}
        role={user?.role || 'ADMIN'}
        companyName={user?.company_name}
        rightAction={
          <TouchableOpacity
            style={styles.addManagerBtn}
            onPress={openCreateModal}
            activeOpacity={0.7}
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.addManagerBtnText}>Add Manager</Text>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading managers...</Text>
        </View>
      ) : (
        <FlatList
          data={managers}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.managerCard}>
              <View style={styles.cardTop}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {item.full_name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase() || 'MG'}
                  </Text>
                </View>

                <View style={styles.managerInfo}>
                  <Text style={styles.managerName}>{item.full_name}</Text>
                  <Text style={styles.managerRole}>
                    ID: {item.employee_id} {item.department ? `• ${item.department}` : ''}
                  </Text>
                </View>

                <View style={styles.staffCountBadge}>
                  <Users size={12} color={colors.primary} />
                  <Text style={styles.staffCountText}>{item.assigned_employees_count || 0} Staff</Text>
                </View>
              </View>

              <View style={styles.contactDetails}>
                {item.email ? (
                  <View style={styles.contactRow}>
                    <Mail size={13} color="#666666" />
                    <Text style={styles.contactText}>{item.email}</Text>
                  </View>
                ) : null}
                {item.phone_number ? (
                  <View style={styles.contactRow}>
                    <Phone size={13} color="#666666" />
                    <Text style={styles.contactText}>{item.phone_number}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.actionRowContainer}>
                <TouchableOpacity
                  style={styles.assignBtn}
                  onPress={() => handleOpenAssignModal(item)}
                  activeOpacity={0.7}
                >
                  <Users size={14} color="#FFFFFF" />
                  <Text style={styles.assignBtnText}>Assign Staff</Text>
                </TouchableOpacity>

                <View style={styles.cardBtnRow}>
                  <TouchableOpacity
                    style={styles.actionPillBtn}
                    onPress={() => openViewModal(item)}
                    activeOpacity={0.7}
                  >
                    <Eye size={13} color="#0056B3" />
                    <Text style={styles.actionPillText}>View</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionPillBtn}
                    onPress={() => openEditModal(item)}
                    activeOpacity={0.7}
                  >
                    <Pencil size={13} color="#0D1B2A" />
                    <Text style={[styles.actionPillText, { color: '#0D1B2A' }]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionPillBtn, styles.deleteActionPill]}
                    onPress={() => handleDeleteManager(item)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={13} color="#FF3B30" />
                    <Text style={[styles.actionPillText, { color: '#FF3B30' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <UserCheck size={40} color="#999999" />
              <Text style={styles.emptyTitle}>No Reporting Managers Found</Text>
              <Text style={styles.emptySubtitle}>
                Add a reporting manager or promote an employee to lead a team.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={openCreateModal}
                activeOpacity={0.7}
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.emptyAddBtnText}>Add First Manager</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ADD REPORTING MANAGER MODAL */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Reporting Manager</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <View style={styles.inputFieldWrap}>
                <User size={16} color="#888888" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Anand Kumar"
                  placeholderTextColor="#999999"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <Text style={styles.inputLabel}>Login Username *</Text>
              <View style={styles.inputFieldWrap}>
                <Shield size={16} color="#888888" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. anand_manager"
                  placeholderTextColor="#999999"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>

              <Text style={styles.inputLabel}>Password *</Text>
              <View style={styles.inputFieldWrap}>
                <Lock size={16} color="#888888" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor="#999999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} color="#888888" /> : <Eye size={16} color="#888888" />}
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
              <View style={styles.inputFieldWrap}>
                <Phone size={16} color="#888888" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#999999"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>

              <Text style={styles.inputLabel}>Department</Text>
              <View style={styles.inputFieldWrap}>
                <Building size={16} color="#888888" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Engineering / Management"
                  placeholderTextColor="#999999"
                  value={department}
                  onChangeText={setDepartment}
                />
              </View>

              <Text style={styles.inputLabel}>Designation</Text>
              <View style={styles.inputFieldWrap}>
                <UserCheck size={16} color="#888888" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Reporting Manager"
                  placeholderTextColor="#999999"
                  value={designation}
                  onChangeText={setDesignation}
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.createBtn, submitting && { opacity: 0.6 }]}
              onPress={handleCreateManager}
              disabled={submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.createBtnText}>Create Reporting Manager</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ASSIGN TEAM MODAL */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Assign Team to {selectedManager?.full_name}
              </Text>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select staff members reporting to this manager:
            </Text>

            <ScrollView style={styles.employeeSelectList}>
              {employees.map((emp) => {
                const isSelected = selectedEmployeeIds.includes(emp.id);
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[styles.empSelectRow, isSelected && styles.empSelectRowActive]}
                    onPress={() => toggleSelectEmployee(emp.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.selectInfo}>
                      <Text style={[styles.selectEmpName, isSelected && styles.selectEmpNameActive]}>
                        {emp.full_name}
                      </Text>
                      <Text style={styles.selectEmpSub}>
                        {emp.employee_id} • {emp.designation || 'Staff'}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.saveAssignBtn}
              onPress={handleSaveAssignment}
              disabled={assigning}
              activeOpacity={0.7}
            >
              {assigning ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveAssignBtnText}>
                  Save Team Assignment ({selectedEmployeeIds.length})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    
      {/* VIEW MANAGER DETAILS MODAL */}
      <Modal visible={viewModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reporting Manager Profile</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {viewManager && (
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Full Name</Text>
                  <Text style={styles.viewValue}>{viewManager.full_name}</Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Employee ID</Text>
                  <Text style={styles.viewValue}>{viewManager.employee_id}</Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Department & Role</Text>
                  <Text style={styles.viewValue}>{viewManager.department || 'Management'}  {viewManager.designation || 'Reporting Manager'}</Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Assigned Staff</Text>
                  <Text style={[styles.viewValue, { color: '#0056B3', fontFamily: 'Comfortaa_700Bold' }]}>
                    {viewManager.assigned_employees_count || 0} Employees
                  </Text>
                </View>

                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>Contact</Text>
                  <Text style={styles.viewValue}>{viewManager.email || '--'} | {viewManager.phone_number || 'No phone'}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 10 }}>
                  <TouchableOpacity
                    style={[styles.saveBtn, { flex: 1, marginTop: 0 }]}
                    onPress={() => {
                      setViewModalVisible(false);
                      openEditModal(viewManager);
                    }}
                  >
                    <Text style={styles.saveBtnText}>Edit Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, { flex: 1, marginTop: 0, backgroundColor: '#F8F9FC', borderWidth: 1, borderColor: '#ECEEF3' }]}
                    onPress={() => setViewModalVisible(false)}
                  >
                    <Text style={[styles.saveBtnText, { color: '#0D1B2A' }]}>Close</Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Comfortaa_500Medium',
  },
  addManagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  addManagerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
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
  actionRowContainer: {
    marginTop: 12,
    gap: 8,
  },
  cardBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  managerCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#202334',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.primary,
  },
  managerInfo: {
    flex: 1,
  },
  managerName: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  managerRole: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
    fontFamily: 'Comfortaa_500Medium',
  },
  staffCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  staffCountText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.primary,
  },
  contactDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'Comfortaa_500Medium',
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  assignBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#333333',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#777777',
    textAlign: 'center',
    paddingHorizontal: 30,
    marginTop: 4,
    fontFamily: 'Comfortaa_500Medium',
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    gap: 6,
    marginTop: 16,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  addModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    padding: 6,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
    marginBottom: 12,
    fontFamily: 'Comfortaa_500Medium',
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  inputFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: 'Comfortaa_500Medium',
    paddingVertical: 0,
  },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 14,
  },
  employeeSelectList: {
    maxHeight: 340,
  },
  empSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  empSelectRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSecondary,
  },
  selectInfo: {
    flex: 1,
  },
  selectEmpName: {
    fontSize: 14,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#000000',
  },
  selectEmpNameActive: {
    color: colors.primary,
  },
  selectEmpSub: {
    fontSize: 12,
    color: '#666666',
    marginTop: 1,
    fontFamily: 'Comfortaa_500Medium',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
  },
  saveAssignBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  saveAssignBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 14,
  },
});
