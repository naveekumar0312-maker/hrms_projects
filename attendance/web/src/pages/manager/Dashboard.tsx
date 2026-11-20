import React, { useState, useEffect, useContext } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  Calendar,
  RefreshCw,
  ArrowRight,
  Building,
  Building2,
  Shield,
  Award,
  User,
  X,
  Search,
  ExternalLink,
  LogIn,
  LogOut,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  Plus,
  Zap,
  CalendarPlus,
  ClockPlus,
  Home,
} from 'lucide-react';
import { TaskWorkspaceModal } from '../../components/TaskWorkspaceModal';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { CustomDatePicker } from '../../components/CustomDatePicker';
import CameraCapture from '../../components/CameraCapture';
import { useLocation } from '../../hooks/useLocation';
import type { LocationData } from '../../hooks/useLocation';
import { checkIn, checkOut } from '../../api/attendance';
import './ManagerDashboard.css';
import '../ReportingManagers.css';

interface DashboardSummary {
  date: string;
  manager_name: string;
  company_name: string;
  designation: string;
  total_employees: number;
  total_team_leaders: number;
  direct_employees: number;
  present_today: number;
  late_today: number;
  absent_today: number;
  on_leave_today: number;
  holiday_today: number;
  pending_approvals: number;
}

interface TeamMember {
  id: number;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  profile_photo: string | null;
  status: boolean;
  account_status: string;
}

interface AttendanceDetailItem {
  employee_id: number;
  employee_code: string;
  full_name: string;
  department: string;
  designation: string;
  branch_name?: string;
  company_name?: string;
  profile_photo: string | null;
  calculated_status: string;
  status_reason: string;
  check_in: string | null;
  check_out: string | null;
  working_hours?: string | null;
  late_minutes?: number;
}

const ManagerDashboard: React.FC = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [pendingStats, setPendingStats] = useState<{
    pending_leaves: number;
    pending_permissions: number;
    pending_wfh: number;
  }>({ pending_leaves: 0, pending_permissions: 0, pending_wfh: 0 });
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Manager Self Attendance State
  const { getLocation } = useLocation();
  const [myAttendance, setMyAttendance] = useState<any>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [actionType, setActionType] = useState<'CHECK_IN' | 'CHECK_OUT' | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [pendingLocation, setPendingLocation] = useState<LocationData | null>(null);
  const [punchMsg, setPunchMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchMyAttendance = async () => {
    try {
      const res = await api.get('/attendance/today/');
      setMyAttendance(res.data);
    } catch (err) {
      console.error('Failed to fetch manager personal attendance:', err);
    }
  };

  const handleStartPunch = (type: 'CHECK_IN' | 'CHECK_OUT') => {
    setActionType(type);
    setShowCamera(true);
    setPunchMsg(null);
  };

  const handleCameraCapture = async (photoUri: string) => {
    setShowCamera(false);
    if (!actionType) return;

    setLoadingAction(true);
    try {
      const loc = await getLocation();
      if (actionType === 'CHECK_IN') {
        await checkIn(loc, photoUri);
        setPunchMsg({ type: 'success', text: 'Punch In successful!' });
      } else {
        await checkOut(loc, photoUri);
        setPunchMsg({ type: 'success', text: 'Punch Out successful!' });
      }
      await fetchMyAttendance();
    } catch (err: any) {
      const resData = err?.response?.data;
      if (resData?.code === 'LATE_REASON_REQUIRED') {
        setPendingPhoto(photoUri);
        try {
          const loc = await getLocation();
          setPendingLocation(loc);
        } catch {}
        setShowLateModal(true);
      } else {
        const msg = resData?.detail || resData?.error || err?.message || 'Attendance submission failed.';
        setPunchMsg({ type: 'error', text: String(msg) });
      }
    } finally {
      setLoadingAction(false);
      setActionType(null);
    }
  };

  const submitLateCheckIn = async () => {
    if (!lateReason.trim()) {
      alert('Please enter a reason for late check-in.');
      return;
    }
    if (!pendingPhoto) {
      alert('Photo expired. Please capture your photo again.');
      setShowLateModal(false);
      return;
    }
    setLoadingAction(true);
    try {
      const loc = pendingLocation || (await getLocation());
      await checkIn(loc, pendingPhoto, lateReason.trim());
      setShowLateModal(false);
      setLateReason('');
      setPendingPhoto(null);
      setPunchMsg({ type: 'success', text: 'Punch In recorded with reason!' });
      await fetchMyAttendance();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'Check-in failed.';
      setPunchMsg({ type: 'error', text: String(msg) });
    } finally {
      setLoadingAction(false);
    }
  };

  // Quick Task Creation Modal state
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);

  // Attendance drill-down modal state
  const [activeStatusModal, setActiveStatusModal] = useState<string | null>(null);
  const [statusModalTitle, setStatusModalTitle] = useState('');
  const [statusModalItems, setStatusModalItems] = useState<AttendanceDetailItem[]>([]);
  const [statusModalLoading, setStatusModalLoading] = useState(false);
  const [statusModalSearch, setStatusModalSearch] = useState('');

  const handleOpenAttendanceReport = async (statusKey: string, title: string) => {
    setActiveStatusModal(statusKey);
    setStatusModalTitle(title);
    setStatusModalSearch('');
    setStatusModalLoading(true);
    try {
      const res = await api.get('/employees/manager/team-attendance/', {
        params: { status: statusKey, date: selectedDate }
      });
      setStatusModalItems(res.data.team_attendance || []);
    } catch (err) {
      console.error('Failed to load status drilldown:', err);
      setStatusModalItems([]);
    } finally {
      setStatusModalLoading(false);
    }
  };

  const loadDashboardData = async (targetDate?: string) => {
    const dateToQuery = targetDate || selectedDate;
    try {
      setLoading(true);
      setError('');
      const [sumRes, teamRes, reminderRes] = await Promise.all([
        api.get('/employees/manager/dashboard-summary/', {
          params: { date: dateToQuery }
        }),
        api.get('/employees/manager/team/'),
        api.get('/attendance/pending-actions-reminder/').catch(() => ({ data: {} })),
      ]);
      setSummary(sumRes.data);
      setTeam(teamRes.data);
      if (reminderRes.data && reminderRes.data.summary) {
        setPendingStats({
          pending_leaves: reminderRes.data.summary.pending_leaves || 0,
          pending_permissions: reminderRes.data.summary.pending_permissions || 0,
          pending_wfh: reminderRes.data.summary.pending_wfh || 0,
        });
      }
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setError('Unable to load team metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData(selectedDate);
    fetchMyAttendance();
  }, [selectedDate]);

  const filteredStatusModalItems = statusModalItems.filter((item) => {
    // 1. Strict status matching to ensure zero leakage from any un-filtered data
    if (activeStatusModal) {
      const recStatus = (item.calculated_status || '').toUpperCase();
      if (activeStatusModal === 'PRESENT_TODAY' && recStatus !== 'PRESENT') {
        return false;
      }
      if (activeStatusModal === 'LATE_TODAY' && recStatus !== 'LATE') {
        return false;
      }
      if (activeStatusModal === 'ABSENT_TODAY' && recStatus !== 'ABSENT') {
        return false;
      }
      if (
        activeStatusModal === 'ON_LEAVE_TODAY' &&
        !['ON_LEAVE', 'ON LEAVE', 'HALF DAY', 'HALF_DAY'].includes(recStatus)
      ) {
        return false;
      }
    }

    // 2. Search query filter
    if (!statusModalSearch.trim()) return true;
    const q = statusModalSearch.toLowerCase();
    return (
      item.full_name.toLowerCase().includes(q) ||
      item.employee_code.toLowerCase().includes(q) ||
      (item.department && item.department.toLowerCase().includes(q)) ||
      (item.branch_name && item.branch_name.toLowerCase().includes(q))
    );
  });

  const employeeCards = [
    {
      title: 'Total Employees',
      value: summary?.total_employees ?? 0,
      icon: Users,
      color: '#3b82f6',
      bg: '#eff6ff',
    },
    {
      title: 'Team Leaders',
      value: summary?.total_team_leaders ?? 0,
      icon: Award,
      color: '#1d4ed8',
      bg: '#dbeafe',
    },
  ];

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const attendanceCards = [
    {
      title: isToday ? 'Present Today' : 'Present',
      statusKey: 'PRESENT_TODAY',
      value: summary?.present_today ?? 0,
      icon: UserCheck,
      color: '#15803d',
      bg: '#f0fdf4',
      border: '#bbf7d0',
    },
    {
      title: isToday ? 'Late Today' : 'Late',
      statusKey: 'LATE_TODAY',
      value: summary?.late_today ?? 0,
      icon: Clock,
      color: '#b45309',
      bg: '#fffbeb',
      border: '#fde68a',
    },
    {
      title: isToday ? 'Absent Today' : 'Absent',
      statusKey: 'ABSENT_TODAY',
      value: summary?.absent_today ?? 0,
      icon: UserX,
      color: '#b91c1c',
      bg: '#fef2f2',
      border: '#fecaca',
    },
    {
      title: isToday ? 'On Leave Today' : 'On Leave',
      statusKey: 'ON_LEAVE_TODAY',
      value: summary?.on_leave_today ?? 0,
      icon: Calendar,
      color: '#7e22ce',
      bg: '#f5f3ff',
      border: '#e9d5ff',
    },
  ];

  return (
    <div className="mgr-dashboard-page">
      {/* 1. HERO BANNER */}
      <div className="mgr-hero-banner">
        <div className="mgr-hero-left">
          <div className="mgr-hero-icon">
            <Building size={28} />
          </div>
          <div>
            <div className="mgr-hero-company">
              <span>{summary?.company_name || user?.company_name || 'Yaazh 360'}</span>
              <span className="mgr-hero-badge">
                <Shield size={12} /> Reporting Manager
              </span>
            </div>
            <div className="mgr-hero-sub">
              <span>Manager: <strong>{summary?.manager_name || user?.username}</strong></span>
              <span>&bull;</span>
              <span>Username: <code>{user?.username}</code></span>
              <span>&bull;</span>
              <span>Team Size: <strong>{summary?.total_employees ?? 0} members</strong></span>
            </div>
          </div>
        </div>

        <div className="mgr-hero-actions">
          <button
            type="button"
            className="mgr-hero-btn mgr-hero-btn-primary"
            onClick={() => setShowQuickTaskModal(true)}
          >
            <Plus size={16} /> Assign Task
          </button>
          <Link to="/manager/team" className="mgr-hero-btn mgr-hero-btn-outline">
            <Users size={16} /> Manage Team
          </Link>
          <button
            type="button"
            className="mgr-hero-btn mgr-hero-btn-outline"
            onClick={() => loadDashboardData()}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {punchMsg && (
        <div style={{
          background: punchMsg.type === 'success' ? '#f0fdf4' : '#fee2e2',
          color: punchMsg.type === 'success' ? '#166534' : '#991b1b',
          border: `1px solid ${punchMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          padding: '12px 18px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '14px',
        }}>
          {punchMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{punchMsg.text}</span>
        </div>
      )}

      {/* 2. QUICK ACTIONS HUB */}
      <div className="mgr-quick-hub">
        {/* SECTION A: TEAM CONTROLS & APPROVALS */}
        <div className="mgr-hub-header">
          <div className="mgr-hub-title">
            <Zap size={18} color="#22c55e" />
            <span>Team Approvals & Task Assignment</span>
            <span className="mgr-hub-badge">Manager Controls</span>
          </div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Review team requests & delegate tasks
          </span>
        </div>

        <div className="mgr-hub-grid" style={{ marginBottom: '18px' }}>
          {/* Quick Action: Assign Task */}
          <div
            className="mgr-hub-action-card"
            onClick={() => setShowQuickTaskModal(true)}
            style={{ borderLeft: '4px solid #3b82f6' }}
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
            to="/manager/leaves"
            className="mgr-hub-action-card"
            style={{ borderLeft: '4px solid #ea580c' }}
          >
            <div className="mgr-hub-icon-wrap" style={{ background: '#fff7ed', color: '#ea580c' }}>
              <Calendar size={20} />
            </div>
            <div className="mgr-hub-info">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="mgr-hub-action-label">Approve Leaves</span>
                {pendingStats.pending_leaves > 0 && (
                  <span className="mgr-hub-counter" style={{ background: '#ffedd5', color: '#c2410c' }}>
                    {pendingStats.pending_leaves}
                  </span>
                )}
              </div>
              <span className="mgr-hub-action-desc">Review pending leave applications</span>
            </div>
            <ArrowRight size={16} color="#94a3b8" />
          </Link>

          {/* Quick Action: Permission Approvals */}
          <Link
            to="/manager/permissions"
            className="mgr-hub-action-card"
            style={{ borderLeft: '4px solid #2563eb' }}
          >
            <div className="mgr-hub-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Clock size={20} />
            </div>
            <div className="mgr-hub-info">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="mgr-hub-action-label">Approve Permissions</span>
                {pendingStats.pending_permissions > 0 && (
                  <span className="mgr-hub-counter" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                    {pendingStats.pending_permissions}
                  </span>
                )}
              </div>
              <span className="mgr-hub-action-desc">Short time & early exits</span>
            </div>
            <ArrowRight size={16} color="#94a3b8" />
          </Link>

          {/* Quick Action: WFH Approvals */}
          <Link
            to="/manager/wfh"
            className="mgr-hub-action-card"
            style={{ borderLeft: '4px solid #7c3aed' }}
          >
            <div className="mgr-hub-icon-wrap" style={{ background: '#faf5ff', color: '#7c3aed' }}>
              <Building2 size={20} />
            </div>
            <div className="mgr-hub-info">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="mgr-hub-action-label">Approve WFH</span>
                {pendingStats.pending_wfh > 0 && (
                  <span className="mgr-hub-counter" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
                    {pendingStats.pending_wfh}
                  </span>
                )}
              </div>
              <span className="mgr-hub-action-desc">Work from home requests</span>
            </div>
            <ArrowRight size={16} color="#94a3b8" />
          </Link>
        </div>

        {/* SECTION B: MANAGER PERSONAL REQUEST QUICK LINKS */}
        <div className="mgr-hub-header" style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
          <div className="mgr-hub-title">
            <User size={18} color="#059669" />
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
            to="/manager/my-leaves"
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
            to="/manager/my-permissions"
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
            to="/manager/my-wfh"
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
            to="/manager/my-attendance"
            className="mgr-hub-action-card"
            style={{ borderLeft: '4px solid #0284c7' }}
          >
            <div className="mgr-hub-icon-wrap" style={{ background: '#f0f9ff', color: '#0284c7' }}>
              <CalendarDays size={20} />
            </div>
            <div className="mgr-hub-info">
              <span className="mgr-hub-action-label">My Punch History</span>
              <span className="mgr-hub-action-desc">View monthly personal logs</span>
            </div>
            <ArrowRight size={16} color="#94a3b8" />
          </Link>
        </div>
      </div>

      {/* 3. MANAGER PERSONAL ATTENDANCE CARD */}
      <div className="mgr-self-punch-card">
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
              to="/manager/my-attendance"
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
              <CalendarDays size={13} /> View Attendance Log
            </Link>
          </div>
        </div>

        <div className="mgr-punch-status-grid">
          <div className="mgr-punch-stat-box">
            <div className="mgr-punch-stat-label">Punch In Status</div>
            <div className="mgr-punch-stat-value">
              {myAttendance?.check_in_time ? (
                <span style={{ color: '#16a34a' }}>
                  {new Date(myAttendance.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : (
                <span style={{ color: '#94a3b8' }}>Not Punched In</span>
              )}
            </div>
          </div>

          <div className="mgr-punch-stat-box">
            <div className="mgr-punch-stat-label">Punch Out Status</div>
            <div className="mgr-punch-stat-value">
              {myAttendance?.check_out_time ? (
                <span style={{ color: '#2563eb' }}>
                  {new Date(myAttendance.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : (
                <span style={{ color: '#94a3b8' }}>Not Punched Out</span>
              )}
            </div>
          </div>

          <div className="mgr-punch-stat-box">
            <div className="mgr-punch-stat-label">Today's Duration</div>
            <div className="mgr-punch-stat-value">
              {myAttendance?.working_hours || '00:00'} hrs
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleStartPunch('CHECK_IN')}
              disabled={Boolean(myAttendance?.check_in_time) || loadingAction}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 20px',
                borderRadius: '10px',
                border: 'none',
                background: myAttendance?.check_in_time ? '#e2e8f0' : '#16a34a',
                color: myAttendance?.check_in_time ? '#94a3b8' : '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: myAttendance?.check_in_time ? 'not-allowed' : 'pointer',
                boxShadow: myAttendance?.check_in_time ? 'none' : '0 2px 6px rgba(22, 163, 74, 0.25)',
              }}
            >
              <LogIn size={16} />
              <span>Check In</span>
            </button>

            <button
              type="button"
              onClick={() => handleStartPunch('CHECK_OUT')}
              disabled={!myAttendance?.check_in_time || Boolean(myAttendance?.check_out_time) || loadingAction}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 20px',
                borderRadius: '10px',
                border: 'none',
                background: (!myAttendance?.check_in_time || myAttendance?.check_out_time) ? '#e2e8f0' : '#dc2626',
                color: (!myAttendance?.check_in_time || myAttendance?.check_out_time) ? '#94a3b8' : '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: (!myAttendance?.check_in_time || myAttendance?.check_out_time) ? 'not-allowed' : 'pointer',
                boxShadow: (!myAttendance?.check_in_time || myAttendance?.check_out_time) ? 'none' : '0 2px 6px rgba(220, 38, 38, 0.25)',
              }}
            >
              <LogOut size={16} />
              <span>Check Out</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '12px', marginBottom: '8px' }}>
          {error}
        </div>
      )}

      {/* 4. SECTION: TEAM SCOPE OVERVIEW */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
          Organization & Team Structure
        </h3>
        <Link to="/manager/team" className="mgr-link-btn">
          View Organization <ArrowRight size={14} />
        </Link>
      </div>
      <div className="mgr-cards-grid">
        {employeeCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="mgr-stat-card">
              <div className="mgr-stat-icon" style={{ background: c.bg, color: c.color }}>
                <Icon size={22} />
              </div>
              <div className="mgr-stat-content">
                <span className="mgr-stat-label">{c.title}</span>
                <span className="mgr-stat-value">{loading ? '--' : c.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. SECTION: TEAM ATTENDANCE (DRILL-DOWN ENABLED) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            Team Attendance Live Status
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
            Click any attendance card to view individual employees for {selectedDate}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ minWidth: '160px' }}>
            <CustomDatePicker
              value={selectedDate}
              onChange={(newDate: string) => {
                setSelectedDate(newDate);
                loadDashboardData(newDate);
              }}
              placeholder="Select Date"
            />
          </div>
          <Link
            to={`/manager/attendance?date=${selectedDate}`}
            className="mgr-link-btn"
            style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#22C55E', textDecoration: 'none', fontWeight: 600 }}
          >
            Full Attendance Sheet <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="mgr-cards-grid">
        {attendanceCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              className="mgr-stat-card mgr-stat-card-clickable"
              onClick={() => handleOpenAttendanceReport(c.statusKey, c.title)}
              title={`Click to view ${c.title} employee report`}
              style={{
                cursor: 'pointer',
                borderColor: c.border,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
              }}
            >
              <div className="mgr-stat-icon" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                <Icon size={22} />
              </div>
              <div className="mgr-stat-content" style={{ flex: 1 }}>
                <span className="mgr-stat-label">{c.title}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span className="mgr-stat-value" style={{ color: c.color }}>
                    {loading ? '--' : c.value}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 500 }}>
                    View List <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6. ASSIGNED TEAM MEMBERS TABLE PREVIEW */}
      <div className="mgr-section-card" style={{ marginTop: '10px' }}>
        <div className="mgr-section-header">
          <div>
            <h2>My Assigned Team Members</h2>
            <p>Employees currently active in your reporting hierarchy.</p>
          </div>
          <Link to="/manager/team" className="mgr-link-btn">
            View All Team ({team.length}) <ArrowRight size={16} />
          </Link>
        </div>

        {team.length === 0 ? (
          <div className="mgr-empty-preview">
            <Users size={36} color="#94a3b8" />
            <p>No employees are currently assigned to your team.</p>
          </div>
        ) : (
          <div className="mgr-table-responsive">
            <table className="mgr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>ID Code</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {team.slice(0, 5).map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="rm-profile-cell">
                        {m.profile_photo ? (
                          <img src={m.profile_photo} alt={m.full_name} className="rm-avatar" />
                        ) : (
                          <div className="rm-avatar" style={{ background: '#eff6ff', color: '#2563eb' }}>
                            <User size={18} strokeWidth={2.2} />
                          </div>
                        )}
                        <span className="mgr-emp-name" style={{ fontWeight: 600, color: '#0f172a' }}>{m.full_name}</span>
                      </div>
                    </td>
                    <td><code>{m.employee_id}</code></td>
                    <td>{m.department || 'General'}</td>
                    <td>{m.designation}</td>
                    <td>
                      <span className={`rm-badge ${m.status ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                        {m.status ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Late Check-in Reason Modal */}
      {showLateModal && (
        <div className="rm-modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="rm-modal" style={{ maxWidth: '440px', width: '90%' }}>
            <div className="rm-modal-header">
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#b45309' }}>
                Late Check-In Reason Required
              </h2>
              <button
                type="button"
                className="rm-modal-close"
                onClick={() => {
                  setShowLateModal(false);
                  setPendingPhoto(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="rm-modal-body" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: 0 }}>
                You are checking in past the shift start time. Please provide a brief reason:
              </p>
              <textarea
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                rows={3}
                placeholder="E.g., Client meeting delayed, Traffic delay..."
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  padding: '10px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
            <div className="rm-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}>
              <button
                type="button"
                className="rm-btn rm-btn-secondary"
                onClick={() => {
                  setShowLateModal(false);
                  setPendingPhoto(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rm-btn rm-btn-primary"
                onClick={submitLateCheckIn}
                disabled={loadingAction}
              >
                {loadingAction ? 'Submitting...' : 'Submit & Check In'}
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Quick Task Workspace Modal */}
      {showQuickTaskModal && (
        <TaskWorkspaceModal
          taskId={null}
          initialMode="edit"
          onClose={() => setShowQuickTaskModal(false)}
          onSaved={() => {
            setShowQuickTaskModal(false);
            loadDashboardData();
          }}
        />
      )}

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onCancel={() => {
            setShowCamera(false);
            setActionType(null);
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* ATTENDANCE DRILL-DOWN MODAL                                          */}
      {/* ==================================================================== */}
      {activeStatusModal && (
        <div className="rm-modal-backdrop" onClick={() => setActiveStatusModal(null)}>
          <div className="rm-modal" style={{ maxWidth: '780px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{statusModalTitle}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: '#f1f5f9', color: '#475569' }}>
                    {filteredStatusModalItems.length} {filteredStatusModalItems.length === 1 ? 'Employee' : 'Employees'}
                  </span>
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Showing team members with status for {selectedDate}
                </p>
              </div>
              <button
                type="button"
                className="rm-close-btn"
                onClick={() => setActiveStatusModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="rm-modal-body" style={{ padding: '16px 20px', maxHeight: '65vh', overflowY: 'auto' }}>
              {/* SEARCH BOX */}
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="text"
                  placeholder="Search by name, ID or department..."
                  value={statusModalSearch}
                  onChange={(e) => setStatusModalSearch(e.target.value)}
                  className="rm-input"
                  style={{ paddingLeft: '36px', height: '40px' }}
                />
              </div>

              {statusModalLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <RefreshCw size={24} className="rm-spinner-icon" style={{ margin: '0 auto 8px' }} />
                  <p>Loading employee attendance records...</p>
                </div>
              ) : filteredStatusModalItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <Users size={36} color="#cbd5e1" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontWeight: 500, fontSize: '15px' }}>No employees found for this status today.</p>
                </div>
              ) : (
                <div className="mgr-table-responsive" style={{ margin: 0 }}>
                  <table className="mgr-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department / Branch</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Status / Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStatusModalItems
                        .map((item) => (
                          <tr key={item.employee_id}>
                            <td>
                              <div className="rm-profile-cell">
                                {item.profile_photo ? (
                                  <img src={item.profile_photo} alt={item.full_name} className="rm-avatar" />
                                ) : (
                                  <div className="rm-avatar" style={{ background: '#f1f5f9', color: '#475569' }}>
                                    <User size={16} />
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.full_name}</div>
                                  <div style={{ fontSize: '12px', color: '#64748b' }}><code>{item.employee_code}</code></div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>
                                {item.department || 'General'}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                {item.branch_name || 'Main Branch'}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '13px', fontWeight: item.check_in ? 600 : 400, color: item.check_in ? '#0f172a' : '#94a3b8' }}>
                                {item.check_in || '—'}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '13px', fontWeight: item.check_out ? 600 : 400, color: item.check_out ? '#0f172a' : '#94a3b8' }}>
                                {item.check_out || '—'}
                              </span>
                            </td>
                            <td>
                              <div>
                                <span
                                  className={`rm-badge ${
                                    item.calculated_status === 'PRESENT'
                                      ? 'rm-badge-active'
                                      : item.calculated_status === 'LATE'
                                      ? 'rm-badge'
                                      : item.calculated_status === 'PENDING'
                                      ? 'rm-badge'
                                      : 'rm-badge-inactive'
                                  }`}
                                  style={
                                    item.calculated_status === 'LATE'
                                      ? { background: '#fef3c7', color: '#b45309' }
                                      : item.calculated_status === 'PENDING'
                                      ? { background: '#ffedd5', color: '#c2410c' }
                                      : item.calculated_status === 'ON_LEAVE' || item.calculated_status === 'ON LEAVE'
                                      ? { background: '#f5f3ff', color: '#7c3aed' }
                                      : undefined
                                  }
                                >
                                  {item.calculated_status}
                                </span>
                                {item.status_reason ? (
                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                    {item.status_reason}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rm-modal-footer" style={{ borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="rm-btn rm-btn-secondary"
                onClick={() => {
                  setActiveStatusModal(null);
                  navigate('/manager/attendance');
                }}
              >
                Go to Attendance Management <ExternalLink size={14} />
              </button>
              <button
                type="button"
                className="rm-btn rm-btn-primary"
                onClick={() => setActiveStatusModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;