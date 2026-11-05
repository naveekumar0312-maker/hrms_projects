import { StatusBar } from 'expo-status-bar';
import React, { useState, useContext, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  ScrollView,
  Keyboard,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, ArrowRight, Check } from 'lucide-react-native';
import { useAppMessage } from '../context/MessageContext';

const LOGO_WITH_TAGLINE = require('../../assets/branding/yaazh360-logo-tagline.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const REMEMBER_ME_KEY = 'yaazh360_remember_username';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocusedIdentifier, setIsFocusedIdentifier] = useState(false);
  const [isFocusedPassword, setIsFocusedPassword] = useState(false);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const { login } = useContext(AuthContext);
  const { showError, showInfo } = useAppMessage();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<any>(null);

  // Load remembered username on mount
  useEffect(() => {
    (async () => {
      try {
        const savedUsername = await SecureStore.getItemAsync(REMEMBER_ME_KEY);
        if (savedUsername) {
          setIdentifier(savedUsername);
          setRememberMe(true);
        }
      } catch (err) {
        console.log('Error reading saved username:', err);
      }
    })();
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setPassword('');
      setIsSubmitting(false);
      setIsFocusedIdentifier(false);
      setIsFocusedPassword(false);
    }, [])
  );

  const handleIdentifierFocus = () => {
    setIsFocusedIdentifier(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 60, animated: true });
    }, 150);
  };

  const handlePasswordFocus = () => {
    setIsFocusedPassword(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 120, animated: true });
    }, 150);
  };

  const handleLogin = async () => {
    if (!identifier.trim()) {
      showError('Validation Error', 'Please enter your username or email');
      return;
    }
    if (!password) {
      showError('Validation Error', 'Please enter your password');
      return;
    }

    try {
      setIsSubmitting(true);

      // Handle Remember Me persistence
      if (rememberMe) {
        await SecureStore.setItemAsync(REMEMBER_ME_KEY, identifier.trim());
      } else {
        await SecureStore.deleteItemAsync(REMEMBER_ME_KEY);
      }

      await login(identifier.trim(), password);
    } catch (err: any) {
      let message = 'Login failed. Please check your credentials.';
      if (err?.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') {
          message = data;
        } else if (data.detail) {
          message = data.detail;
        } else if (data.non_field_errors) {
          message = Array.isArray(data.non_field_errors)
            ? data.non_field_errors[0]
            : data.non_field_errors;
        } else {
          const firstKey = Object.keys(data)[0];
          if (firstKey && data[firstKey]) {
            const fieldError = data[firstKey];
            message = `${firstKey}: ${
              Array.isArray(fieldError) ? fieldError[0] : fieldError
            }`;
          }
        }
      } else if (err?.message) {
        message = err.message;
      }
      showError('Sign In Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    showInfo(
      'Forgot Password',
      'Please contact your organization HR or System Administrator to reset your password.'
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" hidden={false} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 20, 36),
              paddingBottom: keyboardVisible
                ? Math.max(keyboardHeight + 20, 160)
                : Math.max(insets.bottom + 28, 40),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* BRANDING: ORIGINAL LOGO WITH TAGLINE */}
          <View style={styles.brandingSection}>
            <View style={styles.logoFrame}>
              <Image
                source={LOGO_WITH_TAGLINE}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* HRMS BADGE SEPARATOR */}
            <View style={styles.hrmsBadgeContainer}>
              <View style={styles.badgeLine} />
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>HRMS</Text>
              </View>
              <View style={styles.badgeLine} />
            </View>
          </View>

          {/* WELCOME SECTION */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to your HRMS account
            </Text>
          </View>

          {/* FORM CONTAINER */}
          <View style={styles.formContainer}>
            {/* USERNAME INPUT */}
            <View
              style={[
                styles.inputWrapper,
                isFocusedIdentifier && styles.inputWrapperFocused,
              ]}
            >
              <User
                size={20}
                color={isFocusedIdentifier ? '#111827' : '#9CA3AF'}
                strokeWidth={1.8}
                style={styles.inputIconLeft}
              />
              <TextInput
                style={styles.textInput}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="Username"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                onFocus={handleIdentifierFocus}
                onBlur={() => setIsFocusedIdentifier(false)}
              />
            </View>

            {/* PASSWORD INPUT */}
            <View
              style={[
                styles.inputWrapper,
                isFocusedPassword && styles.inputWrapperFocused,
              ]}
            >
              <Lock
                size={20}
                color={isFocusedPassword ? '#111827' : '#9CA3AF'}
                strokeWidth={1.8}
                style={styles.inputIconLeft}
              />
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isSubmitting}
                onFocus={handlePasswordFocus}
                onBlur={() => setIsFocusedPassword(false)}
              />
              <TouchableOpacity
                style={styles.eyeIconButton}
                onPress={() => setShowPassword((prev) => !prev)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#6B7280" strokeWidth={1.8} />
                ) : (
                  <Eye size={20} color="#6B7280" strokeWidth={1.8} />
                )}
              </TouchableOpacity>
            </View>

            {/* REMEMBER ME & FORGOT PASSWORD ROW */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe((prev) => !prev)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxSelected,
                  ]}
                >
                  {rememberMe && (
                    <Check size={13} color="#FFFFFF" strokeWidth={3} />
                  )}
                </View>
                <Text style={styles.rememberMeLabel}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleForgotPassword}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.forgotPasswordLabel}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* SIGN IN BUTTON */}
            <TouchableOpacity
              style={[
                styles.signInButton,
                isSubmitting && styles.signInButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isSubmitting}
              activeOpacity={0.88}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.signInButtonContent}>
                  <Text style={styles.signInButtonText}>Sign In</Text>
                  <ArrowRight
                    size={19}
                    color="#FFFFFF"
                    strokeWidth={2.4}
                    style={styles.signInArrowIcon}
                  />
                </View>
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

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  /* BRANDING SECTION */
  brandingSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },

  logoFrame: {
    width: Math.min(SCREEN_WIDTH * 0.78, 320),
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoImage: {
    width: '100%',
    height: '100%',
  },

  /* HRMS BADGE SEPARATOR */
  hrmsBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 290,
    marginTop: 10,
    marginBottom: 16,
  },

  badgeLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },

  badgePill: {
    paddingHorizontal: 24,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 14,
  },

  badgeText: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#111827',
    letterSpacing: 2.2,
  },

  /* WELCOME SECTION */
  welcomeSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    width: '100%',
  },

  welcomeTitle: {
    fontSize: 27,
    fontFamily: 'Comfortaa_700Bold',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },

  welcomeSubtitle: {
    fontSize: 14.5,
    fontFamily: 'Comfortaa_500Medium',
    color: '#6B7280',
    textAlign: 'center',
  },

  /* FORM CONTAINER */
  formContainer: {
    width: '100%',
    maxWidth: 380,
  },

  inputWrapper: {
    width: '100%',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  inputWrapperFocused: {
    borderColor: '#111827',
    borderWidth: 1.5,
  },

  inputIconLeft: {
    marginRight: 12,
  },

  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Comfortaa_500Medium',
    color: '#111827',
    paddingVertical: 0,
  },

  eyeIconButton: {
    padding: 6,
    marginLeft: 6,
  },

  /* REMEMBER ME & FORGOT PASSWORD */
  optionsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 24,
    paddingHorizontal: 2,
  },

  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  checkboxSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },

  rememberMeLabel: {
    fontSize: 13.5,
    color: '#374151',
    fontFamily: 'Comfortaa_500Medium',
  },

  forgotPasswordLabel: {
    fontSize: 13.5,
    color: '#111827',
    fontFamily: 'Comfortaa_600SemiBold',
  },

  /* SIGN IN BUTTON */
  signInButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },

  signInButtonDisabled: {
    opacity: 0.7,
  },

  signInButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    letterSpacing: 0.2,
  },

  signInArrowIcon: {
    marginLeft: 8,
  },
});
