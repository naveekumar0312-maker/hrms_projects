import { StatusBar } from 'expo-status-bar';
import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext, api } from '../context/AuthContext';
import { User, Lock, LogOut, ArrowRight, Pencil } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Pattern,
  Rect,
} from 'react-native-svg';
import { COLORS } from '../constants/theme';
import { useAppMessage } from '../context/MessageContext';
import { resolveMediaUrl } from '../utils/imageUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_HEIGHT = 220; // Perfect curved wave header height

const BLUE_ICON_COLOR = '#0757B8'; // Royal Blue for menu icons
const ARROW_COLOR = '#071F49'; // Deep Navy arrow matching corporate theme

export default function ProfileScreen({ navigation }: any) {
  const { showSuccess, showError, showWarning, showConfirm } = useAppMessage();
  const insets = useSafeAreaInsets();
  const { logout, employee, refreshEmployee } = useContext(AuthContext);
  const [uploading, setUploading] = useState(false);
  const [viewPhotoModal, setViewPhotoModal] = useState(false);

  const [showPersonalInfo, setShowPersonalInfo] = useState(false);

  // Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    setPasswordError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      await api.post('/employees/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      showSuccess('Success', 'Password changed successfully.');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err.response?.data) {
        const d = err.response.data;
        const msg =
          d.current_password?.[0] ||
          d.new_password?.[0] ||
          d.confirm_password?.[0] ||
          d.detail ||
          'Failed to change password.';
        setPasswordError(msg);
      } else {
        setPasswordError('Failed to change password. Please try again.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleUploadPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showWarning('Permission Needed', 'Please allow access to your media library to update your photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setUploading(true);
        const formData = new FormData();
        const asset = result.assets[0];
        const filename = asset.uri.split('/').pop() || 'photo.jpg';
        const type = asset.mimeType || 'image/jpeg';

        (formData as any).append('profile_photo', {
          uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
          name: filename,
          type: type,
        });

        await api.patch('/employees/me/', formData, {
          transformRequest: (data, headers) => {
            if (headers) {
              delete headers['Content-Type'];
            }
            return data;
          },
        });

        await refreshEmployee();
        showSuccess('Success', 'Profile photo updated successfully!');
      }
    } catch (error) {
      console.log('Error uploading photo:', error);
      showError('Error', 'Failed to update profile photo.');
    } finally {
      setUploading(false);
    }
  };

  const getImageUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith('http')) {
      if (url.includes('127.0.0.1') || url.includes('localhost')) {
        try {
          const path = new URL(url).pathname;
          return `${process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://10.0.2.2:8000'}${path}`;
        } catch (e) {
          return url;
        }
      }
      return url;
    }
    return `${process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://10.0.2.2:8000'}${url}`;
  };

  const confirmLogout = () => {
    showConfirm({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: logout,
    });
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar style="dark" hidden={false} />

      

      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* EMPLOYEE ID BADGE AT UPPER RIGHT */}
        <View style={styles.topBadgeRow}>
          <View style={styles.empIdBadge}>
            <Text style={styles.empIdText}>
              #ID: {employee?.employee_id || 'AH044'}
            </Text>
          </View>
        </View>

        {/* PROFILE HEADER: AVATAR + NAME + DESIGNATION */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBorderWrapper}>
              {employee?.profile_photo ? (
                <Image
                  source={{ uri: resolveMediaUrl(employee.profile_photo)! }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {employee?.full_name?.charAt(0) || 'U'}
                  </Text>
                </View>
              )}
            </View>

            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#FFF" />
              </View>
            )}

            <TouchableOpacity
              style={styles.editPhotoBtn}
              onPress={handleUploadPhoto}
              activeOpacity={0.8}
            >
              <Pencil size={13} color="#0757B8" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={styles.profileInfoTextCol}>
            <Text
              style={styles.employeeName}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {employee?.full_name || '--'}
            </Text>
            <Text
              style={styles.employeeRole}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {employee?.designation || employee?.role || 'Employee'}
            </Text>
          </View>
        </View>

        {/* 3 MENU ROWS */}
        <View style={styles.menuContainer}>
          {/* 1. Personal Information */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={() => navigation.navigate('PersonalInfo')}
            activeOpacity={0.65}
          >
            <View style={styles.menuIconBox}>
              <User size={22} color={BLUE_ICON_COLOR} strokeWidth={2.2} />
            </View>
            <Text style={styles.menuTitle}>Personal Information</Text>
            <ArrowRight size={22} color={ARROW_COLOR} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 2. Change Password */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={() => navigation.navigate('ChangePassword')}
            activeOpacity={0.65}
          >
            <View style={styles.menuIconBox}>
              <Lock size={22} color={BLUE_ICON_COLOR} strokeWidth={2.2} />
            </View>
            <Text style={styles.menuTitle}>Change Password</Text>
            <ArrowRight size={22} color={ARROW_COLOR} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 3. Logout */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={confirmLogout}
            activeOpacity={0.65}
          >
            <View style={styles.menuIconBox}>
              <LogOut size={22} color={BLUE_ICON_COLOR} strokeWidth={2.2} />
            </View>
            <Text style={styles.menuTitle}>Logout</Text>
            <ArrowRight size={22} color={ARROW_COLOR} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* PERSONAL INFO MODAL */}
      <Modal visible={showPersonalInfo}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPersonalInfo(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Personal Information</Text>
            <TouchableOpacity
              onPress={() => setShowPersonalInfo(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Employee ID</Text>
              <Text style={styles.infoValue}>
                {employee?.employee_id || '--'}
              </Text>
            </View>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Employee Name</Text>
              <Text style={styles.infoValue}>
                {employee?.full_name || '--'}
              </Text>
            </View>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{employee?.email || '--'}</Text>
            </View>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>
                {employee?.phone_number || '--'}
              </Text>
            </View>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>{employee?.role || '--'}</Text>
            </View>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Company</Text>
              <Text style={styles.infoValue}>
                {employee?.company?.name || '--'}
              </Text>
            </View>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Branch</Text>
              <Text style={styles.infoValue}>
                {employee?.branch?.branch_name || '--'}
              </Text>
            </View>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Department</Text>
              <Text style={styles.infoValue}>
                {employee?.department || '--'}
              </Text>
            </View>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Designation</Text>
              <Text style={styles.infoValue}>
                {employee?.designation || '--'}
              </Text>
            </View>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Work Type</Text>
              <Text style={styles.infoValue}>
                {employee?.work_type || '--'}
              </Text>
            </View>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Shift</Text>
              <Text style={styles.infoValue}>
                {employee?.shift?.name || '--'}
              </Text>
            </View>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>
                {employee?.status ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* CHANGE PASSWORD MODAL */}
      <Modal visible={showPasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity
              onPress={() => setShowPasswordModal(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <TextInput
              style={styles.inputField}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
            />

            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              style={styles.inputField}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
            />

            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.inputField}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
            />

            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                isChangingPassword && styles.primaryBtnDisabled,
              ]}
              onPress={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Change Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full-Screen Profile Photo Viewer Modal */}
      <Modal visible={viewPhotoModal} transparent animationType="fade">
        <View style={styles.fullPhotoModalOverlay}>
          <TouchableOpacity
            style={styles.closePhotoBtn}
            onPress={() => setViewPhotoModal(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closePhotoBtnText}>✕ Close</Text>
          </TouchableOpacity>

          {employee?.profile_photo && (
            <Image
              source={{ uri: resolveMediaUrl(employee.profile_photo)! }}
              style={styles.fullPhotoImage}
              resizeMode="contain"
            />
          )}

          <TouchableOpacity
            style={styles.changeFromViewerBtn}
            onPress={() => {
              setViewPhotoModal(false);
              handleUploadPhoto();
            }}
          >
            <Pencil size={15} color="#FFFFFF" />
            <Text style={styles.changeFromViewerText}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  fullPhotoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  closePhotoBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 10,
  },
  closePhotoBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
  },
  fullPhotoImage: {
    width: '100%',
    height: '70%',
    borderRadius: 16,
  },
  changeFromViewerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0056B3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  changeFromViewerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: SCREEN_WIDTH,
    height: HEADER_HEIGHT,
    overflow: 'hidden',
  },
  container: {
    flex: 1,
  },

  // Upper right badge for Employee ID
  topBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 8,
  },
  empIdBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAD7A5',
    shadowColor: '#071F49',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  empIdText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#071F49',
    letterSpacing: 0.3,
  },

  // Profile Section: avatar with white border + pen badge, text alongside
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 10,
    marginBottom: 36,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarBorderWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8F1FC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 34,
    color: '#0757B8',
    fontFamily: 'Comfortaa_700Bold',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPhotoBtn: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    backgroundColor: '#FFFFFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },

  profileInfoTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  employeeName: {
    fontSize: 22,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  employeeRole: {
    fontSize: 14,
    fontFamily: 'Comfortaa_500Medium',
    color: '#666666',
  },

  // 3 Menu rows
  menuContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: 'transparent',
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    letterSpacing: -0.1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.surfaceSecondary,
    marginHorizontal: 8,
  },

  // Modal styles preserved
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 20, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  modalCloseBtn: { padding: 4 },
  modalCloseText: { fontSize: 16, color: COLORS.primary, fontFamily: 'Comfortaa_600SemiBold', },
  modalScroll: { padding: 20, paddingBottom: 60 },
  infoGroup: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  infoLabel: { fontSize: 12, color: COLORS.muted, marginBottom: 4 },
  infoValue: { fontSize: 16, fontFamily: 'Comfortaa_600SemiBold', color: COLORS.dark },

  modalBody: { padding: 24, flex: 1 },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Comfortaa_600SemiBold',
    color: COLORS.dark,
    marginBottom: 8,
    marginTop: 16,
  },
  inputField: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.dark,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Comfortaa_700Bold', },
  errorText: { color: COLORS.danger, marginTop: 12, fontSize: 14 },
});
