import { PersonalAlarmCard } from '../../components/PersonalAlarm';
import { useEffect, useState, useContext, useRef, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api/index';
import { checkIn, checkOut, getHistory } from '../../api/attendance';
import CameraCapture from '../../components/CameraCapture';
import { useLocation } from '../../hooks/useLocation';
import type { LocationData } from '../../hooks/useLocation';
import {
  getLocationSharingStatus,
  setLocationSharing,
  uploadLocationUpdate,
  getCurrentPositionPromise,
  calculateDistanceMeters,
} from '../../services/locationTrackingService';

import {
  Clock3,
  MapPin,
  CalendarDays,
  UserRound,
  ChevronRight,
  LogIn,
  LogOut,
  Target,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Navigation,
  Loader2,
  AlertCircle,
  ListTodo,
} from 'lucide-react';

import { Link, useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { TaskDailyReminderModal } from '../../components/TaskDailyReminderModal';
import type { DailyReminderTask } from '../../components/TaskDailyReminderModal';
import { TaskWorkspaceModal } from '../../components/TaskWorkspaceModal';


const EmployeeDashboard = () => {
  const { employee } = useContext(AuthContext);
  const navigate = useNavigate();

  const [todayData, setTodayData] = useState<any>(null);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCamera, setShowCamera] = useState(false);
  const [actionType, setActionType] = useState<'CHECK_IN' | 'CHECK_OUT' | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const [attendancePopup, setAttendancePopup] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  const [locationStatus, setLocationStatus] = useState('-- m');

  // Late check-in reason modal state
  const [showLateReasonModal, setShowLateReasonModal] = useState(false);
  const [lateReasonText, setLateReasonText] = useState('');
  const [pendingLateNotice, setPendingLateNotice] = useState('');
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingLocationData, setPendingLocationData] = useState<LocationData | null>(null);

  // Daily Tasks Reminder Pop-up State
  const [assignedTasks, setAssignedTasks] = useState<DailyReminderTask[]>([]);
  const [showTaskReminder, setShowTaskReminder] = useState(false);
  const [activeWorkspaceTaskId, setActiveWorkspaceTaskId] = useState<number | null>(null);

  // Live Location Sharing state for FIELD & MARKETING employees
  const normalizedWorkType = (employee?.work_type || '').trim().toUpperCase();
  const isTrackingEligible = ['FIELD', 'MARKETING'].includes(normalizedWorkType);

  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [sharingStatusLoading, setSharingStatusLoading] = useState(false);
  const [sharingError, setSharingError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastLocationRef = useRef<{
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null>(null);

  const stopLocationWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const handlePositionUpdate = useCallback(async (pos: GeolocationPosition) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;
    const now = Date.now();

    const last = lastLocationRef.current;
    if (last) {
      const elapsedSeconds = (now - last.timestamp) / 1000;
      const distanceMoved = calculateDistanceMeters(
        last.latitude,
        last.longitude,
        lat,
        lon
      );

      // Upload if elapsed time >= 60s or moved >= 50m
      if (elapsedSeconds < 60 && distanceMoved < 50) {
        return;
      }
    }

    try {
      await uploadLocationUpdate(lat, lon, accuracy);
      lastLocationRef.current = {
        latitude: lat,
        longitude: lon,
        timestamp: now,
      };
      setSharingError(null);
    } catch (err: any) {
      console.warn('[LOCATION SHARING] Periodic upload failed:', err?.response?.status || err?.message);
    }
  }, []);

  const startLocationWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setSharingError('Geolocation is not supported by your browser.');
      return;
    }

    stopLocationWatching();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        handlePositionUpdate(pos);
      },
      (err) => {
        let msg = 'Live location error.';
        if (err.code === 1) msg = 'Location permission denied by browser.';
        else if (err.code === 2) msg = 'Location position unavailable.';
        else if (err.code === 3) msg = 'Location request timed out.';
        setSharingError(msg);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      }
    );

    watchIdRef.current = watchId;
  }, [handlePositionUpdate, stopLocationWatching]);

  const loadSharingStatus = useCallback(async () => {
    if (!isTrackingEligible) return;

    setSharingStatusLoading(true);
    setSharingError(null);
    try {
      const statusData = await getLocationSharingStatus();
      const active = Boolean(statusData?.is_enabled);
      setSharingEnabled(active);

      // If already active on backend, attempt to resume browser GPS watching
      if (active) {
        try {
          const initialPos = await getCurrentPositionPromise();
          await uploadLocationUpdate(
            initialPos.coords.latitude,
            initialPos.coords.longitude,
            initialPos.coords.accuracy
          );
          lastLocationRef.current = {
            latitude: initialPos.coords.latitude,
            longitude: initialPos.coords.longitude,
            timestamp: Date.now(),
          };
          startLocationWatching();
        } catch (posErr: any) {
          console.warn('[LOCATION SHARING] Could not resume browser watcher:', posErr.message);
          setSharingError(posErr.message || 'Location permission required to track live location.');
        }
      }
    } catch (err: any) {
      console.warn('[LOCATION SHARING] Status load failed:', err?.response?.status || err?.message);
    } finally {
      setSharingStatusLoading(false);
    }
  }, [isTrackingEligible, startLocationWatching]);

  const handleToggleSharing = async (targetEnable: boolean) => {
    if (sharingLoading || sharingStatusLoading) return;
    setSharingLoading(true);
    setSharingError(null);

    if (targetEnable) {
      try {
        // 1. Request browser location permission & current coordinates first
        const initialPos = await getCurrentPositionPromise();

        // 2. Enable sharing on backend
        await setLocationSharing(true);
        setSharingEnabled(true);

        // 3. Upload first location immediately
        try {
          await uploadLocationUpdate(
            initialPos.coords.latitude,
            initialPos.coords.longitude,
            initialPos.coords.accuracy
          );
          lastLocationRef.current = {
            latitude: initialPos.coords.latitude,
            longitude: initialPos.coords.longitude,
            timestamp: Date.now(),
          };
        } catch (uploadErr: any) {
          console.warn('[LOCATION SHARING] Initial location upload failed:', uploadErr);
        }

        // 4. Start continuous location watcher
        startLocationWatching();
      } catch (err: any) {
        // If enabling fails, attempt to revert backend state to disabled
        try {
          await setLocationSharing(false);
        } catch {}
        stopLocationWatching();
        setSharingEnabled(false);
        setSharingError(err?.message || 'Failed to enable location sharing.');
      } finally {
        setSharingLoading(false);
      }
    } else {
      try {
        stopLocationWatching();
        await setLocationSharing(false);
        setSharingEnabled(false);
        lastLocationRef.current = null;
      } catch (err: any) {
        setSharingError(err?.response?.data?.detail || err?.message || 'Failed to disable location sharing.');
      } finally {
        setSharingLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isTrackingEligible) {
      loadSharingStatus();
    }
    return () => {
      stopLocationWatching();
    };
  }, [isTrackingEligible, loadSharingStatus, stopLocationWatching]);

  const { getLocation } = useLocation();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [todayRes, historyRes, tasksRes] = await Promise.allSettled([
        api.get('/attendance/today/'),
        getHistory(1),
        api.get('/tasks-module/tasks/'),
      ]);

      if (todayRes.status === 'fulfilled') {
        setTodayData(todayRes.value.data);
        const accuracy =
          todayRes.value.data?.check_in_accuracy ||
          todayRes.value.data?.check_out_accuracy ||
          todayRes.value.data?.gps_accuracy;
        if (accuracy !== undefined && accuracy !== null) {
          setLocationStatus(`${Math.round(Number(accuracy))} m`);
        }
      }

      if (historyRes.status === 'fulfilled') {
        const historyList = historyRes.value?.results || historyRes.value || [];
        setRecentHistory(historyList.slice(0, 3));
      }

      if (tasksRes.status === 'fulfilled') {
        const allTasks = Array.isArray(tasksRes.value.data) ? tasksRes.value.data : [];
        // Only active/incomplete tasks
        const activeTasks = allTasks.filter(
          (t: any) => !['COMPLETED', 'CANCELLED', 'DRAFT'].includes(t.status)
        );
        setAssignedTasks(activeTasks);

        // Daily login reminder check
        const todayStr = new Date().toISOString().slice(0, 10);
        const reminderStorageKey = `daily_task_reminder_seen_${todayStr}`;
        const alreadyDismissed = sessionStorage.getItem(reminderStorageKey);

        if (activeTasks.length > 0 && !alreadyDismissed) {
          setShowTaskReminder(true);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleAction = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    setActionType(type);
    setShowCamera(true);
    setLocationStatus('Getting location...');

    try {
      const location = await getLocation();

      setLocationStatus(
        `${Math.round(location.accuracy || 0)} m`
      );
    } catch (error) {
      console.error('Location error:', error);
      setLocationStatus('Location unavailable');
    }
  };

  const submitCheckInWithReason = async () => {
    if (!lateReasonText.trim()) {
      alert('Please enter a reason for late arrival.');
      return;
    }
    if (!pendingPhotoUri || !pendingLocationData) {
      alert('Session expired. Please capture your photo again.');
      setShowLateReasonModal(false);
      return;
    }

    setLoadingAction(true);
    try {
      await checkIn(pendingLocationData, pendingPhotoUri, lateReasonText.trim());
      setShowLateReasonModal(false);
      setLateReasonText('');
      setPendingPhotoUri(null);
      setPendingLocationData(null);

      setAttendancePopup({
        show: true,
        type: 'success',
        title: 'Check-In Successful',
        message: 'Your attendance has been marked successfully.',
      });
      await fetchDashboardData();
    } catch (error: any) {
      const errMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Check-In failed. Please try again.';
      setAttendancePopup({
        show: true,
        type: 'error',
        title: 'Check-In Failed',
        message: String(errMsg),
      });
    } finally {
      setActionType(null);
      setLoadingAction(false);
    }
  };

  const handleCapture = async (photoUri: string) => {
    setShowCamera(false);

    if (!actionType || loadingAction) {
      return;
    }

    setLoadingAction(true);

    try {
      const locationData = await getLocation();

      if (actionType === 'CHECK_IN') {
        await checkIn(locationData, photoUri);

        setAttendancePopup({
          show: true,
          type: 'success',
          title: 'Check-In Successful',
          message: 'Your attendance has been marked successfully.',
        });
      } else {
        await checkOut(locationData, photoUri);

        setAttendancePopup({
          show: true,
          type: 'success',
          title: 'Check-Out Successful',
          message: 'Your check-out has been recorded successfully.',
        });
      }

      await fetchDashboardData();
    } catch (error: any) {
      console.error('Attendance action error:', error);
      console.error('Attendance API error details:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
        responseURL: error?.config?.url,
      });

      const resData = error?.response?.data;
      if (resData?.code === 'LATE_REASON_REQUIRED') {
        setPendingLateNotice(resData.error || `You are checking in late.`);
        setPendingPhotoUri(photoUri);
        try {
          const loc = await getLocation();
          setPendingLocationData(loc);
        } catch {
          // ignore
        }
        setShowLateReasonModal(true);
        return;
      }

      const errorMessage =
        resData?.error ||
        resData?.detail ||
        resData?.message ||
        error?.message ||
        'Attendance action failed. Please try again.';

      const isLocationError =
        /location|outside|radius|distance|gps|geofence|office/i.test(
          String(errorMessage)
        );

      setAttendancePopup({
        show: true,
        type: 'error',
        title: isLocationError
          ? 'Outside Office Location'
          : 'Attendance Failed',
        message: String(errorMessage),
      });
    } finally {
      setActionType(null);
      setLoadingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="employee-dashboard-loading">
        <div className="dashboard-loader">
          <div className="loader-ring" />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const currentStatus = todayData?.status || 'NOT_STARTED';

  const hasCheckedIn =
    todayData?.check_in_time !== null &&
    todayData?.check_in_time !== undefined;

  const hasCheckedOut =
    todayData?.check_out_time !== null &&
    todayData?.check_out_time !== undefined;

  const isCompleted =
    hasCheckedOut || currentStatus === 'COMPLETED';

  const isWorking =
    hasCheckedIn && !isCompleted;

  const isLate =
    currentStatus === 'LATE';

  let displayStatus = 'Not Started';

  if (isWorking) {
    displayStatus = 'Working';
  } else if (isCompleted) {
    displayStatus = 'Completed';
  }

  const statusText =
    isLate
      ? 'Late'
      : isWorking || currentStatus === 'ON_TIME'
        ? 'On Time'
        : isCompleted
          ? 'Completed'
          : 'Not Started';

  const statusClass =
    isLate
      ? 'status-late'
      : isWorking || currentStatus === 'ON_TIME'
        ? 'status-ontime'
        : isCompleted
          ? 'status-completed'
          : 'status-neutral';

  const formatTime = (value: any) => {
    if (!value) return '--:--';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '--:--';
    }

    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateValue?: string) => {
    const date = dateValue
      ? new Date(dateValue)
      : new Date();

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getWorkingHours = () => {
    if (todayData?.working_hours) {
      return todayData.working_hours;
    }

    if (!todayData?.check_in_time || !todayData?.check_out_time) {
      return '--:--';
    }

    const start = new Date(todayData.check_in_time).getTime();
    const end = new Date(todayData.check_out_time).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
      return '--:--';
    }

    const totalMinutes = Math.floor(
      (end - start) / 60000
    );

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, '0')}:${String(
      minutes
    ).padStart(2, '0')}`;
  };

  const employeeName = String(
    employee?.name ||
    employee?.employee_name ||
    employee?.username ||
    'Employee'
  ).replace(/[^\x00-\x7F]+/g, '').trim() || 'Employee';

  const employeePhoto =
    employee?.profile_photo ||
    employee?.photo ||
    employee?.profile_image ||
    null;

  const branchName =
    employee?.branch?.branch_name ||
    employee?.branch_name ||
    todayData?.branch?.branch_name ||
    'Main Branch';

  const companyName =
    employee?.company_name ||
    (typeof employee?.company === 'object' ? employee.company?.name : '') ||
    employee?.branch?.company_name ||
    employee?.branch?.company?.name ||
    '';

  const departmentName = employee?.department || '';
  const designationName = employee?.designation || '';



  const todayStatus =
    isLate
      ? 'Late'
      : isWorking
        ? 'Working'
        : isCompleted
          ? 'Completed'
          : 'Not Started';

  return (
    <>
      {/* LATE REASON MODAL */}
      {showLateReasonModal && (
        <div className="attendance-popup-overlay">
          <div className="attendance-popup attendance-popup-error" style={{ maxWidth: 440, width: '92%' }}>
            <div className="attendance-popup-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
              <AlertCircle size={28} />
            </div>
            <div className="attendance-popup-content">
              <h3>Late Arrival Notice</h3>
              <p style={{ marginBottom: 12 }}>{pendingLateNotice}</p>
              <textarea
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #D1D5DB',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'none',
                  boxSizing: 'border-box',
                  marginBottom: 10,
                }}
                placeholder="Reason for late arrival (e.g. Traffic, client meeting)..."
                value={lateReasonText}
                onChange={(e) => setLateReasonText(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  style={{ background: '#F3F4F6', color: '#374151' }}
                  onClick={() => {
                    setShowLateReasonModal(false);
                    setLateReasonText('');
                    setPendingPhotoUri(null);
                    setPendingLocationData(null);
                  }}
                  disabled={loadingAction}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitCheckInWithReason}
                  disabled={loadingAction || !lateReasonText.trim()}
                >
                  {loadingAction ? 'Submitting...' : 'Submit & Check In'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {attendancePopup.show && (
        <div className="attendance-popup-overlay">
          <div className={`attendance-popup ${
            attendancePopup.type === 'error'
              ? 'attendance-popup-error'
              : 'attendance-popup-success'
          }`}>
            <div className="attendance-popup-icon">
              {attendancePopup.type === 'success' ? (
                <CheckCircle2 size={28} />
              ) : (
                <MapPin size={28} />
              )}
            </div>

            <div className="attendance-popup-content">
              <h3>{attendancePopup.title}</h3>
              <p>{attendancePopup.message}</p>

              <button
                type="button"
                onClick={() =>
                  setAttendancePopup((prev) => ({
                    ...prev,
                    show: false,
                  }))
                }
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="employee-dashboard">

      {/* =====================================================
          HEADER
      ===================================================== */}
      <section className="dashboard-hero">

        <div className="dashboard-hero-top">

          <div className="dashboard-greeting">
            <p className="dashboard-small-greeting">
              Good Morning!
            </p>

            <h1>
              Hi, {employeeName}
              <span className="greeting-hand"></span>
            </h1>

            <p className="dashboard-date">
              {formatDate()}
            </p>

            {(companyName || departmentName || designationName) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem 1rem', marginTop: '0.65rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {companyName && <span><strong>Company:</strong> {companyName}</span>}
                {departmentName && <span><strong>Department:</strong> {departmentName}</span>}
                {designationName && <span><strong>Designation:</strong> {designationName}</span>}
              </div>
            )}

            
          </div>

          <button
            type="button"
            className="profile-avatar-button"
            onClick={() => navigate('/profile')}
            aria-label="Open profile"
          >
            {employeePhoto ? (
              <img
                src={employeePhoto}
                alt={employeeName}
                className="dashboard-avatar-image"
              />
            ) : (
              <div className="dashboard-avatar-placeholder">
                <UserRound size={30} />
              </div>
            )}
          </button>

        </div>

      </section>

      {/* =====================================================
          WORK STATUS CARD
      ===================================================== */}
      <section className="working-card">

        <div className="working-card-inner">

          <div className="working-status-top">

            <div className="working-icon">
              <Clock3 size={34} strokeWidth={2.3} />
            </div>

            <div className="working-status-content">

              <span className="working-label">
                You are
              </span>

              <h2>
                {displayStatus}
              </h2>

              {hasCheckedIn && (
                <p>
                  Checked in at{' '}
                  <strong>
                    {formatTime(todayData?.check_in_time)}
                  </strong>
                </p>
              )}

              {!hasCheckedIn && (
                <p>
                  Ready to start your attendance
                </p>
              )}

            </div>

            <div className={`attendance-status-pill ${statusClass}`}>
              <span className="status-dot" />
              {statusText}
            </div>

          </div>

          {/* ACTION BUTTONS */}

          <div className="attendance-actions">

            <button
              type="button"
              className={`attendance-action-btn Check In-btn ${
                hasCheckedIn ? 'disabled-action' : ''
              }`}
              onClick={() => handleAction('CHECK_IN')}
              disabled={hasCheckedIn || loadingAction}
            >
              <LogIn size={24} />
              <span>Check In</span>
            </button>

            <button
              type="button"
              className={`attendance-action-btn Check Out-btn ${
                !hasCheckedIn || isCompleted
                  ? 'disabled-action'
                  : ''
              }`}
              onClick={() => handleAction('CHECK_OUT')}
              disabled={
                !hasCheckedIn ||
                isCompleted ||
                loadingAction
              }
            >
              <LogOut size={24} />
              <span>Check Out</span>
            </button>

          </div>

        </div>

      </section>

      {/* =====================================================
          LOCATION CARD
      ===================================================== */}
      <section className="location-card">

        <div className="location-section">

          <div className="location-icon">
            <MapPin size={25} />
          </div>

          <div>
            <span className="location-label">
              Office Location
            </span>

            <strong className="location-value">
              {branchName}
            </strong>
          </div>

        </div>

        <div className="location-divider" />

        <div className="accuracy-section">

          <div className="accuracy-icon">
            <Target size={25} />
          </div>

          <div>
            <span className="location-label">
              Accuracy
            </span>

            <strong className="location-value">
              {locationStatus}
            </strong>
          </div>

        </div>

      </section>

      {/* =====================================================
          LIVE LOCATION SHARING CARD (FIELD & MARKETING ONLY)
      ===================================================== */}
      {isTrackingEligible && (
        <section className="live-tracking-card">
          <div className="live-tracking-card-header">
            <div className="live-tracking-icon-box">
              <Navigation size={22} className={sharingEnabled ? 'live-tracking-icon-active' : ''} />
            </div>

            <div className="live-tracking-content">
              <div className="live-tracking-title-row">
                <h3>Live Location Sharing</h3>
                <span className={`live-tracking-badge ${sharingEnabled ? 'badge-active' : 'badge-off'}`}>
                  <span className="live-tracking-dot" />
                  {sharingStatusLoading
                    ? 'Checking...'
                    : sharingEnabled
                    ? 'Sharing Active'
                    : 'Sharing Off'}
                </span>
              </div>

              <p className="live-tracking-desc">
                {sharingEnabled
                  ? 'Your live GPS location is being shared with company administrators while on duty.'
                  : 'Enable location sharing to share your live GPS location with company administrators.'}
              </p>

              {sharingError && (
                <div className="live-tracking-error">
                  <AlertCircle size={15} />
                  <span>{sharingError}</span>
                </div>
              )}
            </div>
          </div>

          <div className="live-tracking-footer">
            <div className="live-tracking-status-text">
              Status:{' '}
              <strong>
                {sharingStatusLoading
                  ? 'Verifying...'
                  : sharingEnabled
                  ? 'Sharing Active'
                  : 'Sharing Off'}
              </strong>
            </div>

            <div className="live-tracking-actions">
              {sharingEnabled ? (
                <button
                  type="button"
                  className="live-tracking-btn live-tracking-btn-disable"
                  onClick={() => handleToggleSharing(false)}
                  disabled={sharingLoading || sharingStatusLoading}
                >
                  {sharingLoading ? (
                    <>
                      <Loader2 size={16} className="btn-spinner" />
                      <span>Disabling...</span>
                    </>
                  ) : (
                    <span>Disable Sharing</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="live-tracking-btn live-tracking-btn-enable"
                  onClick={() => handleToggleSharing(true)}
                  disabled={sharingLoading || sharingStatusLoading}
                >
                  {sharingLoading ? (
                    <>
                      <Loader2 size={16} className="btn-spinner" />
                      <span>Enabling...</span>
                    </>
                  ) : (
                    <span>Enable Sharing</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          PERSONAL DAILY ALARM CARD
      ===================================================== */}
      <PersonalAlarmCard />

      {/* =====================================================
          QUICK ACTIONS
          Notifications intentionally removed
      ===================================================== */}
      <section className="quick-actions">

        <button
          type="button"
          className="quick-action-card"
          onClick={() => navigate('/tasks')}
        >
          <div className="quick-icon history-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <ListTodo size={25} />
          </div>

          <span>
            {['TEAM_LEADER', 'REPORTING_MANAGER', 'HR', 'ADMIN', 'SUPER_ADMIN'].includes(employee?.role || employee?.user?.role || '') ? 'Task Manager' : 'My Tasks'}
          </span>
        </button>

        <button
          type="button"
          className="quick-action-card"
          onClick={() => navigate('/attendance')}
        >
          <div className="quick-icon history-icon">
            <CalendarDays size={25} />
          </div>

          <span>
            Attendance
            <br />
            History
          </span>
        </button>

        <button
          type="button"
          className="quick-action-card"
          onClick={() => navigate('/reports')}
        >
          <div className="quick-icon reports-icon">
            <BarChart3 size={25} />
          </div>

          <span>
            Reports
          </span>
        </button>

        <button
          type="button"
          className="quick-action-card"
          onClick={() => navigate('/profile')}
        >
          <div className="quick-icon profile-icon">
            <UserRound size={25} />
          </div>

          <span>
            Profile
          </span>
        </button>

      </section>

      {/* =====================================================
          TODAY'S SUMMARY
      ===================================================== */}
      <section className="summary-section">

        <div className="section-heading-row">

          <div>
            <h2>
              Today's Summary
            </h2>

            <p>
              {formatDate()}
            </p>
          </div>

          <div className="summary-calendar">
            <CalendarDays size={18} />
            <span>
              {new Date().toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

        </div>

        <div className="summary-grid">

          {/* Check In */}
          <div className="summary-card summary-green">

            <div className="summary-card-icon">
              <LogIn size={21} />
            </div>

            <span>
              Check In
            </span>

            <strong>
              {formatTime(todayData?.check_in_time)}
            </strong>

          </div>

          {/* Check Out */}
          <div className="summary-card summary-red">

            <div className="summary-card-icon">
              <LogOut size={21} />
            </div>

            <span>
              Check Out
            </span>

            <strong>
              {formatTime(todayData?.check_out_time)}
            </strong>

          </div>

          {/* STATUS */}
          <div className="summary-card summary-yellow">

            <div className="summary-card-icon">
              <BriefcaseBusiness size={21} />
            </div>

            <span>
              Status
            </span>

            <strong className="summary-status">
              {todayStatus}
            </strong>

          </div>

          {/* WORKING HOURS */}
          <div className="summary-card summary-blue">

            <div className="summary-card-icon">
              <Clock3 size={21} />
            </div>

            <span>
              Working Hours
            </span>

            <strong>
              {getWorkingHours()}
            </strong>

          </div>

        </div>

      </section>

      {/* =====================================================
          RECENT ATTENDANCE
      ===================================================== */}
      <section className="recent-section">

        <div className="recent-heading">

          <h2>
            Recent Attendance
          </h2>

          <Link to="/attendance">
            View All
            <ChevronRight size={18} />
          </Link>

        </div>

        {recentHistory.length === 0 ? (

          <div className="recent-empty">
            <CalendarDays size={42} />
            <p>
              No recent attendance records found.
            </p>
          </div>

        ) : (

          <div className="recent-list">

            {recentHistory.map((item, index) => {

              const date = new Date(item.date);

              const isItemLate =
                item.status === 'LATE';

              const itemStatus =
                isItemLate
                  ? 'Late'
                  : 'Present';

              return (
                <div
                  key={item.id || index}
                  className="recent-attendance-card"
                >

                  <div className="recent-date-box">

                    <strong>
                      {date
                        .getDate()
                        .toString()
                        .padStart(2, '0')}
                    </strong>

                    <span>
                      {date.toLocaleString(
                        'default',
                        { month: 'short' }
                      )}
                    </span>

                  </div>

                  <div className="recent-timeline">

                    <span
                      className={`timeline-dot ${
                        isItemLate
                          ? 'timeline-late'
                          : ''
                      }`}
                    />

                  </div>

                  <div className="recent-content">

                    <span className="recent-title">
                      Check In
                    </span>

                    <strong className="recent-time">
                      {formatTime(
                        item.check_in_time
                      )}
                    </strong>

                    <span className="recent-location">
                      <MapPin size={14} />
                      {item.branch?.branch_name ||
                        branchName}
                    </span>

                  </div>

                  <div
                    className={`recent-status ${
                      isItemLate
                        ? 'recent-status-late'
                        : ''
                    }`}
                  >
                    <CheckCircle2 size={15} />
                    {itemStatus}
                  </div>

                </div>
              );
            })}

          </div>

        )}

      </section>

      {/* =====================================================
          CAMERA
      ===================================================== */}
      {showCamera && (
        <div className="attendance-camera-overlay">

          <CameraCapture
            onCapture={handleCapture}
            onCancel={() => {
              setShowCamera(false);
              setActionType(null);
            }}
          />

        </div>
      )}

      {/* =====================================================
          DAILY TASK REMINDER SIDEBAR POPUP
      ===================================================== */}
      <TaskDailyReminderModal
        isOpen={showTaskReminder}
        tasks={assignedTasks}
        onClose={() => {
          const todayStr = new Date().toISOString().slice(0, 10);
          sessionStorage.setItem(`daily_task_reminder_seen_${todayStr}`, '1');
          setShowTaskReminder(false);
        }}
        onViewTasks={() => {
          const todayStr = new Date().toISOString().slice(0, 10);
          sessionStorage.setItem(`daily_task_reminder_seen_${todayStr}`, '1');
          setShowTaskReminder(false);
          navigate('/tasks');
        }}
        onOpenTask={(taskId) => {
          const todayStr = new Date().toISOString().slice(0, 10);
          sessionStorage.setItem(`daily_task_reminder_seen_${todayStr}`, '1');
          setShowTaskReminder(false);
          setActiveWorkspaceTaskId(taskId);
        }}
      />

      {/* Task Workspace Modal for quick inspection */}
      {activeWorkspaceTaskId && (
        <TaskWorkspaceModal
          taskId={activeWorkspaceTaskId}
          onClose={() => setActiveWorkspaceTaskId(null)}
          onSaved={() => {
            fetchDashboardData();
          }}
        />
      )}

    </div>
    </>
  );
};

export default EmployeeDashboard;




