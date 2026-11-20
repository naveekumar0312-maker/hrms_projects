import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users,
  Award,
  UserCheck,
  Clock,
  UserX,
  Calendar,
  Building,
  Building2,
  ChevronRight,
  ListTodo,
  CalendarCheck,
  LogOut,
  LogIn,
  MapPin,
  CalendarDays,
  FileText,
  SwitchCamera,
  RefreshCw,
  AlertCircle,
} from 'lucide-react-native';
import { Camera, CameraType, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { AuthContext } from '../../context/AuthContext';
import { useAppMessage } from '../../context/MessageContext';
import { getManagerDashboardSummary, ManagerSummary } from '../../services/managerService';
import { fetchPendingActionsReminder } from '../../services/adminHRService';
import { getTodayAttendance, checkIn, checkOut } from '../../services/attendanceService';
import {
  MobileRolePendingActionsModal,
  MobilePendingActionItem,
  MobilePendingActionsSummary,
} from '../../components/MobileRolePendingActionsModal';
import * as SecureStore from 'expo-secure-store';
import { COLORS } from '../../constants/theme';

export default function ManagerDashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, employee, logout } = useContext(AuthContext);

  const [summary, setSummary] = useState<ManagerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderData, setReminderData] = useState<{
    totalCount: number;
    summary: MobilePendingActionsSummary;
    items: MobilePendingActionItem[];
  }>({
    totalCount: 0,
    summary: {},
    items: [],
  });

  const { showSuccess, showError } = useAppMessage();

  // Interactive Camera & Location Check-In / Check-Out states
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<'CHECK_IN' | 'CHECK_OUT' | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [capturedLocationName, setCapturedLocationName] = useState<string>('Fetching location...');
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationResolutionError, setLocationResolutionError] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  // Late Reason Modal State
  const [showLateReasonModal, setShowLateReasonModal] = useState(false);
  const [lateReasonText, setLateReasonText] = useState('');
  const [pendingLateMinutes, setPendingLateMinutes] = useState(0);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === 'granted');
    })();
  }, []);

  const verifyLocation = async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) return false;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return false;

      // 1. Try fast last known position first
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 600000 });
        if (lastKnown?.coords) {
          setCurrentLocation(lastKnown);
        }
      } catch (e) {}

      // 2. Fetch fresh position with 5s timeout fallback
      const fetchPosition = async () => {
        try {
          return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        } catch {
          return await Location.getLastKnownPositionAsync();
        }
      };

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 5000)
      );

      const location: any = await Promise.race([fetchPosition(), timeoutPromise]).catch(() => null);

      if (location?.coords) {
        setCurrentLocation(location);
        return location;
      }

      if (currentLocation?.coords) {
        return currentLocation;
      }

      // Fallback for field/manager if coords exist on branch
      if (employee?.branch?.latitude && employee?.branch?.longitude) {
        const fallback = {
          coords: {
            latitude: Number(employee.branch.latitude),
            longitude: Number(employee.branch.longitude),
            accuracy: 50,
          },
          timestamp: Date.now(),
        };
        setCurrentLocation(fallback as any);
        return fallback;
      }

      return false;
    } catch (error) {
      if (currentLocation?.coords) return currentLocation;
      return false;
    }
  };

  const resolveLocationForCapture = async (locCoords?: { latitude: number; longitude: number }) => {
    setIsResolvingLocation(true);
    setLocationResolutionError(false);
    setCapturedLocationName('Fetching location...');

    try {
      let coords = locCoords;
      if (!coords && currentLocation?.coords) {
        coords = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };
      }

      if (!coords) {
        const branchName = employee?.branch?.branch_name || employee?.branch?.name;
        setCapturedLocationName(branchName || 'Location verified');
        return;
      }

      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });

        if (results && results.length > 0) {
          const addr = results[0];
          const parts: string[] = [];
          const area = addr.name || addr.district || addr.street || addr.subregion;
          if (area) parts.push(area);
          if (addr.district && !parts.includes(addr.district)) parts.push(addr.district);
          if (addr.city && !parts.includes(addr.city)) parts.push(addr.city);
          if (parts.length > 0) {
            setCapturedLocationName(parts.join(', '));
            return;
          }
        }
      } catch (err: any) {
        console.warn('[CAMERA] Reverse geocode failed:', err?.message);
      }

      const branchName = employee?.branch?.branch_name || employee?.branch?.name;
      setCapturedLocationName(branchName || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
    } catch (err: any) {
      const branchName = employee?.branch?.branch_name || employee?.branch?.name;
      setCapturedLocationName(branchName || 'Location verified');
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const startAttendance = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    if (!hasCameraPermission) {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showError('Permission Denied', 'Camera permission is required for attendance.');
        return;
      }
      setHasCameraPermission(true);
    }
    const location = await verifyLocation();
    if (!location) {
      showError('Location Error', 'Unable to verify your location. Ensure GPS is on and try again.');
      return;
    }
    setCurrentAction(type);
    setCameraVisible(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current || loadingAction) return;
    try {
      setLoadingAction(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
      });

      if (!photo?.uri) {
        throw new Error('Photo capture failed');
      }

      setCapturedPhotoUri(photo.uri);
      setCameraVisible(false);
      setLoadingAction(false);

      if (currentLocation?.coords) {
        resolveLocationForCapture({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      } else {
        const branchName = employee?.branch?.branch_name || employee?.branch?.name;
        setCapturedLocationName(branchName || 'Location verified');
      }
    } catch (e: any) {
      setLoadingAction(false);
      showError('Capture Error', e?.message || 'Failed to take photo.');
    }
  };

  const retakePicture = () => {
    setCapturedPhotoUri(null);
    setCapturedLocationName('Fetching location...');
    setIsResolvingLocation(false);
    setLocationResolutionError(false);
    setCameraVisible(true);
  };

  const submitAttendance = async (photoUri: string, reason?: string) => {
    if (loadingAction) return;
    try {
      setLoadingAction(true);
      const locationData = {
        latitude: currentLocation?.coords?.latitude,
        longitude: currentLocation?.coords?.longitude,
        accuracy: currentLocation?.coords?.accuracy || 0,
      };

      if (!locationData.latitude || !locationData.longitude) {
        throw new Error('Valid GPS location is required to submit attendance.');
      }

      if (currentAction === 'CHECK_IN') {
        await checkIn(locationData, photoUri, reason);
        showSuccess('Check-In Successful!', 'Your check-in has been recorded successfully.');
      } else {
        await checkOut(locationData, photoUri);
        showSuccess('Check-Out Successful!', 'Your check-out has been recorded successfully.');
      }
      setShowLateReasonModal(false);
      setLateReasonText('');
      setPendingPhotoUri(null);
      setCurrentAction(null);
      await loadData();
    } catch (error: any) {
      if (error?.response?.data?.code === 'LATE_REASON_REQUIRED') {
        const mins = error.response.data.late_minutes || 0;
        setPendingLateMinutes(mins);
        setPendingPhotoUri(photoUri);
        setShowLateReasonModal(true);
      } else {
        showError('Attendance Failed', error.message || 'Validation failed.');
        setCurrentAction(null);
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const confirmCapturedPhoto = async () => {
    if (!capturedPhotoUri || loadingAction) return;
    await submitAttendance(capturedPhotoUri);
    setCapturedPhotoUri(null);
  };

  const handleConfirmLateReason = async () => {
    if (!lateReasonText.trim()) {
      showError('Reason Required', 'Please enter a valid reason for late check-in.');
      return;
    }
    if (!pendingPhotoUri) {
      showError('Error', 'Photo session expired, please take a photo again.');
      setShowLateReasonModal(false);
      return;
    }
    await submitAttendance(pendingPhotoUri, lateReasonText.trim());
  };

  // Hourly / mount reminder for Manager
  useEffect(() => {
    let active = true;

    const checkReminder = async (force: boolean = false) => {
      try {
        const storeKey = `pending_reminder_ts_MGR_${user?.id || '0'}`;
        const lastShown = await SecureStore.getItemAsync(storeKey);
        const oneHourMs = 60 * 60 * 1000;
        const now = Date.now();

        if (!force && lastShown && now - parseInt(lastShown, 10) < oneHourMs) {
          return;
        }

        const data = await fetchPendingActionsReminder();
        if (!active) return;

        if (data && data.has_pending && data.total_pending_count > 0) {
          setReminderData({
            totalCount: data.total_pending_count,
            summary: data.summary || {},
            items: data.items || [],
          });
          setReminderModalVisible(true);
          await SecureStore.setItemAsync(storeKey, now.toString());
        }
      } catch (err) {
        console.error('Error fetching manager pending actions reminder:', err);
      }
    };

    checkReminder(false);

    const interval = setInterval(() => {
      checkReminder(true);
    }, 60 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  const [todayAttendance, setTodayAttendance] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [data, todayData] = await Promise.all([
        getManagerDashboardSummary(),
        getTodayAttendance().catch(() => null),
      ]);
      setSummary(data);
      setTodayAttendance(todayData);
    } catch (err) {
      console.error('Failed to load manager dashboard summary:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const isTeamLeader = user?.role === 'TEAM_LEADER';
  const roleTitle = isTeamLeader ? 'Team Leader' : 'Reporting Manager';

  if (capturedPhotoUri) {
    return (
      <View style={[styles.photoPreviewContainer, { paddingTop: Math.max(insets.top + 10, 24) }]}>
        <StatusBar style="dark" hidden={false} />
        <View style={styles.photoPreviewHeader}>
          <TouchableOpacity
            onPress={retakePicture}
            style={styles.previewBackButton}
          >
            <Text style={styles.previewBackText}>Retake</Text>
          </TouchableOpacity>

          <Text style={styles.photoPreviewTitle}>
            {currentAction === 'CHECK_IN' ? 'Check In Photo' : 'Check Out Photo'}
          </Text>

          <View style={{ width: 60 }} />
        </View>

        {/* Photo Container */}
        <View style={styles.photoPreviewImageContainer}>
          <Image
            source={{ uri: capturedPhotoUri }}
            style={styles.photoPreviewImage}
            resizeMode="contain"
          />
        </View>

        {/* Location Display Underneath Photo */}
        <View style={styles.photoLocationCard}>
          <View style={styles.photoLocationHeader}>
            <View style={styles.photoLocationTitleRow}>
              <MapPin size={18} color={COLORS.primary} />
              <Text style={styles.photoLocationHeaderTitle}>Location</Text>
            </View>
            {isResolvingLocation && (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />
            )}
            {locationResolutionError && !isResolvingLocation && (
              <TouchableOpacity
                style={styles.retryLocationButton}
                onPress={() => resolveLocationForCapture(currentLocation?.coords)}
              >
                <RefreshCw size={14} color={COLORS.primary} />
                <Text style={styles.retryLocationText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[
            styles.photoLocationName,
            isResolvingLocation && styles.photoLocationLoading,
            locationResolutionError && styles.photoLocationError,
          ]}>
            {capturedLocationName}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.confirmPhotoButton,
            (loadingAction || isResolvingLocation) && styles.confirmPhotoButtonDisabled,
          ]}
          onPress={confirmCapturedPhoto}
          disabled={loadingAction}
        >
          {loadingAction ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.confirmPhotoText}>
              {currentAction === 'CHECK_IN'
                ? 'Confirm Check In'
                : 'Confirm Check Out'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (cameraVisible) {
    return (
      <View style={styles.cameraContainer}>
        <StatusBar style="dark" hidden={false} />
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={cameraFacing}
          mirror={cameraFacing === 'front'}
          ref={cameraRef}
        />

        <View style={styles.cameraOverlay} pointerEvents="box-none">
          <View style={[styles.cameraHeader, { marginTop: Math.max(insets.top + 10, 28) }]}>
            <TouchableOpacity onPress={() => setCameraVisible(false)} style={styles.backButton}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>{currentAction === 'CHECK_IN' ? 'Check In' : 'Check Out'}</Text>
            <TouchableOpacity
              onPress={() => setCameraFacing((prev) => (prev === 'front' ? 'back' : 'front'))}
              style={styles.flipCameraButton}
            >
              <SwitchCamera size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.cameraSubtitle}>Capture your photo and location to proceed</Text>

          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" hidden={false} />

      {/* HEADER SECTION */}
      <View style={[styles.headerArea, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.companyName}>
              {summary?.company_name && summary.company_name !== 'N/A'
                ? summary.company_name
                : (employee?.company_name && employee.company_name !== 'N/A' ? employee.company_name : 'All Companies')}
            </Text>
            <Text style={styles.roleBadge}>{roleTitle}</Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <LogOut size={18} color={COLORS.primary} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.greetingTitle}>
            Hi, {summary?.manager_name || employee?.full_name || user?.username}
          </Text>
          <Text style={styles.greetingSub}>
            {summary?.designation || employee?.designation || 'Team Overview & Management'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {loading && !summary ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading Manager Overview...</Text>
          </View>
        ) : (
          <>
            {/* MANAGER PERSONAL ATTENDANCE CARD */}
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              padding: 16,
              marginHorizontal: 16,
              marginTop: 14,
              marginBottom: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: '#ECFDF5',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Clock size={20} color="#059669" strokeWidth={2.2} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontFamily: 'Comfortaa_700Bold', color: '#0F172A' }}>
                      My Attendance
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_500Medium', color: '#64748B', marginTop: 1 }}>
                      Check-In & Self Requests
                    </Text>
                  </View>
                </View>

                {todayAttendance?.check_in_time ? (
                  <View style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0' }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_700Bold', color: '#16A34A' }}>Checked In</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_500Medium', color: '#64748B' }}>Not Marked</Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Comfortaa_600SemiBold', color: '#64748B', textTransform: 'uppercase' }}>Check In</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Comfortaa_700Bold', color: todayAttendance?.check_in_time ? '#16A34A' : '#94A3B8', marginTop: 3 }}>
                    {todayAttendance?.check_in_time ? new Date(todayAttendance.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </Text>
                </View>

                <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Comfortaa_600SemiBold', color: '#64748B', textTransform: 'uppercase' }}>Check Out</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Comfortaa_700Bold', color: todayAttendance?.check_out_time ? '#2563EB' : '#94A3B8', marginTop: 3 }}>
                    {todayAttendance?.check_out_time ? new Date(todayAttendance.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </Text>
                </View>

                <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Comfortaa_600SemiBold', color: '#64748B', textTransform: 'uppercase' }}>Hours</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Comfortaa_700Bold', color: '#0F172A', marginTop: 3 }}>
                    {todayAttendance?.working_hours || '00:00'}
                  </Text>
                </View>
              </View>

              {/* Punch In / Out Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {!todayAttendance?.check_in_time && (
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#22C55E',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 12,
                      borderRadius: 12,
                    }}
                    onPress={() => startAttendance('CHECK_IN')}
                    disabled={loadingAction}
                  >
                    <LogIn size={18} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={{ color: '#FFFFFF', fontFamily: 'Comfortaa_700Bold', fontSize: 14 }}>Check In</Text>
                  </TouchableOpacity>
                )}

                {todayAttendance?.check_in_time && !todayAttendance?.check_out_time && (
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#EF4444',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 12,
                      borderRadius: 12,
                    }}
                    onPress={() => startAttendance('CHECK_OUT')}
                    disabled={loadingAction}
                  >
                    <LogOut size={18} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={{ color: '#FFFFFF', fontFamily: 'Comfortaa_700Bold', fontSize: 14 }}>Check Out</Text>
                  </TouchableOpacity>
                )}

                {todayAttendance?.check_in_time && todayAttendance?.check_out_time && (
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: '#F1F5F9',
                      paddingVertical: 10,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#475569', fontFamily: 'Comfortaa_700Bold', fontSize: 13 }}>
                      Attendance Completed for Today
                    </Text>
                  </View>
                )}
              </View>

              {/* Self-Service Action Pills */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#EFF6FF',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#BFDBFE',
                  }}
                  onPress={() => navigation.navigate('AttendanceHistory')}
                >
                  <CalendarDays size={14} color="#2563EB" strokeWidth={2.2} />
                  <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_700Bold', color: '#1E40AF' }}>History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#FFF7ED',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#FED7AA',
                  }}
                  onPress={() => navigation.navigate('Leave')}
                >
                  <Calendar size={14} color="#EA580C" strokeWidth={2.2} />
                  <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_700Bold', color: '#C2410C' }}>Leave</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#FAF5FF',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#E9D5FF',
                  }}
                  onPress={() => navigation.navigate('Permission')}
                >
                  <Clock size={14} color="#7C3AED" strokeWidth={2.2} />
                  <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_700Bold', color: '#6D28D9' }}>Permission</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#F0FDFA',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#99F6E4',
                  }}
                  onPress={() => navigation.navigate('WFH')}
                >
                  <Building2 size={14} color="#0D9488" strokeWidth={2.2} />
                  <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_700Bold', color: '#0F766E' }}>WFH</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* QUICK ACTIONS BANNER */}
            <View style={styles.quickNavRow}>
              <TouchableOpacity
                style={[styles.quickNavCard, { backgroundColor: '#F5F5F5', borderColor: '#E5E5E5' }]}
                onPress={() => navigation.navigate('ManagerTeamTab')}
              >
                <Users size={22} color="#22C55E" strokeWidth={2.2} />
                <Text style={[styles.quickNavText, { color: '#22C55E' }]}>My Team</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickNavCard, { backgroundColor: '#F5F5F5', borderColor: '#E5E5E5' }]}
                onPress={() => navigation.navigate('ManagerTasksTab')}
              >
                <ListTodo size={22} color="#000000" strokeWidth={2.2} />
                <Text style={[styles.quickNavText, { color: '#000000' }]}>Tasks</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickNavCard, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}
                onPress={() => navigation.navigate('ManagerAttendance')}
              >
                <CalendarCheck size={22} color="#7E22CE" strokeWidth={2.2} />
                <Text style={[styles.quickNavText, { color: '#7E22CE' }]}>Attendance</Text>
              </TouchableOpacity>
            </View>

            {/* TEAM METRICS SECTION */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Team Overview</Text>
            </View>

            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: '#F5F5F5' }]}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(0, 86, 179, 0.12)' }]}>
                  <Users size={20} color="#22C55E" strokeWidth={2.2} />
                </View>
                <Text style={styles.metricVal}>{summary?.total_employees ?? 0}</Text>
                <Text style={styles.metricLabel}>Total Members</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: '#F5F5F5' }]}>
                <View style={[styles.iconBox, { backgroundColor: '#F5F5F5' }]}>
                  <Award size={20} color="#000000" strokeWidth={2.2} />
                </View>
                <Text style={styles.metricVal}>{summary?.total_team_leaders ?? 0}</Text>
                <Text style={styles.metricLabel}>Team Leaders</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: '#F5F5F5' }]}>
                <View style={[styles.iconBox, { backgroundColor: '#E5E5E5' }]}>
                  <Users size={20} color="#000000" strokeWidth={2.2} />
                </View>
                <Text style={styles.metricVal}>{summary?.direct_employees ?? 0}</Text>
                <Text style={styles.metricLabel}>Direct Reports</Text>
              </View>
            </View>

            {/* TODAY'S ATTENDANCE SECTION */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Today's Attendance Status</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_500Medium', color: '#666666', marginTop: 2 }}>
                  Tap card to view filtered attendance list
                </Text>
              </View>
              <Text style={styles.dateLabel}>{summary?.date || new Date().toISOString().split('T')[0]}</Text>
            </View>

            <View style={styles.attendanceGrid}>
              <TouchableOpacity
                style={[styles.attendBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ManagerAttendance', {
                  status: 'PRESENT',
                  date: summary?.date || new Date().toISOString().split('T')[0],
                })}
              >
                <UserCheck size={22} color="#16A34A" strokeWidth={2.2} />
                <Text style={[styles.attendVal, { color: '#16A34A' }]}>{summary?.present_today ?? 0}</Text>
                <Text style={styles.attendLabel}>Present Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.attendBox, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ManagerAttendance', {
                  status: 'LATE',
                  date: summary?.date || new Date().toISOString().split('T')[0],
                })}
              >
                <Clock size={22} color="#D97706" strokeWidth={2.2} />
                <Text style={[styles.attendVal, { color: '#D97706' }]}>{summary?.late_today ?? 0}</Text>
                <Text style={styles.attendLabel}>Late Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.attendBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ManagerAttendance', {
                  status: 'ABSENT',
                  date: summary?.date || new Date().toISOString().split('T')[0],
                })}
              >
                <UserX size={22} color="#DC2626" strokeWidth={2.2} />
                <Text style={[styles.attendVal, { color: '#DC2626' }]}>{summary?.absent_today ?? 0}</Text>
                <Text style={styles.attendLabel}>Absent Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.attendBox, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ManagerAttendance', {
                  status: 'ON_LEAVE',
                  date: summary?.date || new Date().toISOString().split('T')[0],
                })}
              >
                <Calendar size={22} color="#7E22CE" strokeWidth={2.2} />
                <Text style={[styles.attendVal, { color: '#7E22CE' }]}>{summary?.on_leave_today ?? 0}</Text>
                <Text style={styles.attendLabel}>On Leave Today</Text>
              </TouchableOpacity>
            </View>

            {/* RECENT NAVIGATION LINKS */}
            <View style={styles.actionList}>
              <TouchableOpacity
                style={styles.actionListItem}
                onPress={() => navigation.navigate('ManagerTeamTab')}
              >
                <View style={styles.actionListLeft}>
                  <Users size={18} color={COLORS.primary} strokeWidth={2.2} />
                  <Text style={styles.actionListText}>View Team Roster & Manage Leads</Text>
                </View>
                <ChevronRight size={18} color="#888888" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionListItem}
                onPress={() => navigation.navigate('ManagerAttendance')}
              >
                <View style={styles.actionListLeft}>
                  <CalendarCheck size={18} color={COLORS.primary} strokeWidth={2.2} />
                  <Text style={styles.actionListText}>Check Real-Time Team Attendance</Text>
                </View>
                <ChevronRight size={18} color="#888888" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionListItem}
                onPress={() => navigation.navigate('ManagerTasksTab')}
              >
                <View style={styles.actionListLeft}>
                  <ListTodo size={18} color={COLORS.primary} strokeWidth={2.2} />
                  <Text style={styles.actionListText}>Assign & Track Team Tasks</Text>
                </View>
                <ChevronRight size={18} color="#888888" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionListItem}
                onPress={() => navigation.navigate('AdminLeaves')}
              >
                <View style={styles.actionListLeft}>
                  <Calendar size={18} color="#EA580C" strokeWidth={2.2} />
                  <Text style={styles.actionListText}>Review Leave Applications</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {(reminderData.summary.pending_leaves || 0) > 0 && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>{reminderData.summary.pending_leaves} New</Text>
                    </View>
                  )}
                  <ChevronRight size={18} color="#888888" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionListItem}
                onPress={() => navigation.navigate('AdminPermissions')}
              >
                <View style={styles.actionListLeft}>
                  <Clock size={18} color="#2563EB" strokeWidth={2.2} />
                  <Text style={styles.actionListText}>Review Permission Requests</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {(reminderData.summary.pending_permissions || 0) > 0 && (
                    <View style={[styles.pendingBadge, { backgroundColor: '#EFF6FF' }]}>
                      <Text style={[styles.pendingBadgeText, { color: '#1D4ED8' }]}>{reminderData.summary.pending_permissions} New</Text>
                    </View>
                  )}
                  <ChevronRight size={18} color="#888888" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionListItem}
                onPress={() => navigation.navigate('AdminWFH')}
              >
                <View style={styles.actionListLeft}>
                  <Building2 size={18} color="#7C3AED" strokeWidth={2.2} />
                  <Text style={styles.actionListText}>Review WFH Requests</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {(reminderData.summary.pending_wfh || 0) > 0 && (
                    <View style={[styles.pendingBadge, { backgroundColor: '#FAF5FF' }]}>
                      <Text style={[styles.pendingBadgeText, { color: '#6D28D9' }]}>{reminderData.summary.pending_wfh} New</Text>
                    </View>
                  )}
                  <ChevronRight size={18} color="#888888" />
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <MobileRolePendingActionsModal
        visible={reminderModalVisible}
        role="REPORTING_MANAGER"
        totalCount={reminderData.totalCount}
        summary={reminderData.summary}
        items={reminderData.items}
        onClose={() => setReminderModalVisible(false)}
        onNavigateAction={(item) => {
          setReminderModalVisible(false);
          switch (item.type) {
            case 'LEAVE':
              navigation.navigate('AdminLeaves');
              break;
            case 'PERMISSION':
              navigation.navigate('AdminPermissions');
              break;
            case 'WFH':
              navigation.navigate('AdminWFH');
              break;
            case 'ATTENDANCE_PUNCH':
              navigation.navigate('ManagerAttendance');
              break;
            case 'TASK':
              navigation.navigate('ManagerTasksTab');
              break;
            default:
              navigation.navigate('ManagerAttendance');
          }
        }}
      />

      {/* LATE REASON MODAL */}
      <Modal
        visible={showLateReasonModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!loadingAction) {
            setShowLateReasonModal(false);
            setLateReasonText('');
            setPendingPhotoUri(null);
            setCurrentAction(null);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.lateModalOverlay}
        >
          <View style={styles.lateModalCard}>
            <View style={styles.lateModalHeader}>
              <View style={styles.lateModalIconBg}>
                <AlertCircle size={26} color="#DC2626" strokeWidth={2.2} />
              </View>
              <View style={styles.lateModalHeaderTextWrapper}>
                <Text style={styles.lateModalTitle}>Late Arrival Notice</Text>
                <Text style={styles.lateModalSubtitle}>
                  {pendingLateMinutes > 0
                    ? `You are checking in ${pendingLateMinutes} min${pendingLateMinutes > 1 ? 's' : ''} late.`
                    : 'You have exceeded the standard grace window.'}
                </Text>
              </View>
            </View>

            <Text style={styles.lateModalInstruction}>
              Please explain why you arrived late today. This reason will be recorded on your attendance entry.
            </Text>

            <TextInput
              style={styles.lateReasonInput}
              placeholder="e.g. Heavy traffic, emergency at home..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={lateReasonText}
              onChangeText={setLateReasonText}
              editable={!loadingAction}
              textAlignVertical="top"
            />

            <View style={styles.lateModalActions}>
              <TouchableOpacity
                style={styles.lateModalCancelBtn}
                onPress={() => {
                  setShowLateReasonModal(false);
                  setLateReasonText('');
                  setPendingPhotoUri(null);
                  setCurrentAction(null);
                }}
                disabled={loadingAction}
              >
                <Text style={styles.lateModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.lateModalSubmitBtn,
                  (!lateReasonText.trim() || loadingAction) && styles.lateModalSubmitBtnDisabled,
                ]}
                onPress={handleConfirmLateReason}
                disabled={!lateReasonText.trim() || loadingAction}
              >
                {loadingAction ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.lateModalSubmitText}>Submit & Check In</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerArea: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyName: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
    letterSpacing: -0.3,
  },
  roleBadge: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.primary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingBlock: {
    marginTop: 14,
  },
  greetingTitle: {
    fontSize: 24,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 3,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666666',
    fontSize: 14,
    fontFamily: 'Comfortaa_600SemiBold',
  },
  quickNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  quickNavCard: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickNavText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  dateLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#666666',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricVal: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#666666',
    marginTop: 2,
    textAlign: 'center',
  },
  attendanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  attendBox: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  attendVal: {
    fontSize: 22,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    marginVertical: 4,
  },
  attendLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#222222',
  },
  actionList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
    marginBottom: 20,
  },
  actionListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  actionListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionListText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#000000',
  },
  pendingBadge: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  pendingBadgeText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#EA580C',
  },
  lateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lateModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  lateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  lateModalIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  lateModalHeaderTextWrapper: {
    flex: 1,
  },
  lateModalTitle: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#111827',
  },
  lateModalSubtitle: {
    fontSize: 13,
    color: '#DC2626',
    fontFamily: 'Comfortaa_600SemiBold',
    marginTop: 2,
  },
  lateModalInstruction: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 12,
  },
  lateReasonInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    marginBottom: 18,
  },
  lateModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  lateModalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lateModalCancelText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  lateModalSubmitBtn: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 130,
  },
  lateModalSubmitBtnDisabled: {
    backgroundColor: '#FDBA74',
  },
  lateModalSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
  },
  cameraContainer: { flex: 1, backgroundColor: 'black' },
  cameraOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', alignItems: 'center', padding: 24, zIndex: 10 },
  cameraHeader: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginTop: 40 },
  backButton: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  backText: { color: '#FFF', fontSize: 16, fontFamily: 'Comfortaa_600SemiBold' },
  flipCameraButton: { padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  cameraTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Comfortaa_700Bold' },
  cameraSubtitle: { color: '#FFF', fontSize: 14, marginTop: 12, textAlign: 'center' },
  photoPreviewContainer: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 50,
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  photoPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  previewBackButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
  },
  previewBackText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
  },
  photoPreviewTitle: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
  },
  photoPreviewImageContainer: {
    flex: 1,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  photoLocationCard: {
    marginTop: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  photoLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  photoLocationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoLocationHeaderTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  photoLocationName: {
    color: '#F9FAFB',
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    lineHeight: 18,
  },
  photoLocationLoading: {
    color: '#D1D5DB',
    fontStyle: 'italic',
  },
  photoLocationError: {
    color: '#F87171',
  },
  retryLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
  },
  retryLocationText: {
    color: COLORS.primary,
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
  },
  confirmPhotoButton: {
    marginTop: 14,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmPhotoButtonDisabled: {
    opacity: 0.6,
  },
  confirmPhotoText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
  },
  captureButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 255, 255, 0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  captureButtonInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF' },
});

