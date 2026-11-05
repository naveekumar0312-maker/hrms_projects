import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import { api } from '../context/AuthContext';
import { COLORS } from '../constants/theme';
import { useAppMessage } from '../context/MessageContext';

export default function ChangePasswordScreen({ navigation }: any) {
  const { showSuccess, showError } = useAppMessage();
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async () => {
    setError('');
    setSuccess('');

    if (!currentPassword.trim()) {
      setError('Current password is required.');
      return;
    }
    if (!newPassword) {
      setError('New password is required.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (!confirmPassword) {
      setError('Please confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from current password.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/employees/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      const successMsg = res.data?.message || 'Password changed successfully.';
      setSuccess(successMsg);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      showSuccess('Password Changed', successMsg, () => navigation.goBack());
    } catch (err: any) {
      if (err.response?.data) {
        const d = err.response.data;
        const msg =
          d.current_password?.[0] ||
          d.new_password?.[0] ||
          d.confirm_password?.[0] ||
          d.detail ||
          d.error ||
          'Failed to change password. Please check your current password.';
        setError(msg);
      } else {
        setError('Network error. Unable to reach server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" hidden={false} />

      {/* TOP APP BAR */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#000000" strokeWidth={2.2} />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>Change Password</Text>

        <View style={styles.topBarRightPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Header Hint */}
            <Text style={styles.instructionText}>
              Ensure your account is using a secure password. Enter your current
              password and specify a new one.
            </Text>

            {/* Error Message */}
            {error ? (
              <View style={styles.alertError}>
                <Text style={styles.alertErrorText}>{error}</Text>
              </View>
            ) : null}

            {/* Success Message */}
            {success ? (
              <View style={styles.alertSuccess}>
                <CheckCircle size={16} color={COLORS.success} strokeWidth={2} />
                <Text style={styles.alertSuccessText}>{success}</Text>
              </View>
            ) : null}

            {/* Current Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Current Password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  secureTextEntry={!showCurrent}
                  value={currentPassword}
                  onChangeText={(text) => {
                    setCurrentPassword(text);
                    setError('');
                  }}
                  placeholder="Enter current password"
                  placeholderTextColor="#888888"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowCurrent(!showCurrent)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showCurrent ? (
                    <EyeOff size={20} color="#666666" strokeWidth={2} />
                  ) : (
                    <Eye size={20} color="#666666" strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>New Password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    setError('');
                  }}
                  placeholder="Enter new password"
                  placeholderTextColor="#888888"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowNew(!showNew)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showNew ? (
                    <EyeOff size={20} color="#666666" strokeWidth={2} />
                  ) : (
                    <Eye size={20} color="#666666" strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm New Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Confirm New Password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setError('');
                  }}
                  placeholder="Confirm new password"
                  placeholderTextColor="#888888"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirm(!showConfirm)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showConfirm ? (
                    <EyeOff size={20} color="#666666" strokeWidth={2} />
                  ) : (
                    <Eye size={20} color="#666666" strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleUpdatePassword}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },

  // Top Navigation Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    textAlign: 'center',
  },
  topBarRightPlaceholder: {
    width: 40,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Main Form Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  instructionText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 19,
    marginBottom: 20,
  },

  alertError: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  alertErrorText: {
    fontSize: 13,
    color: '#000000',
    fontFamily: 'Comfortaa_600SemiBold',
  },

  alertSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  alertSuccessText: {
    fontSize: 13,
    color: COLORS.success,
    fontFamily: 'Comfortaa_600SemiBold',
  },

  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#222222',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  submitBtn: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
