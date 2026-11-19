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
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { CustomDatePicker } from '../../components/CustomDatePicker';
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
    {
      title: 'Direct Employees',
      value: summary?.direct_employees ?? 0,
      icon: Users,
      color: '#0284c7',
      bg: '#e0f2fe',
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
      {/* COMPANY & MANAGER PROFILE BANNER */}
      <div className="mgr-company-banner" style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#ecfdf5',
            color: '#22C55E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #a7f3d0'
          }}>
            <Building size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                {summary?.company_name || user?.company_name || 'Yaazh 360'}
              </span>
              <span style={{
                background: '#f1f5f9',
                color: '#475569',
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Shield size={11} /> Reporting Manager
              </span>
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              Manager: <strong>{summary?.manager_name || user?.username}</strong> &bull; Username: <code>{user?.username}</code> &bull; Total Structure: <strong>{summary?.total_employees ?? 0} members</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/manager/team" className="rm-btn rm-btn-primary" style={{ textDecoration: 'none' }}>
            <Users size={16} /> Manage Team
          </Link>
          <button className="rm-btn rm-btn-secondary" onClick={() => loadDashboardData()}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* SECTION 1: HIERARCHY OVERVIEW */}
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1C1917', marginBottom: '14px' }}>
        Organization & Team Scope
      </h3>
      <div className="mgr-cards-grid" style={{ marginBottom: '28px' }}>
        {employeeCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="mgr-stat-card">
              <div className="mgr-stat-icon" style={{ background: c.bg, color: c.color }}>
                <Icon size={24} />
              </div>
              <div className="mgr-stat-content">
                <span className="mgr-stat-label">{c.title}</span>
                <span className="mgr-stat-value">{loading ? '--' : c.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* SECTION 2: ATTENDANCE OVERVIEW (CLICKABLE DRILL-DOWN) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1C1917', margin: 0 }}>
            Team Attendance Overview
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Click any card to view detailed employee report for the selected date
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

      <div className="mgr-cards-grid" style={{ marginBottom: '32px' }}>
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
                <Icon size={24} />
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

      {/* SECTION 3: REQUESTS & APPROVALS (LEAVES, PERMISSIONS, WFH) */}
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1C1917', marginBottom: '14px' }}>
        Team Approvals & Requests
      </h3>
      <div className="mgr-cards-grid" style={{ marginBottom: '32px' }}>
        <Link to="/manager/leaves" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="mgr-stat-card" style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}>
            <div className="mgr-stat-icon" style={{ background: '#fff7ed', color: '#ea580c' }}>
              <Calendar size={24} />
            </div>
            <div className="mgr-stat-content">
              <span className="mgr-stat-label">Leave Requests</span>
              <span className="mgr-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {loading ? '--' : `${pendingStats.pending_leaves} Pending`}
                <ArrowRight size={16} color="#ea580c" />
              </span>
            </div>
          </div>
        </Link>

        <Link to="/manager/permissions" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="mgr-stat-card" style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}>
            <div className="mgr-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Clock size={24} />
            </div>
            <div className="mgr-stat-content">
              <span className="mgr-stat-label">Permission Requests</span>
              <span className="mgr-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {loading ? '--' : `${pendingStats.pending_permissions} Pending`}
                <ArrowRight size={16} color="#2563eb" />
              </span>
            </div>
          </div>
        </Link>

        <Link to="/manager/wfh" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="mgr-stat-card" style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}>
            <div className="mgr-stat-icon" style={{ background: '#faf5ff', color: '#7c3aed' }}>
              <Building2 size={24} />
            </div>
            <div className="mgr-stat-content">
              <span className="mgr-stat-label">WFH Requests</span>
              <span className="mgr-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {loading ? '--' : `${pendingStats.pending_wfh} Pending`}
                <ArrowRight size={16} color="#7c3aed" />
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Assigned Team Members Table Preview */}
      <div className="mgr-section-card">
        <div className="mgr-section-header">
          <div>
            <h2>My Assigned Team</h2>
            <p>Employees currently reporting to your department.</p>
          </div>
          <Link to="/manager/team" className="mgr-link-btn">
            View All Team <ArrowRight size={16} />
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
