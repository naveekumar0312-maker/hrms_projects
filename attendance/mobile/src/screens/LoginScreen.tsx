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
import { User, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useAppMessage } from '../context/MessageContext';

const ARCH_IMAGE = require('../../assets/branding/office-team-unsplash.jpg');
const BRAND_LOGO = require('../../assets/branding/yaazh360-logo-transparent.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const REMEMBER_ME_KEY = 'yaazh360_remember_username';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
      scrollViewRef.current?.scrollTo({ y: 140, animated: true });
    }, 150);
  };

  const handlePasswordFocus = () => {
    setIsFocusedPassword(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 200, animated: true });
    }, 150);
  };

  const handleLogin = async () => {
    if (!identifier.trim()) {
      showError('Validation Error', 'Please enter your username');
      return;
    }
    if (!password) {
      showError('Validation Error', 'Please enter your password');
      return;
    }

    try {
      setIsSubmitting(true);

      // Save identifier for convenience like desktop
      await SecureStore.setItemAsync(REMEMBER_ME_KEY, identifier.trim());

      await login(identifier.trim(), password);
    } catch (err: any) {
      let message = 'Unable to sign in. Please verify your credentials and try again.';
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
      'Please contact your organization administrator or HR to reset your password.'
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

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
              paddingBottom: keyboardVisible
                ? Math.max(keyboardHeight + 20, 160)
                : Math.max(insets.bottom + 20, 32),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* TOP ARCH HERO IMAGE (Exact Desktop Split-Login Style) */}
          <View style={styles.heroArchContainer}>
            <View style={styles.heroArchMask}>
              <Image
                source={ARCH_IMAGE}
                style={styles.heroArchImage}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* MAIN CONTENT AREA */}
          <View style={styles.contentContainer}>
            <View style={styles.cardContainer}>
              {/* WELCOME HEADER */}
              <View style={styles.welcomeHeader}>
                <Text style={styles.welcomeTitle}>Welcome to Hrms !</Text>
                <Text style={styles.welcomeSubtitle}>
                  Please Login to your Account
                </Text>
              </View>

              {/* FORM */}
              <View style={styles.formContainer}>
                {/* USERNAME INPUT (Clean Underline Style) */}
                <View
                  style={[
                    styles.fieldRow,
                    isFocusedIdentifier && styles.fieldRowFocused,
                  ]}
                >
                  <User
                    size={19}
                    color={isFocusedIdentifier ? '#E56108' : '#94A3B8'}
                    strokeWidth={2}
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder="Username"
                    placeholderTextColor="#A0AEC0"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                    onFocus={handleIdentifierFocus}
                    onBlur={() => setIsFocusedIdentifier(false)}
                  />
                </View>

                {/* PASSWORD INPUT (Clean Underline Style) */}
                <View
                  style={[
                    styles.fieldRow,
                    isFocusedPassword && styles.fieldRowFocused,
                  ]}
                >
                  <Lock
                    size={19}
                    color={isFocusedPassword ? '#E56108' : '#94A3B8'}
                    strokeWidth={2}
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#A0AEC0"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isSubmitting}
                    onFocus={handlePasswordFocus}
                    onBlur={() => setIsFocusedPassword(false)}
                  />
                  <TouchableOpacity
                    style={styles.pwdToggleBtn}
                    onPress={() => setShowPassword((prev) => !prev)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {showPassword ? (
                      <EyeOff size={19} color="#94A3B8" strokeWidth={2} />
                    ) : (
                      <Eye size={19} color="#94A3B8" strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                </View>

                {/* ACTION ROW: FORGOT PASSWORD & SUBMIT PILL */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.forgotBtnText}>Forgot your Password ?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.submitPill,
                      isSubmitting && styles.submitPillDisabled,
                    ]}
                    onPress={handleLogin}
                    disabled={isSubmitting}
                    activeOpacity={0.88}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitPillText}>Login</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* RIGHT BOTTOM POWERED BY LOGO */}
                <View style={styles.footerRow}>
                  <Text style={styles.footerMuted}>Powered by </Text>
                  <Image
                    source={BRAND_LOGO}
                    style={styles.footerLogoImg}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </View>
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
    backgroundColor: '#FFFFFF',
  },

  /* TOP ARCH HERO SECTION */
  heroArchContainer: {
    width: SCREEN_WIDTH,
    height: Math.min(SCREEN_HEIGHT * 0.32, 260),
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },

  heroArchMask: {
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    backgroundColor: '#F1F5F9',
  },

  heroArchImage: {
    width: '100%',
    height: '100%',
  },

  /* CONTENT CONTAINER */
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ELEVATED LOGIN CARD */
  cardContainer: {
    width: '100%',
    maxWidth: 410,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },

  /* WELCOME HEADER */
  welcomeHeader: {
    marginBottom: 24,
    alignItems: 'flex-start',
  },

  welcomeTitle: {
    fontSize: 26,
    fontFamily: 'Comfortaa_700Bold',
    color: '#1E293B',
    letterSpacing: -0.3,
    marginBottom: 6,
  },

  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: 'Comfortaa_500Medium',
    color: '#64748B',
  },

  /* FORM */
  formContainer: {
    width: '100%',
  },

  /* MODERN INPUT FIELD */
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 6,
    marginBottom: 18,
  },

  fieldRowFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E56108',
  },

  fieldIcon: {
    marginRight: 10,
  },

  textInput: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: 'Comfortaa_500Medium',
    color: '#1E293B',
    paddingVertical: 4,
  },

  pwdToggleBtn: {
    padding: 6,
    marginLeft: 4,
  },

  /* ACTION ROW: FORGOT PASSWORD & PILL */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 22,
  },

  forgotBtnText: {
    fontSize: 12.5,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#E56108',
  },

  /* SUBMIT PILL BUTTON */
  submitPill: {
    backgroundColor: '#E56108',
    paddingVertical: 11,
    paddingHorizontal: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E56108',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    minWidth: 100,
  },

  submitPillDisabled: {
    opacity: 0.7,
  },

  submitPillText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontFamily: 'Comfortaa_700Bold',
    letterSpacing: 0.2,
  },

  /* FOOTER BRANDING WITH IMAGE */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  footerMuted: {
    fontSize: 12,
    fontFamily: 'Comfortaa_500Medium',
    color: '#94A3B8',
    marginRight: 4,
  },

  footerLogoImg: {
    width: 90,
    height: 24,
  },
});
