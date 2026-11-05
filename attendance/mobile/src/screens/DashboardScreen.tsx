import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Dimensions, Image, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Camera, CameraView, CameraType } from 'expo-camera';
import { AuthContext, api } from '../context/AuthContext';
import { MapPin, Target, Clock, Calendar, BarChart, User, LogIn, LogOut, ChevronRight, CheckCircle, XCircle, House, Bell, SwitchCamera, RefreshCw, CalendarDays, SlidersHorizontal, Search, FileText, Palmtree } from 'lucide-react-native';
import { AppSearchBar } from '../components/AppSearchBar';
import { CategoryBubblesRow } from '../components/CategoryBubblesRow';
import { checkIn, checkOut, getHistory, getTodayAttendance } from '../services/attendanceService';
import { formatAttendanceDate, formatAttendanceTime, formatWorkingHours } from '../utils/dateUtils';
import { COLORS } from '../constants/theme';
import { useAppMessage } from '../context/MessageContext';
import {
  getLocationSharingStatus,
  enableLocationSharing,
  disableLocationSharing,
} from '../services/locationTrackingService';
import PersonalAlarmCard from '../components/PersonalAlarmCard';
import * as SecureStore from 'expo-secure-store';
import { getEmployeeTasks, MobileTask } from '../services/taskService';
import MobileTaskDailyReminderModal from '../components/MobileTaskDailyReminderModal';



const { width } = Dimensions.get('window');



export default function DashboardScreen({ navigation }: any) {
  const { employee, user, logout } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const { showSuccess, showError, showConfirm } = useAppMessage();
  
  const [loadingData, setLoadingData] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigateToHistory = () => {
    try {
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
        navigation.navigate('AdminAttendance' as any);
      } else if (user?.role === 'HR') {
        navigation.navigate('HRAttendanceTab' as any);
      } else {
        navigation.navigate('AttendanceHistory' as any);
      }
    } catch (e) {
      navigation.navigate('AttendanceHistory' as any);
    }
  };

  const navigateToProfile = () => {
    try {
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
        navigation.navigate('SuperAdminProfileTab' as any);
      } else if (user?.role === 'HR') {
        navigation.navigate('HRProfileTab' as any);
      } else if (user?.role === 'REPORTING_MANAGER') {
        navigation.navigate('ManagerProfileTab' as any);
      } else if (user?.role === 'TEAM_LEADER') {
        navigation.navigate('TeamLeaderProfileTab' as any);
      } else {
        navigation.navigate('ProfileTab' as any);
      }
    } catch (e) {
      navigation.navigate('ProfileTab' as any);
    }
  };
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  const fetchNotificationCount = useCallback(async () => {
    try {
      const response = await api.get('/notifications/?limit=50');
      setNotificationUnreadCount(Number(response.data?.unread_count ?? 0));
    } catch (error: any) {
      console.warn(
        '[NOTIFICATIONS] Unread count fetch failed:',
        error?.response?.status ?? error?.message,
      );
    }
  }, []);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<'CHECK_IN' | 'CHECK_OUT' | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [capturedPhotoFacing, setCapturedPhotoFacing] = useState<CameraType>('front');
  const [capturedLocationName, setCapturedLocationName] = useState<string>('Fetching location...');
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationResolutionError, setLocationResolutionError] = useState(false);
  
  const [locationStatus, setLocationStatus] = useState('-- m');
  const [isLocationVerified, setIsLocationVerified] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [sharingStatusLoading, setSharingStatusLoading] = useState(false);

  // Daily Task Reminder Pop-up State
  const [assignedTasks, setAssignedTasks] = useState<MobileTask[]>([]);
  const [showTaskReminder, setShowTaskReminder] = useState(false);

  const formatLocationName = (address: Location.LocationGeocodedAddress): string => {
    const parts: string[] = [];

    // Most specific locality or area name
    const specificArea =
      address.name ||
      address.district ||
      address.street ||
      address.subregion ||
      null;

    if (specificArea && !parts.includes(specificArea)) {
      parts.push(specificArea);
    }

    if (address.district && !parts.includes(address.district)) {
      parts.push(address.district);
    }

    if (address.city && !parts.includes(address.city)) {
      parts.push(address.city);
    }

    if (address.subregion && !parts.includes(address.subregion)) {
      parts.push(address.subregion);
    }

    if (address.region && !parts.includes(address.region)) {
      parts.push(address.region);
    }

    if (address.country && !parts.includes(address.country)) {
      parts.push(address.country);
    }

    if (parts.length > 0) {
      return parts.join(', ');
    }

    if (address.formattedAddress?.trim()) {
      return address.formattedAddress.trim();
    }

    return 'Location unavailable';
  };

  const calculateGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
  };

  const [greeting, setGreeting] = useState<string>(calculateGreeting);

  const updateGreeting = useCallback(() => {
    setGreeting(calculateGreeting());
  }, []);

  const cameraRef = useRef<CameraView>(null);

  useFocusEffect(
    useCallback(() => {
      fetchNotificationCount();

      const interval = setInterval(fetchNotificationCount, 10000);
      return () => clearInterval(interval);
    }, [fetchNotificationCount]),
  );

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const verifyLocation = async () => {
    if (isGettingLocation) return false;
    
    setIsGettingLocation(true);
    setLocationStatus('Getting...');
    setIsLocationVerified(false);
    
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationStatus('-- m');
        return false;
      }

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('-- m');
        return false;
      }
      
      const locationPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 10000)
      );
      
      const location: any = await Promise.race([locationPromise, timeoutPromise]);
      
      if (!location || !location.coords) {
        throw new Error('Invalid location');
      }

      setCurrentLocation(location);
      setIsLocationVerified(true);
      setLocationStatus(`${Math.round(location.coords.accuracy)} m`);
      return location;
    } catch (error: any) {
      setLocationStatus('-- m');
      return false;
    } finally {
      setIsGettingLocation(false);
    }
  };

  useEffect(() => {
    if (employee) {
      verifyLocation();
    }
  }, [employee]);

  const loadSharingStatus = async () => {
    if (employee?.work_type?.toUpperCase() !== 'FIELD') return;

    setSharingStatusLoading(true);
    try {
      const status = await getLocationSharingStatus();
      setSharingEnabled(Boolean(status?.is_enabled));
    } catch (error: any) {
      console.warn('[LOCATION SHARING] Status load failed:', error?.response?.status ?? error?.message);
    } finally {
      setSharingStatusLoading(false);
    }
  };

  const handleLocationSharingToggle = async () => {
    if (sharingLoading) return;

    const nextEnabled = !sharingEnabled;
    const message = nextEnabled
      ? 'When enabled, your location may be shared with authorised company administrators while background tracking is active. You can turn this off at any time. Continue?'
      : 'Stop sharing your location with company administrators?';

    showConfirm({
      title: nextEnabled ? 'Enable Location Sharing' : 'Disable Location Sharing',
      message,
      confirmText: nextEnabled ? 'Enable' : 'Turn Off',
      cancelText: 'Cancel',
      isDestructive: !nextEnabled,
      onConfirm: async () => {
        setSharingLoading(true);
        try {
          if (nextEnabled) {
            await enableLocationSharing();
            setSharingEnabled(true);
            showSuccess('Location Sharing', 'Location sharing is enabled.');
          } else {
            await disableLocationSharing();
            setSharingEnabled(false);
            showSuccess('Location Sharing', 'Location sharing has been disabled.');
          }
        } catch (error: any) {
          await loadSharingStatus();
          showError(
            'Location Sharing',
            error?.response?.data?.detail ||
              error?.response?.data?.error ||
              error?.message ||
              'Unable to update location sharing.'
          );
        } finally {
          setSharingLoading(false);
        }
      },
    });
  };
  const fetchData = async () => {
    try {
      setLoadingData(true);
      const [todayData, historyData, tasksList] = await Promise.all([
        getTodayAttendance(),
        getHistory(1),
        getEmployeeTasks().catch(() => [] as MobileTask[]),
      ]);
      
      if (todayData && todayData.status !== 'NOT_CHECKED_IN') {
        setTodayAttendance(todayData);
      } else {
        setTodayAttendance(null);
      }
      
      const historyList = historyData.results || historyData || [];
      // Filter out today from recent history visually if it's already shown above,
      // or just show the top 3.
      setRecentHistory(historyList.filter((item: any) => item.date !== todayData.date).slice(0, 3));

      // Daily Task Reminder check
      if (Array.isArray(tasksList)) {
        const activeTasks = tasksList.filter(
          (t) => !['COMPLETED', 'CANCELLED', 'DRAFT'].includes(t.status)
        );
        setAssignedTasks(activeTasks);

        const todayKey = 'daily_task_reminder_' + new Date().toISOString().slice(0, 10);
        try {
          const seen = await SecureStore.getItemAsync(todayKey);
          if (activeTasks.length > 0 && !seen) {
            setShowTaskReminder(true);
          }
        } catch {
          if (activeTasks.length > 0) {
            setShowTaskReminder(true);
          }
        }
      }
      
    } catch (error: any) {
      if (error?.response?.status === 401) {
        logout();
      }
      console.log('Error fetching dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      updateGreeting();
      fetchData();
      verifyLocation();
      loadSharingStatus();
    }, [employee, updateGreeting])
  );

  useEffect(() => {
    // Refresh greeting when app returns to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        updateGreeting();
      }
    });

    // Check periodically (every 60 seconds) so the greeting updates seamlessly across time boundaries
    const interval = setInterval(() => {
      updateGreeting();
    }, 60000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [updateGreeting]);

  const resolveLocationForCapture = async (locCoords?: { latitude: number; longitude: number }) => {
    setIsResolvingLocation(true);
    setLocationResolutionError(false);
    setCapturedLocationName('Fetching location...');

    try {
      let coords = locCoords;
      if (!coords) {
        const freshLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (freshLocation?.coords) {
          coords = {
            latitude: freshLocation.coords.latitude,
            longitude: freshLocation.coords.longitude,
          };
          setCurrentLocation(freshLocation);
          setIsLocationVerified(true);
          setLocationStatus(`${Math.round(freshLocation.coords.accuracy || 0)} m`);
        }
      }

      if (!coords) {
        setCapturedLocationName('Location unavailable');
        setLocationResolutionError(true);
        return;
      }

      const results = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (results && results.length > 0) {
        const readable = formatLocationName(results[0]);
        setCapturedLocationName(readable);
      } else {
        setCapturedLocationName('Location unavailable');
        setLocationResolutionError(true);
      }
    } catch (err: any) {
      console.warn('[CAMERA] Reverse geocode failed:', err?.message);
      setCapturedLocationName('Location unavailable');
      setLocationResolutionError(true);
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const startAttendance = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    if (!hasPermission) {
      showError('Permission Denied', 'Camera permission is required.');
      return;
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

      // Trigger location fetch concurrently with photo capture
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(async (err) => {
        console.warn('[CAMERA] High accuracy location failed, retrying balanced:', err?.message);
        return await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => null);
      });

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        throw new Error('Photo capture failed');
      }

      setCapturedPhotoFacing(cameraFacing);
      setCapturedPhotoUri(photo.uri);
      setCameraVisible(false);
      setLoadingAction(false);

      // Handle location resolution
      locationPromise.then(async (freshLoc) => {
        if (freshLoc?.coords) {
          setCurrentLocation(freshLoc);
          setIsLocationVerified(true);
          setLocationStatus(`${Math.round(freshLoc.coords.accuracy || 0)} m`);
          await resolveLocationForCapture({
            latitude: freshLoc.coords.latitude,
            longitude: freshLoc.coords.longitude,
          });
        } else if (currentLocation?.coords) {
          await resolveLocationForCapture({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });
        } else {
          setCapturedLocationName('Location unavailable');
          setLocationResolutionError(true);
        }
      });
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

  const confirmCapturedPhoto = async () => {
    if (!capturedPhotoUri || loadingAction) return;

    await submitAttendance(capturedPhotoUri);
    setCapturedPhotoUri(null);
  };

  const submitAttendance = async (photoUri: string) => {
    if (loadingAction) return; // Prevent double tap
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
        await checkIn(locationData, photoUri);
        showSuccess('Check-In Successful!', 'Your check-in attendance has been recorded successfully.');
      } else {
        await checkOut(locationData, photoUri);
        showSuccess('Check-Out Successful!', 'Your check-out attendance has been recorded successfully.');
      }
      await fetchData();
    } catch (error: any) {
      showError('Attendance Failed', error.message || 'Validation failed.');
    } finally {
      setCurrentAction(null);
      setLoadingAction(false);
    }
  };

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

  const getGreeting = () => {
    return greeting;
  };

  const getWorkingHours = () => {
    if (!todayAttendance) return '-- : --';
    if (todayAttendance.working_hours) return formatWorkingHours(todayAttendance.working_hours);
    
    if (todayAttendance.check_in_time) {
      const checkInDate = new Date(todayAttendance.check_in_time);
      const checkOutDate = todayAttendance.check_out_time ? new Date(todayAttendance.check_out_time) : new Date();
      
      const diffMs = checkOutDate.getTime() - checkInDate.getTime();
      if (diffMs > 0) {
        const h = Math.floor(diffMs / (1000 * 60 * 60));
        const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
      }
    }
    return '-- : --';
  };

  const todayDateStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());

  const currentStatus = todayAttendance?.status || 'NOT_STARTED';
  const isWorking = currentStatus === 'WORKING' || currentStatus === 'ON_TIME' || currentStatus === 'LATE';
  const hasCompleted = currentStatus === 'COMPLETED';
  const isNotStarted = currentStatus === 'NOT_STARTED';
  const getImageUrl = (url: string | null | undefined) => {
    if (!url?.trim()) return null;

    const apiRoot = (
      process.env.EXPO_PUBLIC_API_URL ||
      'http://10.0.2.2:8000/api'
    ).replace(/\/api\/?$/, '');

    try {
      const parsed = new URL(url);

      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '10.0.2.2'
      ) {
        return `${apiRoot}${parsed.pathname}${parsed.search}`;
      }

      return url;
    } catch {
      return `${apiRoot}/${url.replace(/^\/+/, '')}`;
    }
  };

  console.log('[COMPANY DEBUG] company:', JSON.stringify(employee?.company));
  console.log('[COMPANY DEBUG] logo URL:', getImageUrl(employee?.company?.logo));
  const hasCheckedIn = todayAttendance?.check_in_time != null;
  const hasCheckedOut = todayAttendance?.check_out_time != null;
  const isCompleted = hasCheckedOut || todayAttendance?.status === 'COMPLETED';

  let displayStatus = 'Not Checked In';
  if (hasCheckedIn && !isCompleted) displayStatus = 'Working';
  else if (isCompleted) displayStatus = 'Completed';

  // Calculate Approval Badge
  const approvalStatus = todayAttendance?.approval_status || 'PENDING';
  let approvalColor = '#F59E0B'; // amber for pending
  let approvalBg = '#F5F5F5';
  let ApprovalIcon = Clock;
  let approvalText = 'Pending';
  
  if (approvalStatus === 'APPROVED') {
    approvalColor = COLORS.success;
    approvalBg = '#F5F5F5';
    ApprovalIcon = CheckCircle;
    approvalText = 'Approved';
  } else if (approvalStatus === 'REJECTED') {
    approvalColor = COLORS.danger;
    approvalBg = '#F5F5F5';
    ApprovalIcon = XCircle;
    approvalText = 'Rejected';
  }

  // Skeleton Loader for data fetching
  if (loadingData && !todayAttendance) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.skeletonContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.skeletonText}>Loading your dashboard...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar style="dark" hidden={false} />
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }} 
        showsVerticalScrollIndicator={false}
      >
        
        {/* MODERN CLEAN HEADER (REFERENCE DESIGN) */}
        <View style={[styles.headerArea, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.greetingBlock}>
              <Text style={styles.employeeName}>
                Hello, {employee?.full_name?.split(' ')[0] || 'Ashish'}
              </Text>
              <Text style={styles.greeting}>
                {getGreeting()} • {employee?.designation || employee?.branch?.branch_name || 'Yaazh 360'}
              </Text>
            </View>

            <View style={styles.headerRightActions}>
              <TouchableOpacity 
                style={styles.notificationPillBtn} 
                onPress={() => navigation.navigate('Notifications')} 
                accessibilityRole="button" 
                accessibilityLabel="Notifications"
                activeOpacity={0.7}
              >
                <Bell size={20} color={COLORS.dark} strokeWidth={2} />
                {notificationUnreadCount > 0 && (
                  <View style={styles.notificationRedDot} />
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.avatarPillBtn} 
                onPress={() => navigateToProfile()}
                activeOpacity={0.7}
              >
                {employee?.profile_photo ? (
                  <Image
                    source={{ uri: getImageUrl(employee.profile_photo)! }}
                    style={styles.avatarImg}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {employee?.full_name?.charAt(0) || 'U'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* SEARCH BAR (MATCHING REFERENCE UI) */}
          <View style={styles.searchBarWrapper}>
            <AppSearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search attendance, leaves, tasks..."
              onClear={() => setSearchQuery('')}
              onFilterPress={() => navigateToHistory()}
            />
          </View>
        </View>

        {/* MAIN ATTENDANCE CARD */}
        <View style={styles.mainCardWrapper}>
          <View style={styles.statusCard}>
            <View style={styles.statusTopRow}>
              <View style={styles.statusIconBox}>
                <Clock size={32} color="#FFF" strokeWidth={2.2} />
              </View>
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusLabel}>You are</Text>
                <Text style={styles.statusValue}>{displayStatus}</Text>
                {todayAttendance?.check_in_time && (
                  <Text style={styles.statusTimeSub}>
                    Checked in at <Text style={styles.statusTimeSubBold}>{formatAttendanceTime(todayAttendance.check_in_time)}</Text>
                  </Text>
                )}
              </View>
              {todayAttendance && todayAttendance.status === 'LATE' && (
                <View style={[styles.badge, styles.badgeLate]}>
                  <Text style={styles.badgeTextLate}>Late</Text>
                </View>
              )}
              {todayAttendance && (todayAttendance.status === 'ON_TIME' || todayAttendance.status === 'WORKING' || todayAttendance.status === 'COMPLETED') && (
                <View style={[styles.badge, styles.badgeSuccess]}>
                  <Text style={styles.badgeTextSuccess}>On Time</Text>
                </View>
              )}
            </View>

            {isCompleted ? (
              <View style={[styles.actionButtonsRow, { justifyContent: 'center' }]}>
                <View style={[styles.actionBtn, { backgroundColor: '#F5F5F5', flex: 1 }]}>
                  <Text style={{ color: COLORS.dark, fontFamily: 'Comfortaa_700Bold', fontSize: 16 }}>Attendance Completed</Text>
                </View>
              </View>
            ) : (
              <View style={styles.actionButtonsRow}>
                {!hasCheckedIn && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.actionBtnLeft]} 
                    onPress={() => startAttendance('CHECK_IN')}
                    disabled={loadingAction}
                  >
                    <LogIn size={20} color={COLORS.dark} style={styles.btnIcon} strokeWidth={2.2} />
                    <Text style={styles.actionBtnText}>Check In</Text>
                  </TouchableOpacity>
                )}

                {hasCheckedIn && !isCompleted && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.actionBtnRight, { marginLeft: 0 }]} 
                    onPress={() => startAttendance('CHECK_OUT')}
                    disabled={loadingAction}
                  >
                    <LogOut size={20} color={'#FFF'} style={styles.btnIcon} strokeWidth={2.2} />
                    <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Check Out</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* LOCATION CARD */}
        <View style={styles.locationCard}>
          <View style={styles.locationCol}>
            <MapPin size={22} color={COLORS.primary} strokeWidth={2.2} />
            <View style={styles.locationTextWrapper}>
              <Text style={styles.locationSubText}>Office Location</Text>
              <Text style={styles.locationMainText}>{employee?.branch?.branch_name || 'Main Branch'}</Text>
            </View>
          </View>
          <View style={styles.locationDivider} />
          <View style={styles.locationColRight}>
            <Target size={22} color={COLORS.primary} strokeWidth={2.2} />
            <View style={styles.locationTextWrapper}>
              <Text style={styles.locationSubText}>Accuracy</Text>
              <Text style={styles.locationMainText}>{locationStatus}</Text>
            </View>
          </View>
        </View>

        {/* FIELD EMPLOYEE LOCATION SHARING */}
        {employee?.work_type?.toUpperCase() === 'FIELD' && (
          <View style={styles.trackingCard}>
            <View style={styles.trackingCardHeader}>
              <View style={styles.trackingIcon}>
                <MapPin size={22} color={COLORS.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.trackingTextContainer}>
                <Text style={styles.trackingTitle}>Location Sharing</Text>
                <Text style={styles.trackingDescription}>
                  {sharingEnabled
                    ? 'Sharing is enabled. Authorised administrators may view your latest location.'
                    : 'Enable sharing when you are ready to share your location with authorised administrators.'}
                </Text>
              </View>
            </View>

            <View style={styles.trackingBottomRow}>
              <Text style={[
                styles.trackingStatus,
                { color: sharingEnabled ? '#000000' : COLORS.muted }
              ]}>
                {sharingStatusLoading
                  ? 'Checking status...'
                  : sharingEnabled ? 'Sharing enabled' : 'Sharing disabled'}
              </Text>

              <TouchableOpacity
                style={[
                  styles.trackingButton,
                  sharingEnabled && styles.trackingButtonOff,
                  (sharingLoading || sharingStatusLoading) && { opacity: 0.6 }
                ]}
                onPress={handleLocationSharingToggle}
                disabled={sharingLoading || sharingStatusLoading}
                accessibilityRole="button"
              >
                {sharingLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.trackingButtonText}>
                    {sharingEnabled ? 'Turn Off' : 'Enable'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* PERSONAL DAILY ALARM CARD */}
        <PersonalAlarmCard />

        {/* QUICK ACCESS CATEGORY BUBBLES (REFERENCE UI) */}
        <View style={styles.categoryBubblesWrapper}>
          <CategoryBubblesRow
            items={[
              {
                id: 'leave',
                label: 'Leave',
                icon: <CalendarDays size={22} color={COLORS.primary} strokeWidth={2} />,
                onPress: () => navigation.navigate('Leave'),
              },
              {
                id: 'permission',
                label: 'Permission',
                icon: <Clock size={22} color={COLORS.primary} strokeWidth={2} />,
                onPress: () => navigation.navigate('Permission'),
              },
              {
                id: 'wfh',
                label: 'WFH',
                icon: <House size={22} color={COLORS.primary} strokeWidth={2} />,
                onPress: () => navigation.navigate('WFH'),
              },
              {
                id: 'history',
                label: 'Attendance',
                icon: <Calendar size={22} color={COLORS.primary} strokeWidth={2} />,
                onPress: () => navigateToHistory(),
              },
            ]}
          />
        </View>

        {/* TODAY'S SUMMARY */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Summary</Text>
          <View style={styles.dateChip}>
            <Calendar size={14} color={COLORS.dark} style={{ marginRight: 6 }} strokeWidth={2.2} />
            <Text style={styles.dateChipText}>{todayDateStr}</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={[styles.summaryBox, { backgroundColor: '#F5F5F5' }]}>
            <Clock size={20} color={COLORS.success} strokeWidth={2.2} style={styles.summaryIcon} />
            <Text style={styles.summaryLabel}>Check In</Text>
            <Text style={styles.summaryValue}>{formatAttendanceTime(todayAttendance?.check_in_time)}</Text>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: '#F5F5F5' }]}>
            <LogOut size={20} color={COLORS.danger} strokeWidth={2.2} style={styles.summaryIcon} />
            <Text style={styles.summaryLabel}>Check Out</Text>
            <Text style={styles.summaryValue}>{formatAttendanceTime(todayAttendance?.check_out_time)}</Text>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: '#F5F5F5' }]}>
            <BarChart size={20} color={COLORS.warning} strokeWidth={2.2} style={styles.summaryIcon} />
            <Text style={styles.summaryLabel}>Status</Text>
            <View style={styles.summaryStatusBadge}>
              <Text style={styles.summaryStatusText}>{todayAttendance ? displayStatus : 'Not Checked In'}</Text>
            </View>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: '#F5F5F5' }]}>
            <Clock size={20} color={COLORS.primary} style={styles.summaryIcon} strokeWidth={2.2} />
            <Text style={styles.summaryLabel}>Working Hours</Text>
            <Text style={styles.summaryValue}>{getWorkingHours()}</Text>
          </View>
          
          {/* NEW APPROVAL BOX */}
          {todayAttendance && (
            <View style={[styles.summaryBox, { backgroundColor: approvalBg, width: '97%' }]}>
              <ApprovalIcon size={20} color={approvalColor} style={styles.summaryIcon} />
              <Text style={styles.summaryLabel}>Approval Status</Text>
              <View style={[styles.summaryStatusBadge, { backgroundColor: approvalColor }]}>
                <Text style={styles.summaryStatusText}>{approvalText}</Text>
              </View>
              {approvalStatus === 'REJECTED' && todayAttendance.rejection_reason && (
                <Text style={{ fontSize: 12, color: COLORS.danger, marginTop: 8, fontStyle: 'italic' }}>
                  Reason: {todayAttendance.rejection_reason}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* RECENT ATTENDANCE */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Recent Attendance</Text>
          <TouchableOpacity onPress={() => navigateToHistory()}>
            <Text style={styles.viewAllText}>View All <ChevronRight size={14} color={COLORS.primary} strokeWidth={2.2} /></Text>
          </TouchableOpacity>
        </View>

        {recentHistory.map((item, index) => {
          const dateObj = new Date(item.date);
          const day = dateObj.getDate().toString().padStart(2, '0');
          const month = dateObj.toLocaleString('default', { month: 'short' });
          const isLate = item.status === 'LATE';
          
          return (
            <View key={item.id?.toString() || index.toString()} style={styles.recentItem}>
              <View style={styles.recentDateBox}>
                <Text style={styles.recentDateDay}>{day}</Text>
                <Text style={styles.recentDateMonth}>{month}</Text>
              </View>
              <View style={styles.recentItemDot} />
              <View style={styles.recentItemBody}>
                <View style={styles.recentItemRow}>
                  <Text style={styles.recentItemLabel}>Check In</Text>
                  <View style={[styles.recentBadge, isLate ? styles.badgeLate : styles.badgeSuccess]}>
                    <Text style={[styles.recentBadgeText, isLate ? styles.badgeTextLate : styles.badgeTextSuccess]}>
                      {item.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                <View style={styles.recentItemRow}>
                  <Text style={styles.recentItemTime}>{formatAttendanceTime(item.check_in_time)}</Text>
                  <View style={styles.recentItemLocation}>
                    <MapPin size={12} color={COLORS.muted} style={{ marginRight: 4 }} strokeWidth={2.2} />
                    <Text style={styles.recentItemLocText}>{item.branch?.branch_name || employee?.branch?.branch_name || 'Main Branch'}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DAILY TASK REMINDER MODAL */}
      <MobileTaskDailyReminderModal
        visible={showTaskReminder}
        tasks={assignedTasks}
        onClose={async () => {
          setShowTaskReminder(false);
          const todayKey = 'daily_task_reminder_' + new Date().toISOString().slice(0, 10);
          try {
            await SecureStore.setItemAsync(todayKey, '1');
          } catch {}
        }}
        onViewAllTasks={async () => {
          setShowTaskReminder(false);
          const todayKey = 'daily_task_reminder_' + new Date().toISOString().slice(0, 10);
          try {
            await SecureStore.setItemAsync(todayKey, '1');
          } catch {}
          navigation.navigate('TasksTab');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  skeletonContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  skeletonText: { marginTop: 16, color: COLORS.muted, fontSize: 16 },

  headerArea: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationPillBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#202334',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  notificationRedDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarPillBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
  },
  greetingBlock: {
    flex: 1,
    marginRight: 12,
  },
  employeeName: {
    color: COLORS.dark,
    fontSize: 24,
    fontFamily: 'Comfortaa_700Bold',
    letterSpacing: -0.4,
  },
  greeting: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 3,
  },
  searchBarWrapper: {
    marginTop: 2,
  },
  categoryBubblesWrapper: {
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
  },
    notificationButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    notificationBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: '#EF4444',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.primary,
    },
    notificationBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontFamily: 'Comfortaa_700Bold',
    },


  mainCardWrapper: {
    paddingHorizontal: 20,
    marginTop: 14,
    zIndex: 20,
  },
  statusCard: { 
    backgroundColor: COLORS.card, 
    borderRadius: 20, 
    padding: 20, 
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#202334', 
    shadowOpacity: 0.04, 
    shadowRadius: 12, 
    shadowOffset: { width: 0, height: 4 }, 
    elevation: 3, 
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  statusTextContainer: { flex: 1 },
  statusLabel: { fontSize: 14, color: COLORS.muted, marginBottom: 2 },
  statusValue: { fontSize: 26, fontFamily: 'Comfortaa_700Bold', color: COLORS.primary },
  statusTimeSub: { fontSize: 13, color: COLORS.muted, marginTop: 4 },
  statusTimeSubBold: { fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, alignSelf: 'flex-start' },
  badgeSuccess: { backgroundColor: '#F5F5F5' },
  badgeLate: { backgroundColor: '#F5F5F5' },
  badgeTextSuccess: { color: COLORS.success, fontSize: 12, fontFamily: 'Comfortaa_700Bold', },
  badgeTextLate: { color: COLORS.danger, fontSize: 12, fontFamily: 'Comfortaa_700Bold', },

  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnLeft: {
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  actionBtnRight: {
    backgroundColor: COLORS.primary,
    marginLeft: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnDisabled: {
    backgroundColor: '#F5F5F5',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnIcon: { marginRight: 8 },
  actionBtnText: { fontSize: 16, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  actionBtnTextDisabled: { color: COLORS.muted },

  trackingCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  trackingCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  trackingIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trackingTextContainer: {
    flex: 1,
  },
  trackingTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
    marginBottom: 5,
  },
  trackingDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
  },
  trackingBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  trackingStatus: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    flex: 1,
  },
  trackingButton: {
    backgroundColor: '#000000',
    minWidth: 92,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingButtonOff: {
    backgroundColor: '#666666',
  },
  trackingButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
  },
  locationCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    alignItems: 'center',
  },
  locationCol: { flexDirection: 'row', alignItems: 'center', flex: 1.2 },
  locationColRight: { flexDirection: 'row', alignItems: 'center', flex: 0.8 },
  locationDivider: { width: 1, height: '100%', backgroundColor: '#E5E5E5', marginHorizontal: 12 },
  locationTextWrapper: { marginLeft: 10, flex: 1 },
  locationSubText: { fontSize: 11, color: COLORS.muted, marginBottom: 2 },
  locationMainText: { fontSize: 13, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },

  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 24,
    rowGap: 12,
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quickActionText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
    textAlign: 'center',
    lineHeight: 14,
  },

  quickActionIconBg: {
    width: 44,
    height: 44,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 16,
  },

  sectionTitle: { fontSize: 20, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  dateChipText: { fontSize: 12, fontFamily: 'Comfortaa_600SemiBold', color: COLORS.dark },
  viewAllText: { fontSize: 14, fontFamily: 'Comfortaa_600SemiBold', color: COLORS.primary },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  summaryBox: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: '1.5%',
  },
  summaryIcon: { marginBottom: 12 },
  summaryLabel: { fontSize: 12, color: COLORS.muted, marginBottom: 4 },
  summaryValue: { fontSize: 18, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  summaryStatusBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  summaryStatusText: { color: '#FFF', fontSize: 12, fontFamily: 'Comfortaa_700Bold', },

  recentItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  recentDateBox: {
    width: 50,
    height: 56,
    backgroundColor: '#FFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F5F5F5',
  },
  recentDateDay: { fontSize: 18, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  recentDateMonth: { fontSize: 11, color: COLORS.muted },
  recentItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginHorizontal: 12,
  },
  recentItemBody: { flex: 1, backgroundColor: '#FFF', padding: 14, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  recentItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  recentItemLabel: { fontSize: 13, color: COLORS.muted },
  recentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  recentBadgeText: { fontSize: 10, fontFamily: 'Comfortaa_700Bold', },
  recentItemTime: { fontSize: 16, fontFamily: 'Comfortaa_700Bold', color: COLORS.dark },
  recentItemLocation: { flexDirection: 'row', alignItems: 'center' },
  recentItemLocText: { fontSize: 11, color: COLORS.muted },

  cameraContainer: { flex: 1, backgroundColor: 'black' },
  cameraOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', alignItems: 'center', padding: 24, zIndex: 10 },
  cameraHeader: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginTop: 40 },
  backButton: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  backText: { color: '#FFF', fontSize: 16, fontFamily: 'Comfortaa_600SemiBold', },
  flipCameraButton: { padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  cameraTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Comfortaa_700Bold', },
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
  photoPreviewImageFront: {
    transform: [{ scaleX: -1 }],
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






















