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
  Users,
  Shield,
  CalendarCheck,
  Calendar,
  Building2,
  Clock,
  UserCheck,
  UserX,
  Palmtree,
  Zap,
  ArrowRight,
  Plus,
  RefreshCw,
  Building,
  CalendarPlus,
  ClockPlus,
  Home,
} from 'lucide-react';

import { Link, useNavigate } from 'react-router-dom';
import './Dashboard.css';
import '../manager/ManagerDashboard.css';
import { TaskDailyReminderModal } from '../../components/TaskDailyReminderModal';
import type { DailyReminderTask } from '../../components/TaskDailyReminderModal';
import { TaskWorkspaceModal } from '../../components/TaskWorkspaceModal';


const EmployeeDashboard = () => {
  const { employee, user } = useContext(AuthContext);
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

  // Team Leader Summary & Stats State
  const isTeamLeader = Boolean(
    employee?.assigned_team_members?.length > 0 ||
    employee?.role === 'TEAM_LEADER' ||
    employee?.user?.role === 'TEAM_LEADER' ||
    employee?.designation?.toLowerCase().includes('team leader')
  );
  const [tlSummary, setTlSummary] = useState<any>(null);
  const [tlPendingCounts, setTlPendingCounts] = useState<{ leaves: number; permissions: number; wfh: number }>({
    leaves: 0,
    permissions: 0,
    wfh: 0,
  });

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

      const [todayRes, historyRes, tasksRes, tlSummaryRes, reminderRes] = await Promise.allSettled([
        api.get('/attendance/today/'),
        getHistory(1),
        api.get('/tasks-module/tasks/'),
        api.get('/employees/manager/dashboard-summary/'),
        api.get('/attendance/pending-actions-reminder/').catch(() => ({ data: {} })),
      ]);

      if (tlSummaryRes.status === 'fulfilled' && tlSummaryRes.value?.data) {
        setTlSummary(tlSummaryRes.value.data);
      }

      if (reminderRes.status === 'fulfilled' && reminderRes.value?.data?.summary) {
        setTlPendingCounts({
          leaves: reminderRes.value.data.summary.pending_leaves || 0,
          permissions: reminderRes.value.data.summary.pending_permissions || 0,
          wfh: reminderRes.value.data.summary.pending_wfh || 0,
        });
      }

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

  const currentActionLocationRef = useRef<LocationData | null>(null);

  const handleAction = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    setActionType(type);
    setShowCamera(true);
    setLocationStatus('Getting location...');

    try {
      const location = await getLocation();
      currentActionLocationRef.current = location;
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
      // Always get fresh GPS location during capture if possible
      let locationData = currentActionLocationRef.current;
      try {
        locationData = await getLocation();
        currentActionLocationRef.current = locationData;
      } catch (locErr) {
        if (!locationData) throw locErr;
      }

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
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
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

      {isTeamLeader ? (
        <div className="mgr-dashboard-page" style={{ marginBottom: '1.8rem' }}>
          {/* 1. HERO BANNER */}
          <div className="mgr-hero-banner">
            <div className="mgr-hero-left">
              <div className="mgr-hero-icon">
                <Building size={28} />
              </div>
              <div>
                <div className="mgr-hero-company">
                  <span>{companyName || user?.company_name || 'Yaazh 360'}</span>
                  <span className="mgr-hero-badge">
                    <Shield size={12} /> Team Leader
                  </span>
                </div>
                <div className="mgr-hero-sub">
                  <span>Team Leader: <strong>{employeeName}</strong></span>
                  <span>&bull;</span>
                  <span>Username: <code>{user?.username || employee?.employee_id}</code></span>
                  <span>&bull;</span>
                  <span>Team Size: <strong>{employee?.assigned_team_members?.length ?? tlSummary?.total_employees ?? 0} members</strong></span>
                </div>
              </div>
            </div>

            <div className="mgr-hero-actions">
              <button
                type="button"
                className="mgr-hero-btn mgr-hero-btn-primary"
                onClick={() => setActiveWorkspaceTaskId(-1)}
              >
                <Plus size={16} /> Assign Task
              </button>
              <Link to="/team-attendance" className="mgr-hero-btn mgr-hero-btn-outline">
                <Users size={16} /> Manage Team
              </Link>
              <button
                type="button"
                className="mgr-hero-btn mgr-hero-btn-outline"
                onClick={() => fetchDashboardData()}
              >
                <RefreshCw size={16} /> Refresh
              </button>
            </div>
          </div>

          {/* 2. QUICK ACTIONS HUB */}
          <div className="mgr-quick-hub">
            {/* SECTION A: TEAM CONTROLS & APPROVALS */}
            <div className="mgr-hub-header">
              <div className="mgr-hub-title">
                <Zap size={18} color="#22c55e" />
                <span>Team Approvals & Task Assignment</span>
                <span className="mgr-hub-badge">Team Leader Controls</span>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Review team requests & delegate tasks
              </span>
            </div>

            <div className="mgr-hub-grid" style={{ marginBottom: '18px' }}>
              {/* Quick Action: Assign Task */}
              <div
                className="mgr-hub-action-card"
                onClick={() => setActiveWorkspaceTaskId(-1)}
                style={{ borderLeft: '4px solid #3b82f6', cursor: 'pointer' }}
              >
                <div className="mgr-hub-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <Plus size={20} strokeWidth={2.5} />
                </div>
                <div className="mgr-hub-info">
                  <span className="mgr-hub-action-label">Assign New Task</span>
                  <span className="mgr-hub-action-desc">Delegate task to team members</span>
                </div>
                <ArrowRight size={16} color="#94a3b8" />
              </div>

              {/* Quick Action: Leave Approvals */}
              <Link
                to="/team-leaves"
                className="mgr-hub-action-card"
                style={{ borderLeft: '4px solid #ea580c' }}
              >
                <div className="mgr-hub-icon-wrap" style={{ background: '#fff7ed', color: '#ea580c' }}>
                  <Calendar size={20} />
                </div>
                <div className="mgr-hub-info">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="mgr-hub-action-label">Approve Leaves</span>
                    {tlPendingCounts.leaves > 0 && (
                      <span className="mgr-hub-counter" style={{ background: '#ffedd5', color: '#c2410c' }}>
                        {tlPendingCounts.leaves}
                      </span>
                    )}
                  </div>
                  <span className="mgr-hub-action-desc">Review pending leave applications</span>
                </div>
                <ArrowRight size={16} color="#94a3b8" />
              </Link>

              {/* Quick Action: Permission Approvals */}
              <Link
                to="/team-permissions"
                className="mgr-hub-action-card"
                style={{ borderLeft: '4px solid #2563eb' }}
              >
                <div className="mgr-hub-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <Clock size={20} />
                </div>
                <div className="mgr-hub-info">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="mgr-hub-action-label">Approve Permissions</span>
                    {tlPendingCounts.permissions > 0 && (
                      <span className="mgr-hub-counter" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                        {tlPendingCounts.permissions}
                      </span>
                    )}
                  </div>
                  <span className="mgr-hub-action-desc">Short time & early exits</span>
                </div>
                <ArrowRight size={16} color="#94a3b8" />
              </Link>

              {/* Quick Action: WFH Approvals */}
              <Link
                to="/team-wfh"
                className="mgr-hub-action-card"
                style={{ borderLeft: '4px solid #7c3aed' }}
              >
                <div className="mgr-hub-icon-wrap" style={{ background: '#faf5ff', color: '#7c3aed' }}>
                  <Building2 size={20} />
                </div>
                <div className="mgr-hub-info">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="mgr-hub-action-label">Approve WFH</span>
                    {tlPendingCounts.wfh > 0 && (
                      <span className="mgr-hub-counter" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
                        {tlPendingCounts.wfh}
                      </span>
                    )}
                  </div>
                  <span className="mgr-hub-action-desc">Work from home requests</span>
                </div>
                <ArrowRight size={16} color="#94a3b8" />
              </Link>
            </div>

            {/* SECTION B: TEAM LEADER PERSONAL REQUEST QUICK LINKS */}
            <div className="mgr-hub-header" style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <div className="mgr-hub-title">
                <Users size={18} color="#059669" />
                <span>My Personal Requests & Passes</span>
                <span className="mgr-hub-badge" style={{ background: '#ecfdf5', color: '#047857' }}>Self Service</span>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Quick links for your own leave, permission, WFH and punch records
              </span>
            </div>

            <div className="mgr-hub-grid">
              {/* Quick Link: Apply Leave */}
              <Link
                to="/leave"
                className="mgr-hub-action-card"
                style={{ borderLeft: '4px solid #f97316' }}
              >
                <div className="mgr-hub-icon-wrap" style={{ background: '#fff7ed', color: '#ea580c' }}>
                  <CalendarPlus size={20} />
                </div>
                <div className="mgr-hub-info">
                  <span className="mgr-hub-action-label">Apply Leave</span>
                  <span className="mgr-hub-action-desc">Casual, sick or annual leave</span>
                </div>
                <ArrowRight size={16} color="#94a3b8" />
              </Link>

              {/* Quick Link: Apply Permission */}
              <Link
                to="/permission"
                className="mgr-hub-action-card"
                style={{ borderLeft: '4px solid #8b5cf6' }}
              >
                <div className="mgr-hub-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                  <ClockPlus size={20} />
                </div>
                <div className="mgr-hub-info">
                  <span className="mgr-hub-action-label">Apply Permission</span>
                  <span className="mgr-hub-action-desc">30 / 60 mins emergency exit</span>
                </div>
                <ArrowRight size={16} color="#94a3b8" />
              </Link>

              {/* Quick Link: Apply WFH */}
              <Link
                to="/wfh"
                className="mgr-hub-action-card"
                style={{ borderLeft: '4px solid #0d9488' }}
              >
                <div className="mgr-hub-icon-wrap" style={{ background: '#f0fdfa', color: '#0d9488' }}>
                  <Home size={20} />
                </div>
                <div className="mgr-hub-info">
                  <span className="mgr-hub-action-label">Apply WFH</span>
                  <span className="mgr-hub-action-desc">Request work from home day</span>
                </div>
                <ArrowRight size={16} color="#94a3b8" />
              </Link>

              {/* Quick Link: My Punch History */}
              <Link
                to="/attendance"
                className="mgr-hub-action-card"
                style={{ borderLeft: '4px solid #0284c7' }}
              >
                <div className="mgr-hub-icon-wrap" style={{ background: '#f0f9ff', color: '#0284c7' }}>
                  <CalendarCheck size={20} />
                </div>
                <div className="mgr-hub-info">
                  <span className="mgr-hub-action-label">My Punch History</span>
                  <span className="mgr-hub-action-desc">View monthly personal logs</span>
                </div>
                <ArrowRight size={16} color="#94a3b8" />
              </Link>
            </div>
          </div>

          {/* 3. TEAM LEADER PERSONAL ATTENDANCE CARD */}
          <div className="mgr-self-punch-card" style={{ marginTop: '1.25rem' }}>
            <div className="mgr-self-punch-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Clock size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    My Attendance & Self Punch
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Mark your daily personal check-in / check-out with GPS & photo
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Link
                  to="/attendance"
                  style={{
                    textDecoration: 'none',
                    color: '#2563eb',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: '#eff6ff',
                  }}
                >
                  <CalendarCheck size={13} /> View Attendance Log
                </Link>
              </div>
            </div>

            <div className="mgr-punch-status-grid">
              <div className="mgr-punch-stat-box">
                <span className="mgr-punch-stat-label">PUNCH IN STATUS</span>
                <div className="mgr-punch-stat-value" style={{ color: todayData?.check_in_time ? '#059669' : '#64748b' }}>
                  {todayData?.check_in_time ? (
                    formatTime(todayData.check_in_time)
                  ) : (
                    'Not Punched In'
                  )}
                </div>
              </div>

              <div className="mgr-punch-stat-box">
                <span className="mgr-punch-stat-label">PUNCH OUT STATUS</span>
                <div className="mgr-punch-stat-value" style={{ color: todayData?.check_out_time ? '#0284c7' : '#64748b' }}>
                  {todayData?.check_out_time ? (
                    formatTime(todayData.check_out_time)
                  ) : (
                    'Not Punched Out'
                  )}
                </div>
              </div>

              <div className="mgr-punch-stat-box">
                <span className="mgr-punch-stat-label">TODAY'S DURATION</span>
                <div className="mgr-punch-stat-value" style={{ color: '#0f172a' }}>
                  {todayData?.working_hours || (todayData?.check_in_time && !todayData?.check_out_time ? 'In Progress' : '00:00 hrs')}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleAction('CHECK_IN')}
                  disabled={Boolean(todayData?.check_in_time) || loadingAction}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: Boolean(todayData?.check_in_time) || loadingAction ? 'not-allowed' : 'pointer',
                    background: Boolean(todayData?.check_in_time) ? '#f1f5f9' : '#059669',
                    color: Boolean(todayData?.check_in_time) ? '#94a3b8' : '#ffffff',
                    border: 'none',
                    boxShadow: Boolean(todayData?.check_in_time) ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.3)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <LogIn size={16} /> Check In
                </button>

                <button
                  type="button"
                  onClick={() => handleAction('CHECK_OUT')}
                  disabled={!todayData?.check_in_time || Boolean(todayData?.check_out_time) || loadingAction}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: !todayData?.check_in_time || Boolean(todayData?.check_out_time) || loadingAction ? 'not-allowed' : 'pointer',
                    background: !todayData?.check_in_time || Boolean(todayData?.check_out_time) ? '#f1f5f9' : '#2563eb',
                    color: !todayData?.check_in_time || Boolean(todayData?.check_out_time) ? '#94a3b8' : '#ffffff',
                    border: 'none',
                    boxShadow: !todayData?.check_in_time || Boolean(todayData?.check_out_time) ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.3)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <LogOut size={16} /> Check Out
                </button>
              </div>
            </div>
          </div>

          {/* 4. TEAM METRICS STATS CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem', marginTop: '1.25rem' }}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #10b981',
                borderRadius: '12px',
                padding: '0.9rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
              onClick={() => navigate('/team-attendance')}
            >
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCheck size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Present Today</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{tlSummary?.present_today ?? 0}</span>
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #f59e0b',
                borderRadius: '12px',
                padding: '0.9rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
              onClick={() => navigate('/team-attendance')}
            >
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Late Today</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>{tlSummary?.late_today ?? 0}</span>
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #ef4444',
                borderRadius: '12px',
                padding: '0.9rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
              onClick={() => navigate('/team-attendance')}
            >
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserX size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Absent Today</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>{tlSummary?.absent_today ?? 0}</span>
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #8b5cf6',
                borderRadius: '12px',
                padding: '0.9rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
              onClick={() => navigate('/team-leaves')}
            >
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Palmtree size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>On Leave</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c3aed' }}>{tlSummary?.on_leave_today ?? 0}</span>
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #3b82f6',
                borderRadius: '12px',
                padding: '0.9rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
              onClick={() => navigate('/tasks')}
            >
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ListTodo size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Tasks</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb' }}>{assignedTasks.length}</span>
              </div>
            </div>
          </div>

          {/* 5. ASSIGNED TEAM MEMBERS LIST */}
          {employee?.assigned_team_members && employee.assigned_team_members.length > 0 && (
            <div style={{
              marginTop: '1.25rem',
              padding: '1.15rem 1.25rem',
              borderRadius: '14px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                    <Users size={17} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                    My Assigned Team Members ({employee.assigned_team_members.length})
                  </h3>
                </div>
                <Link
                  to="/team-attendance"
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#059669',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  View Live Attendance <ArrowRight size={13} />
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                {employee.assigned_team_members.map((tm: any) => (
                  <div key={tm.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.9rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    {tm.profile_photo ? (
                      <img src={tm.profile_photo} alt={tm.full_name} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.88rem' }}>
                        {tm.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tm.full_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: '4px', fontSize: '0.72rem' }}>{tm.employee_id}</code> • {tm.designation || tm.department || 'Member'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
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

            {/* TEAM LEADER BADGE FOR EMPLOYEE */}
            {employee?.team_leader_details && (
              <div style={{
                marginTop: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                padding: '0.45rem 0.9rem',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                color: '#166534',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}>
                <Shield size={15} color="#16a34a" />
                <span>Team Leader:</span>
                <strong style={{ color: '#14532d' }}>{employee.team_leader_details.full_name}</strong>
                <span style={{ color: '#15803d', fontSize: '0.78rem' }}>({employee.team_leader_details.employee_id})</span>
                {employee.team_leader_details.designation && (
                  <span style={{ color: '#166534', fontSize: '0.75rem', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                    {employee.team_leader_details.designation}
                  </span>
                )}
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

        {/* TEAM LEADER'S ASSIGNED MEMBERS PANEL */}
        {employee?.assigned_team_members && employee.assigned_team_members.length > 0 && (
          <div style={{
            marginTop: '1.25rem',
            padding: '1rem 1.25rem',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <Users size={16} />
                </div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  My Team Members ({employee.assigned_team_members.length})
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                Team Leader
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.65rem' }}>
              {employee.assigned_team_members.map((tm: any) => (
                <div key={tm.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 0.75rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  {tm.profile_photo ? (
                    <img src={tm.profile_photo} alt={tm.full_name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                      {tm.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tm.full_name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: '4px', fontSize: '0.72rem' }}>{tm.employee_id}</code> • {tm.designation || tm.department || 'Member'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
        </>
      )}

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




