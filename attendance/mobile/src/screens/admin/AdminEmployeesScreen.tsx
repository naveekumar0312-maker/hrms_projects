import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  UserPlus,
  Building,
  Mail,
  Phone,
  Briefcase,
  X,
  CheckCircle,
  XCircle,
  Filter,
  User,
  Clock,
  ShieldCheck,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  CreditCard,
  Building2,
  Camera,
  MapPin,
  ChevronRight,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import { DropdownPicker, DatePicker } from '../../components/pickers';
import {
  fetchEmployees,
  fetchBranches,
  fetchCompanies,
  fetchShifts,
  createEmployee,
  updateEmployee,
  fetchEmployeeDetail,
  EmployeeItem,
  BranchItem,
  CompanySummary,
  ShiftItem,
} from '../../services/adminHRService';
import { colors } from '../../theme/colors';

type TabKey = 'basic' | 'contact' | 'employment' | 'work' | 'bank' | 'account';

const FORM_TABS: { key: TabKey; label: string }[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'contact', label: 'Contact' },
  { key: 'employment', label: 'Employment' },
  { key: 'work', label: 'Work & Shift' },
  { key: 'bank', label: 'Identity & Bank' },
  { key: 'account', label: 'Security' },
];

export const AdminEmployeesScreen = ({ navigation }: any) => {
  const { user } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const isHR = user?.role === 'HR';
  const companyId = isHR ? user?.company_id : undefined;

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [managers, setManagers] = useState<EmployeeItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<number | 'ALL'>('ALL');

  // Detail Modal
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Add / Edit Employee Modal
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const initialForm = {
    // Basic
    full_name: '',
    date_of_birth: '',
    gender: 'MALE',
    profile_photo: '',

    // Contact
    phone_number: '',
    email: '',
    current_address: '',
    permanent_address: '',
    emergency_contact_name: '',
    emergency_contact_number: '',

    // Employment
    company: companyId ? String(companyId) : '',
    branch: '',
    department: '',
    designation: '',
    joining_date: new Date().toISOString().slice(0, 10),
    confirmation_date: '',
    reporting_manager: '',
    employment_type: 'FULL_TIME',
    probation_period_months: '3',
    notice_period_days: '30',
    employment_status: 'ACTIVE',

    // Work & Shift
    work_type: 'OFFICE',
    shift: '',

    // Identity & Bank
    aadhaar_number: '',
    pan_number: '',
    bank_account_holder: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_name: '',
    bank_branch: '',

    // Security / Login Account
    password: '',
    confirm_password: '',
  };

  const [formData, setFormData] = useState(initialForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empList, branchList, compList, shiftList] = await Promise.all([
        fetchEmployees(companyId, search),
        fetchBranches(companyId),
        !isHR ? fetchCompanies() : Promise.resolve([]),
        fetchShifts(companyId),
      ]);
      setEmployees(empList);
      setBranches(branchList);
      setCompanies(compList);
      setShifts(shiftList);
      setManagers(empList);
    } catch (error) {
      console.error('Failed fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  // Open Full Detail Modal (Fetches all details from API)
  const handleOpenDetail = async (emp: EmployeeItem) => {
    setSelectedEmployee(emp);
    setDetailModalVisible(true);
    setDetailLoading(true);
    try {
      const fullDetail = await fetchEmployeeDetail(emp.id);
      setSelectedEmployee(fullDetail);
    } catch (err) {
      console.error('Could not load detailed employee info:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (employee: any) => {
    try {
      const newStatus = !employee.status;
      await updateEmployee(employee.id, {
        status: newStatus,
        employment_status: newStatus ? 'ACTIVE' : 'RESIGNED',
      });
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === employee.id ? { ...emp, status: newStatus } : emp))
      );
      if (selectedEmployee?.id === employee.id) {
        setSelectedEmployee((prev: any) => ({ ...prev, status: newStatus }));
      }
      Alert.alert('Status Updated', `Employee marked as ${newStatus ? 'Active' : 'Inactive'}.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update employee status.');
    }
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingEmployeeId(null);
    setSelectedPhoto(null);
    setActiveTab('basic');
    setFormData({
      ...initialForm,
      company: companyId ? String(companyId) : companies[0]?.id ? String(companies[0].id) : '',
      branch: branches[0]?.id ? String(branches[0].id) : '',
      shift: shifts[0]?.id ? String(shifts[0].id) : '',
    });
    setFormModalVisible(true);
  };

  // Open Edit Form with populated values
  const handleOpenEdit = async (emp: any) => {
    setEditingEmployeeId(emp.id);
    setSelectedPhoto(emp.profile_photo || null);
    setActiveTab('basic');

    // Populate all fields
    setFormData({
      full_name: emp.full_name || '',
      date_of_birth: emp.date_of_birth || '',
      gender: emp.gender || 'MALE',
      profile_photo: emp.profile_photo || '',

      phone_number: emp.phone_number || emp.user?.phone_number || '',
      email: emp.email || '',
      current_address: emp.current_address || '',
      permanent_address: emp.permanent_address || '',
      emergency_contact_name: emp.emergency_contact_name || '',
      emergency_contact_number: emp.emergency_contact_number || '',

      company: emp.company?.id ? String(emp.company.id) : emp.company ? String(emp.company) : (companyId ? String(companyId) : ''),
      branch: emp.branch?.id ? String(emp.branch.id) : emp.branch ? String(emp.branch) : '',
      department: emp.department || '',
      designation: emp.designation || '',
      joining_date: emp.joining_date || '',
      confirmation_date: emp.confirmation_date || '',
      reporting_manager: emp.reporting_manager ? String(emp.reporting_manager) : '',
      employment_type: emp.employment_type || 'FULL_TIME',
      probation_period_months: emp.probation_period_months !== null && emp.probation_period_months !== undefined ? String(emp.probation_period_months) : '3',
      notice_period_days: emp.notice_period_days !== null && emp.notice_period_days !== undefined ? String(emp.notice_period_days) : '30',
      employment_status: emp.employment_status || (emp.status ? 'ACTIVE' : 'RESIGNED'),

      work_type: emp.work_type || 'OFFICE',
      shift: emp.shift?.id ? String(emp.shift.id) : emp.shift ? String(emp.shift) : '',

      aadhaar_number: emp.aadhaar_number || '',
      pan_number: emp.pan_number || '',
      bank_account_holder: emp.bank_account_holder || '',
      bank_account_number: emp.bank_account_number || '',
      bank_ifsc: emp.bank_ifsc || '',
      bank_name: emp.bank_name || '',
      bank_branch: emp.bank_branch || '',

      password: '',
      confirm_password: '',
    });

    setDetailModalVisible(false);
    setFormModalVisible(true);
  };

  // Pick Photo
  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll permissions are required to select a photo.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets[0].uri) {
        setSelectedPhoto(res.assets[0].uri);
      }
    } catch (e) {
      console.error('Image picker error:', e);
    }
  };

  // Submit Form (Create or Edit)
  const handleSubmitForm = async () => {
    if (!formData.full_name.trim()) {
      Alert.alert('Validation Error', 'Please enter Employee Name.');
      setActiveTab('basic');
      return;
    }
    if (!formData.phone_number.trim()) {
      Alert.alert('Validation Error', 'Phone number is required.');
      setActiveTab('contact');
      return;
    }
    if (!formData.branch) {
      Alert.alert('Validation Error', 'Please select an assigned Branch.');
      setActiveTab('employment');
      return;
    }
    if (!formData.department.trim()) {
      Alert.alert('Validation Error', 'Please enter Department.');
      setActiveTab('employment');
      return;
    }
    if (!formData.designation.trim()) {
      Alert.alert('Validation Error', 'Please enter Designation.');
      setActiveTab('employment');
      return;
    }
    if (!formData.shift) {
      Alert.alert('Validation Error', 'Please select an assigned Shift.');
      setActiveTab('work');
      return;
    }
    if (!editingEmployeeId && !formData.password) {
      Alert.alert('Validation Error', 'Password is required for new employee account.');
      setActiveTab('account');
      return;
    }
    if (formData.password && formData.password !== formData.confirm_password) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      setActiveTab('account');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        full_name: formData.full_name.trim(),
        phone_number: formData.phone_number.trim(),
        email: formData.email.trim().toLowerCase(),
        gender: formData.gender,
        date_of_birth: formData.date_of_birth || null,

        current_address: formData.current_address,
        permanent_address: formData.permanent_address,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_number: formData.emergency_contact_number,

        branch: Number(formData.branch),
        department: formData.department.trim(),
        designation: formData.designation.trim(),
        joining_date: formData.joining_date || null,
        confirmation_date: formData.confirmation_date || null,
        reporting_manager: formData.reporting_manager ? Number(formData.reporting_manager) : null,
        employment_type: formData.employment_type,
        probation_period_months: formData.probation_period_months ? Number(formData.probation_period_months) : null,
        notice_period_days: formData.notice_period_days ? Number(formData.notice_period_days) : null,
        employment_status: formData.employment_status,
        status: formData.employment_status === 'ACTIVE',

        work_type: formData.work_type,
        shift: Number(formData.shift),

        aadhaar_number: formData.aadhaar_number.trim(),
        pan_number: formData.pan_number.trim().toUpperCase(),
        bank_account_holder: formData.bank_account_holder.trim(),
        bank_account_number: formData.bank_account_number.trim(),
        bank_ifsc: formData.bank_ifsc.trim().toUpperCase(),
        bank_name: formData.bank_name.trim(),
        bank_branch: formData.bank_branch.trim(),
      };

      if (formData.company) {
        payload.company = Number(formData.company);
      }
      if (formData.password) {
        payload.password = formData.password;
        payload.confirm_password = formData.confirm_password;
      }

      if (editingEmployeeId) {
        await updateEmployee(editingEmployeeId, payload);
        Alert.alert('Success', 'Employee details updated successfully!');
      } else {
        await createEmployee(payload);
        Alert.alert('Success', 'New employee created successfully!');
      }

      setFormModalVisible(false);
      loadData();
    } catch (error: any) {
      console.error('Submit failed:', error);
      const errData = error?.response?.data;
      let msg = 'Failed to save employee.';
      if (typeof errData === 'object' && errData !== null) {
        const firstKey = Object.keys(errData)[0];
        msg = `${firstKey}: ${Array.isArray(errData[firstKey]) ? errData[firstKey][0] : String(errData[firstKey])}`;
      }
      Alert.alert('Submission Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter((emp: any) => {
    // 1. Branch filter
    if (selectedBranch !== 'ALL') {
      const empBranchId = typeof emp.branch === 'object' && emp.branch !== null
        ? emp.branch.id
        : Number(emp.branch);
      if (empBranchId !== Number(selectedBranch)) return false;
    }

    // 2. Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = emp.full_name?.toLowerCase().includes(q);
      const matchId = emp.employee_id?.toLowerCase().includes(q);
      const matchEmail = emp.email?.toLowerCase().includes(q);
      const matchDept = emp.department?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchEmail && !matchDept) return false;
    }

    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <AdminHRHeader
        title="Staff Directory"
        subtitle={`${filteredEmployees.length} registered personnel`}
        role={user?.role || 'ADMIN'}
        companyName={user?.company_name}
        rightAction={
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreate}>
            <UserPlus size={16} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        }
      />

      {/* Search & Branch Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color="#888888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, ID or email..."
            placeholderTextColor="#888888"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={18} color="#888888" />
            </TouchableOpacity>
          ) : null}
        </View>

        {branches.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchFilterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, selectedBranch === 'ALL' && styles.filterChipActive]}
              onPress={() => setSelectedBranch('ALL')}
            >
              <Text style={[styles.filterChipText, selectedBranch === 'ALL' && styles.filterChipTextActive]}>
                All Branches
              </Text>
            </TouchableOpacity>
            {branches.map((b: any) => {
              const bName = (b && (b.name || b.branch_name)) || ('Branch ' + b.id);
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.filterChip, selectedBranch === b.id && styles.filterChipActive]}
                  onPress={() => setSelectedBranch(b.id)}
                >
                  <Text style={[styles.filterChipText, selectedBranch === b.id && styles.filterChipTextActive]}>
                    {bName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Staff Roster List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching staff directory...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEmployees}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleOpenDetail(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  {item.profile_photo ? (
                    <Image source={{ uri: item.profile_photo }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarText}>
                      {item.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.nameBlock}>
                  <Text style={styles.nameText}>{item.full_name}</Text>
                  <Text style={styles.empIdText}>ID: {item.employee_id}</Text>
                </View>
                <View style={[styles.statusTag, item.status ? styles.activeTag : styles.inactiveTag]}>
                  <Text style={[styles.statusTagText, item.status ? styles.activeTagText : styles.inactiveTagText]}>
                    {item.status ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardMetaGrid}>
                <View style={styles.metaCol}>
                  <Briefcase size={13} color="#666666" />
                  <Text style={styles.metaVal}>{item.designation || 'Staff'}</Text>
                </View>
                <View style={styles.metaCol}>
                  <Building size={13} color="#666666" />
                  <Text style={styles.metaVal}>{item.branch_name || 'Main Office'}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.emailRow}>
                  <Mail size={13} color="#888888" />
                  <Text style={styles.emailText} numberOfLines={1}>
                    {item.email}
                  </Text>
                </View>
                <View style={styles.viewLink}>
                  <Text style={styles.viewLinkText}>View Full Details</Text>
                  <ChevronRight size={14} color="#000000" />
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Employees Found</Text>
              <Text style={styles.emptyDesc}>Try adjusting your search criteria or add a new employee.</Text>
            </View>
          }
        />
      )}

      {/* =========================================================================
          VIEW EMPLOYEE: COMPLETE FIELD DISPLAY MODAL (Full Web Feature Parity)
          ========================================================================= */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Employee Details</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Loading all employee details...</Text>
              </View>
            ) : selectedEmployee ? (
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.modalBodyContent, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
                {/* Profile Header */}
                <View style={styles.detailProfileHeader}>
                  <View style={styles.largeAvatar}>
                    {selectedEmployee.profile_photo ? (
                      <Image source={{ uri: selectedEmployee.profile_photo }} style={styles.largeAvatarImg} />
                    ) : (
                      <Text style={styles.largeAvatarText}>
                        {selectedEmployee.full_name
                          ?.split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .substring(0, 2)
                          .toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.profileName}>{selectedEmployee.full_name}</Text>
                  <Text style={styles.profileDesignation}>{selectedEmployee.designation || 'Staff Member'}</Text>
                  <View style={[styles.statusTag, selectedEmployee.status ? styles.activeTag : styles.inactiveTag, { marginTop: 6 }]}>
                    <Text style={[styles.statusTagText, selectedEmployee.status ? styles.activeTagText : styles.inactiveTagText]}>
                      {selectedEmployee.status ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </View>
                </View>

                {/* Section 1: Basic & Personal Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>1. Personal Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Employee ID</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.employee_id || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date of Birth</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.date_of_birth || 'Not Specified'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Gender</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.gender || 'Not Specified'}</Text>
                  </View>
                </View>

                {/* Section 2: Contact & Emergency */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>2. Contact & Emergency Details</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.email || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone Number</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.phone_number || selectedEmployee.user?.phone_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Current Address</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.current_address || 'Not Provided'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Permanent Address</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.permanent_address || 'Not Provided'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Emergency Contact Name</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.emergency_contact_name || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Emergency Phone</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.emergency_contact_number || 'N/A'}</Text>
                  </View>
                </View>

                {/* Section 3: Employment Details */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>3. Employment & Company Records</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Organization</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.company_name || selectedEmployee.company?.name || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Branch</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.branch_name || selectedEmployee.branch?.name || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Department</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.department || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Designation</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.designation || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Joining Date</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.joining_date || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Confirmation Date</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.confirmation_date || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Employment Type</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.employment_type || 'FULL_TIME'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Probation Period</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.probation_period_months ? `${selectedEmployee.probation_period_months} months` : 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Notice Period</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.notice_period_days ? `${selectedEmployee.notice_period_days} days` : 'N/A'}</Text>
                  </View>
                </View>

                {/* Section 4: Work & Shift */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>4. Work Mode & Shift</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Work Mode</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.work_type || 'OFFICE'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Shift</Text>
                    <Text style={styles.detailValue}>
                      {selectedEmployee.shift?.name || (shifts.find(s => s.id === selectedEmployee.shift)?.name) || 'Default General Shift'}
                    </Text>
                  </View>
                </View>

                {/* Section 5: Identity & Banking Details */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>5. Identity & Banking</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Aadhaar Number</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.aadhaar_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>PAN Number</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.pan_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Account Holder Name</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.bank_account_holder || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Bank Account No.</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.bank_account_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>IFSC Code</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.bank_ifsc || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Bank & Branch</Text>
                    <Text style={styles.detailValue}>{selectedEmployee.bank_name ? `${selectedEmployee.bank_name} (${selectedEmployee.bank_branch || ''})` : 'N/A'}</Text>
                  </View>
                </View>

                {/* Action Buttons: Edit and Toggle Status */}
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => handleOpenEdit(selectedEmployee)}
                  >
                    <Text style={styles.editBtnText}>Edit Employee Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      selectedEmployee.status ? styles.deactivateBtn : styles.activateBtn,
                    ]}
                    onPress={() => handleToggleStatus(selectedEmployee)}
                  >
                    {selectedEmployee.status ? (
                      <>
                        <XCircle size={16} color="#FFFFFF" />
                        <Text style={styles.toggleBtnText}>Deactivate</Text>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} color="#FFFFFF" />
                        <Text style={styles.toggleBtnText}>Activate</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =========================================================================
          ADD & EDIT EMPLOYEE: COMPLETE TABBED FORM MODAL (Full Web Feature Parity)
          ========================================================================= */}
      <Modal visible={formModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingEmployeeId ? 'Edit Employee Profile' : 'Add New Employee'}
              </Text>
              <TouchableOpacity onPress={() => setFormModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {/* Form Step Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formTabsScroll}>
              {FORM_TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.formTabItem, activeTab === tab.key && styles.formTabItemActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.formTabText, activeTab === tab.key && styles.formTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: Math.max(insets.bottom + 16, 24) }]} keyboardShouldPersistTaps="handled">
              {/* TAB 1: BASIC INFORMATION */}
              {activeTab === 'basic' && (
                <View>
                  <Text style={styles.formSectionHeader}>Personal Identity</Text>

                  {/* Photo Upload */}
                  <View style={styles.photoUploadContainer}>
                    <TouchableOpacity style={styles.photoBox} onPress={handlePickPhoto}>
                      {selectedPhoto ? (
                        <Image source={{ uri: selectedPhoto }} style={styles.uploadedPhoto} />
                      ) : (
                        <View style={styles.photoPlaceholder}>
                          <Camera size={26} color="#888888" />
                          <Text style={styles.photoPlaceholderText}>Upload Photo</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.formLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Enter full legal name"
                    value={formData.full_name}
                    onChangeText={(t) => setFormData({ ...formData, full_name: t })}
                  />

                  <DatePicker
                    label="Date of Birth"
                    value={formData.date_of_birth}
                    onChange={(d) => setFormData({ ...formData, date_of_birth: d })}
                    placeholder="Select DOB (YYYY-MM-DD)"
                  />

                  <DropdownPicker
                    label="Gender"
                    options={[
                      { label: 'Male', value: 'MALE' },
                      { label: 'Female', value: 'FEMALE' },
                      { label: 'Other', value: 'OTHER' },
                    ]}
                    value={formData.gender}
                    onChange={(v) => setFormData({ ...formData, gender: String(v) })}
                  />

                  <TouchableOpacity style={styles.nextStepBtn} onPress={() => setActiveTab('contact')}>
                    <Text style={styles.nextStepBtnText}>Next: Contact & Emergency →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* TAB 2: CONTACT & EMERGENCY */}
              {activeTab === 'contact' && (
                <View>
                  <Text style={styles.formSectionHeader}>Phone, Email & Address</Text>

                  <Text style={styles.formLabel}>Mobile Number *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="10-digit mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={formData.phone_number}
                    onChangeText={(t) => setFormData({ ...formData, phone_number: t })}
                  />

                  <Text style={styles.formLabel}>Email Address</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="official or personal email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(t) => setFormData({ ...formData, email: t })}
                  />

                  <Text style={styles.formLabel}>Current Address</Text>
                  <TextInput
                    style={[styles.formInput, { height: 65, textAlignVertical: 'top' }]}
                    placeholder="Current residential address"
                    multiline
                    value={formData.current_address}
                    onChangeText={(t) => setFormData({ ...formData, current_address: t })}
                  />

                  <Text style={styles.formLabel}>Permanent Address</Text>
                  <TextInput
                    style={[styles.formInput, { height: 65, textAlignVertical: 'top' }]}
                    placeholder="Permanent address"
                    multiline
                    value={formData.permanent_address}
                    onChangeText={(t) => setFormData({ ...formData, permanent_address: t })}
                  />

                  <Text style={styles.formLabel}>Emergency Contact Person</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Name of family member / guardian"
                    value={formData.emergency_contact_name}
                    onChangeText={(t) => setFormData({ ...formData, emergency_contact_name: t })}
                  />

                  <Text style={styles.formLabel}>Emergency Contact Number</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Emergency phone number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={formData.emergency_contact_number}
                    onChangeText={(t) => setFormData({ ...formData, emergency_contact_number: t })}
                  />

                  <TouchableOpacity style={styles.nextStepBtn} onPress={() => setActiveTab('employment')}>
                    <Text style={styles.nextStepBtnText}>Next: Employment Details →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* TAB 3: EMPLOYMENT DETAILS */}
              {activeTab === 'employment' && (
                <View>
                  <Text style={styles.formSectionHeader}>Company, Branch & Designation</Text>

                  {!isHR && companies.length > 0 && (
                    <DropdownPicker
                      label="Company / Organization *"
                      options={companies.map((c) => ({ label: c.name, value: String(c.id) }))}
                      value={formData.company}
                      onChange={(v) => setFormData({ ...formData, company: String(v) })}
                      placeholder="Select Organization"
                      required
                    />
                  )}

                  <DropdownPicker
                    label="Assigned Branch *"
                    options={branches.map((b) => ({ label: b.name, value: String(b.id), sublabel: b.address }))}
                    value={formData.branch}
                    onChange={(v) => setFormData({ ...formData, branch: String(v) })}
                    placeholder="Select Branch"
                    required
                  />

                  <Text style={styles.formLabel}>Department *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Engineering, Sales, HR"
                    value={formData.department}
                    onChangeText={(t) => setFormData({ ...formData, department: t })}
                  />

                  <Text style={styles.formLabel}>Designation *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Senior Software Developer"
                    value={formData.designation}
                    onChangeText={(t) => setFormData({ ...formData, designation: t })}
                  />

                  <DatePicker
                    label="Joining Date *"
                    value={formData.joining_date}
                    onChange={(d) => setFormData({ ...formData, joining_date: d })}
                    placeholder="Date of Joining"
                    required
                  />

                  <DatePicker
                    label="Confirmation Date"
                    value={formData.confirmation_date}
                    onChange={(d) => setFormData({ ...formData, confirmation_date: d })}
                    placeholder="Date of Confirmation"
                  />

                  <DropdownPicker
                    label="Employment Type"
                    options={[
                      { label: 'Full Time', value: 'FULL_TIME' },
                      { label: 'Part Time', value: 'PART_TIME' },
                      { label: 'Contract', value: 'CONTRACT' },
                      { label: 'Intern', value: 'INTERN' },
                      { label: 'Temporary', value: 'TEMPORARY' },
                    ]}
                    value={formData.employment_type}
                    onChange={(v) => setFormData({ ...formData, employment_type: String(v) })}
                  />

                  <DropdownPicker
                    label="Reporting Manager"
                    options={[
                      { label: 'None', value: '' },
                      ...managers.map((m) => ({ label: `${m.full_name} (${m.employee_id})`, value: String(m.id) })),
                    ]}
                    value={formData.reporting_manager}
                    onChange={(v) => setFormData({ ...formData, reporting_manager: String(v) })}
                  />

                  <Text style={styles.formLabel}>Probation Period (Months)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 3"
                    keyboardType="number-pad"
                    value={formData.probation_period_months}
                    onChangeText={(t) => setFormData({ ...formData, probation_period_months: t })}
                  />

                  <Text style={styles.formLabel}>Notice Period (Days)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 30"
                    keyboardType="number-pad"
                    value={formData.notice_period_days}
                    onChangeText={(t) => setFormData({ ...formData, notice_period_days: t })}
                  />

                  <TouchableOpacity style={styles.nextStepBtn} onPress={() => setActiveTab('work')}>
                    <Text style={styles.nextStepBtnText}>Next: Work & Shift →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* TAB 4: WORK & SHIFT */}
              {activeTab === 'work' && (
                <View>
                  <Text style={styles.formSectionHeader}>Work Mode & Working Shifts</Text>

                  <DropdownPicker
                    label="Work Mode *"
                    options={[
                      { label: 'Office', value: 'OFFICE', sublabel: 'Works inside company office' },
                      { label: 'Field / Marketing', value: 'FIELD', sublabel: 'Travels to client sites' },
                    ]}
                    value={formData.work_type}
                    onChange={(v) => setFormData({ ...formData, work_type: String(v) })}
                    required
                  />

                  <DropdownPicker
                    label="Assigned Shift *"
                    options={shifts.map((s) => ({
                      label: s.name,
                      value: String(s.id),
                      sublabel: `${s.start_time} - ${s.end_time}`,
                    }))}
                    value={formData.shift}
                    onChange={(v) => setFormData({ ...formData, shift: String(v) })}
                    placeholder="Select Shift"
                    required
                  />

                  <TouchableOpacity style={styles.nextStepBtn} onPress={() => setActiveTab('bank')}>
                    <Text style={styles.nextStepBtnText}>Next: Identity & Bank Details →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* TAB 5: IDENTITY & BANKING */}
              {activeTab === 'bank' && (
                <View>
                  <Text style={styles.formSectionHeader}>Government ID & Payroll Bank</Text>

                  <Text style={styles.formLabel}>Aadhaar Number (12 digits)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="XXXX XXXX XXXX"
                    keyboardType="number-pad"
                    maxLength={14}
                    value={formData.aadhaar_number}
                    onChangeText={(t) => setFormData({ ...formData, aadhaar_number: t })}
                  />

                  <Text style={styles.formLabel}>PAN Card Number</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. ABCDE1234F"
                    autoCapitalize="characters"
                    maxLength={10}
                    value={formData.pan_number}
                    onChangeText={(t) => setFormData({ ...formData, pan_number: t.toUpperCase() })}
                  />

                  <Text style={styles.formLabel}>Bank Account Holder Name</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Account name as per passbook"
                    value={formData.bank_account_holder}
                    onChangeText={(t) => setFormData({ ...formData, bank_account_holder: t })}
                  />

                  <Text style={styles.formLabel}>Bank Account Number</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Bank account number"
                    keyboardType="number-pad"
                    value={formData.bank_account_number}
                    onChangeText={(t) => setFormData({ ...formData, bank_account_number: t })}
                  />

                  <Text style={styles.formLabel}>Bank IFSC Code</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. HDFC0001234"
                    autoCapitalize="characters"
                    maxLength={11}
                    value={formData.bank_ifsc}
                    onChangeText={(t) => setFormData({ ...formData, bank_ifsc: t.toUpperCase() })}
                  />

                  <Text style={styles.formLabel}>Bank Name</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. HDFC Bank"
                    value={formData.bank_name}
                    onChangeText={(t) => setFormData({ ...formData, bank_name: t })}
                  />

                  <Text style={styles.formLabel}>Bank Branch Name</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Branch location"
                    value={formData.bank_branch}
                    onChangeText={(t) => setFormData({ ...formData, bank_branch: t })}
                  />

                  <TouchableOpacity style={styles.nextStepBtn} onPress={() => setActiveTab('account')}>
                    <Text style={styles.nextStepBtnText}>Next: Login Credentials →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* TAB 6: SECURITY & CREDENTIALS */}
              {activeTab === 'account' && (
                <View>
                  <Text style={styles.formSectionHeader}>Login Credentials & Security</Text>

                  <Text style={styles.formLabel}>
                    {editingEmployeeId ? 'New Password (Leave blank to keep unchanged)' : 'Password *'}
                  </Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                      placeholder="Minimum 8 characters"
                      secureTextEntry={!showPassword}
                      value={formData.password}
                      onChangeText={(t) => setFormData({ ...formData, password: t })}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} color="#666666" /> : <Eye size={18} color="#666666" />}
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.formLabel, { marginTop: 12 }]}>Confirm Password</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Re-enter password"
                    secureTextEntry={!showPassword}
                    value={formData.confirm_password}
                    onChangeText={(t) => setFormData({ ...formData, confirm_password: t })}
                  />

                  {/* Submit Final Button */}
                  <TouchableOpacity
                    style={styles.submitFinalBtn}
                    onPress={handleSubmitForm}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitFinalBtnText}>
                        {editingEmployeeId ? 'Save Updated Profile' : 'Complete Employee Registration'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
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
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666666',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    gap: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
  },

  // Search & Filter
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    padding: 0,
  },
  branchFilterScroll: {
    flexDirection: 'row',
    marginTop: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: '#000000',
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#444444',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // Cards List
  listContent: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: colors.surfaceSecondary,
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 44,
    height: 44,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  nameBlock: {
    flex: 1,
  },
  nameText: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  empIdText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeTag: {
    backgroundColor: colors.surfaceSecondary,
  },
  inactiveTag: {
    backgroundColor: colors.surfaceSecondary,
  },
  statusTagText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
    letterSpacing: 0.5,
  },
  activeTagText: {
    color: '#000000',
  },
  inactiveTagText: {
    color: '#000000',
  },
  cardMetaGrid: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    gap: 16,
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaVal: {
    fontSize: 12,
    color: '#444444',
    fontFamily: 'Comfortaa_500Medium',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  emailText: {
    fontSize: 12,
    color: '#666666',
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewLinkText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#000000',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#222222',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    marginTop: 4,
  },

  // Modal Container
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    zIndex: 99999,
    elevation: 99999,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    width: '100%',
    elevation: 100000,
    zIndex: 100000,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  modalBodyContent: {
    paddingBottom: 20,
  },

  // View Details Styles
  detailProfileHeader: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    marginBottom: 16,
  },
  largeAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  largeAvatarImg: {
    width: 72,
    height: 72,
  },
  largeAvatarText: {
    fontSize: 24,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  profileName: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  profileDesignation: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  detailSection: {
    marginBottom: 20,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'Comfortaa_500Medium',
    flex: 1,
  },
  detailValue: {
    fontSize: 12,
    color: '#000000',
    fontFamily: 'Comfortaa_600SemiBold',
    flex: 1.5,
    textAlign: 'right',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 30,
  },
  editBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  editBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 14,
  },
  statusToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  deactivateBtn: {
    backgroundColor: colors.primary,
  },
  activateBtn: {
    backgroundColor: colors.primary,
  },
  toggleBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 14,
  },

  // Add / Edit Form Styles
  formTabsScroll: {
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  formTabItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  formTabItemActive: {
    borderBottomColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  formTabText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#666666',
  },
  formTabTextActive: {
    color: '#000000',
    fontFamily: 'Comfortaa_700Bold',
  },
  formSectionHeader: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  photoUploadContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  photoBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
  },
  uploadedPhoto: {
    width: 88,
    height: 88,
  },
  photoPlaceholder: {
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 10,
    color: '#666666',
    marginTop: 4,
    fontFamily: 'Comfortaa_600SemiBold',
  },
  formLabel: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#222222',
    marginBottom: 6,
    marginTop: 10,
  },
  formInput: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
    marginBottom: 6,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeBtn: {
    padding: 10,
    marginLeft: -40,
  },
  nextStepBtn: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  nextStepBtnText: {
    color: '#000000',
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
  },
  submitFinalBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitFinalBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
  },
});
