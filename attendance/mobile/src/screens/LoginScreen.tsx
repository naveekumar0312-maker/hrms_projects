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
  ImageBackground,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, Check, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { useAppMessage } from '../context/MessageContext';

const TOP_HERO_IMAGE = require('../../assets/branding/login-screen-top-hero.png');
const BOT_FOOTER_IMAGE = require('../../assets/branding/login-screen-bot-footer.png');
const GOLD_BTN_BG = require('../../assets/branding/login-gold-btn-bg.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const REMEMBER_ME_KEY = 'yaazh360_remember_username';
const REMEMBER_ME_FLAG = 'yaazh360_remember_flag';

// Target hero aspect ratio: 472 x 420
const HERO_ASPECT_RATIO = 472 / 420;
// Hero height based on screen width
const HERO_HEIGHT = Math.min(SCREEN_WIDTH / HERO_ASPECT_RATIO, SCREEN_HEIGHT * 0.42);

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
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
        const flag = await SecureStore.getItemAsync(REMEMBER_ME_FLAG);
        if (flag === 'false') {
          setRememberMe(false);
        } else {
          setRememberMe(true);
          const savedUsername = await SecureStore.getItemAsync(REMEMBER_ME_KEY);
          if (savedUsername) {
            setIdentifier(savedUsername);
          }
        }
      } catch (err) {
        console.log('Error reading saved credentials:', err);
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
      scrollViewRef.current?.scrollTo({ y: 130, animated: true });
    }, 150);
  };

  const handlePasswordFocus = () => {
    setIsFocusedPassword(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 190, animated: true });
    }, 150);
  };

  const toggleRememberMe = async () => {
    const nextVal = !rememberMe;
    setRememberMe(nextVal);
    try {
      await SecureStore.setItemAsync(REMEMBER_ME_FLAG, nextVal ? 'true' : 'false');
      if (!nextVal) {
        await SecureStore.deleteItemAsync(REMEMBER_ME_KEY);
      }
    } catch (e) {
      console.log('Failed saving rememberMe flag:', e);
    }
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

      if (rememberMe) {
        await SecureStore.setItemAsync(REMEMBER_ME_KEY, identifier.trim());
        await SecureStore.setItemAsync(REMEMBER_ME_FLAG, 'true');
      } else {
        await SecureStore.deleteItemAsync(REMEMBER_ME_KEY);
        await SecureStore.setItemAsync(REMEMBER_ME_FLAG, 'false');
      }

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
      {/* Translucent status bar: allows the top metallic wave to flow behind the system clock & icons naturally */}
      <StatusBar style="light" />

      {/* Decorative Bottom Wave Fixed Background */}
      <View style={[styles.bottomFooterContainer, { height: SCREEN_WIDTH * (180 / 472) }]} pointerEvents="none">
        <Image
          source={BOT_FOOTER_IMAGE}
          style={styles.bottomFooterImage}
          resizeMode="cover"
        />
      </View>

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
                : Math.max(insets.bottom + 20, 36),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* TOP HERO (Curved Metallic Wave, 3D Yaazh 360 Logo, HRMS Title & Divider) */}
          <View style={[styles.topHeroContainer, { height: HERO_HEIGHT }]}>
            <Image
              source={TOP_HERO_IMAGE}
              style={styles.topHeroImage}
              resizeMode="cover"
            />
          </View>

          {/* MAIN FORM SECTION */}
          <View style={styles.formCard}>
            {/* WELCOME BACK HEADINGS */}
            <View style={styles.headerBlock}>
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>Sign in to your account</Text>
            </View>

            {/* USERNAME INPUT PILL */}
            <View
              style={[
                styles.inputPill,
                isFocusedIdentifier && styles.inputPillFocused,
              ]}
            >
              <View style={styles.inputLeadingIcon}>
                <User
                  size={20}
                  color={isFocusedIdentifier ? '#003882' : '#0F172A'}
                  strokeWidth={2.2}
                />
              </View>
              <TextInput
                style={styles.textInput}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="Username / Employee ID"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                onFocus={handleIdentifierFocus}
                onBlur={() => setIsFocusedIdentifier(false)}
              />
            </View>

            {/* PASSWORD INPUT PILL */}
            <View
              style={[
                styles.inputPill,
                isFocusedPassword && styles.inputPillFocused,
              ]}
            >
              <View style={styles.inputLeadingIcon}>
                <Lock
                  size={20}
                  color={isFocusedPassword ? '#003882' : '#0F172A'}
                  strokeWidth={2.2}
                />
              </View>
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#94A3B8"
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
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#0F172A" strokeWidth={2} />
                ) : (
                  <Eye size={20} color="#0F172A" strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>

            {/* OPTIONS ROW: REMEMBER ME & FORGOT PASSWORD */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMeBtn}
                onPress={toggleRememberMe}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkboxCircle,
                    rememberMe && styles.checkboxCircleChecked,
                  ]}
                >
                  {rememberMe && <Check size={12} color="#FFFFFF" strokeWidth={3.2} />}
                </View>
                <Text style={styles.rememberMeText}>Remember Me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleForgotPassword}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* ROYAL BLUE LOGIN BUTTON WITH GOLD METALLIC BORDER */}
            <TouchableOpacity
              style={styles.loginBtnWrapper}
              onPress={handleLogin}
              disabled={isSubmitting}
              activeOpacity={0.9}
            >
              <ImageBackground
                source={GOLD_BTN_BG}
                style={styles.loginBtnBackground}
                imageStyle={styles.loginBtnImageStyle}
                resizeMode="stretch"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.loginBtnContent}>
                    <ArrowRight size={21} color="#FFFFFF" strokeWidth={2.4} />
                    <View style={styles.loginBtnDivider} />
                    <Text style={styles.loginBtnText}>Login</Text>
                  </View>
                )}
              </ImageBackground>
            </TouchableOpacity>

            {/* SECURE & CONFIDENTIAL BADGE */}
            <View style={styles.securityBadgeContainer}>
              <View style={styles.securityLine} />
              <View style={styles.securityCenter}>
                <ShieldCheck size={18} color="#003882" strokeWidth={2.2} />
                <Text style={styles.securityText}>Secure & Confidential</Text>
              </View>
              <View style={styles.securityLine} />
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
    backgroundColor: '#FAFCFF',
  },

  /* FIXED BOTTOM FOOTER WAVE */
  bottomFooterContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: SCREEN_WIDTH,
    zIndex: 0,
  },

  bottomFooterImage: {
    width: '100%',
    height: '100%',
  },

  keyboardView: {
    flex: 1,
    zIndex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    backgroundColor: 'transparent',
  },

  /* TOP HERO CURVED SECTION */
  topHeroContainer: {
    width: SCREEN_WIDTH,
    backgroundColor: '#013A84',
    overflow: 'hidden',
  },

  topHeroImage: {
    width: '100%',
    height: '100%',
  },

  /* FORM SECTION CONTAINER */
  formCard: {
    width: '100%',
    paddingHorizontal: 26,
    paddingTop: 18,
    alignItems: 'center',
  },

  headerBlock: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 26,
  },

  welcomeTitle: {
    fontSize: 27,
    fontFamily: 'Comfortaa_700Bold',
    color: '#002B66',
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },

  welcomeSubtitle: {
    fontSize: 14.5,
    fontFamily: 'Comfortaa_500Medium',
    color: '#475569',
    textAlign: 'center',
  },

  /* INPUT PILLS (Rounded, soft border, clean shadow) */
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#003882',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  inputPillFocused: {
    borderColor: '#003882',
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.12,
  },

  inputLeadingIcon: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textInput: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: 'Comfortaa_500Medium',
    color: '#0F172A',
    paddingVertical: 0,
    height: '100%',
  },

  pwdToggleBtn: {
    padding: 6,
    marginLeft: 6,
  },

  /* OPTIONS ROW */
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 420,
    marginTop: 4,
    marginBottom: 24,
    paddingHorizontal: 4,
  },

  rememberMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkboxCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },

  checkboxCircleChecked: {
    backgroundColor: '#003882',
    borderColor: '#003882',
  },

  rememberMeText: {
    fontSize: 13.5,
    fontFamily: 'Comfortaa_500Medium',
    color: '#1E293B',
  },

  forgotPasswordText: {
    fontSize: 13.5,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#003882',
    textDecorationLine: 'underline',
  },

  /* LOGIN PILL BUTTON */
  loginBtnWrapper: {
    width: '100%',
    maxWidth: 420,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 28,
  },

  loginBtnBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loginBtnImageStyle: {
    borderRadius: 28,
  },

  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loginBtnDivider: {
    width: 1.5,
    height: 18,
    backgroundColor: '#93C5FD',
    marginHorizontal: 12,
    opacity: 0.8,
  },

  loginBtnText: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  /* SECURITY BADGE */
  securityBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    marginTop: 6,
  },

  securityLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
    opacity: 0.7,
  },

  securityCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  securityText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#334155',
    marginLeft: 6,
  },
});
