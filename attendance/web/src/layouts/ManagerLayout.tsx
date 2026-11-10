import React, { useState, useContext, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  LogOut,
  Menu,
  X,
  ListTodo,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import './ManagerLayout.css';
import { RolePendingActionsModal } from '../components/RolePendingActionsModal';
import type {
  PendingActionItem,
  PendingActionsSummary,
} from '../components/RolePendingActionsModal';

const ManagerLayout: React.FC = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderData, setReminderData] = useState<{
    totalCount: number;
    summary: PendingActionsSummary;
    items: PendingActionItem[];
  }>({
    totalCount: 0,
    summary: {},
    items: [],
  });

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      try {
        const res = await api.get('/employees/manager/profile/');
        if (active) setProfile(res.data);
      } catch (err) {
        console.error('Failed to load manager profile:', err);
      }
    };
    fetchProfile();
    return () => {
      active = false;
    };
  }, []);

  // Manager Pending Approvals Reminder Check (Hourly + on Mount)
  useEffect(() => {
    if (!user) return;

    let active = true;

    const checkPendingReminder = async (force: boolean = false) => {
      try {
        const lastShownKey = `pending_reminder_last_shown_MANAGER_${user.id || 'user'}`;
        const lastShown = localStorage.getItem(lastShownKey);
        const oneHourMs = 60 * 60 * 1000;
        const now = Date.now();

        if (!force && lastShown && now - parseInt(lastShown, 10) < oneHourMs) {
          return;
        }

        const res = await api.get('/attendance/pending-actions-reminder/');
        if (!active) return;

        const data = res.data;
        if (data && data.has_pending && data.total_pending_count > 0) {
          setReminderData({
            totalCount: data.total_pending_count,
            summary: data.summary || {},
            items: data.items || [],
          });
          setReminderModalOpen(true);
          localStorage.setItem(lastShownKey, now.toString());
        }
      } catch (err) {
        console.error('Failed to check manager reminders:', err);
      }
    };

    checkPendingReminder(false);

    const interval = setInterval(() => {
      checkPendingReminder(true);
    }, 60 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/manager/login');
  };

  const navLinks = [
    { to: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/manager/team', label: 'My Team', icon: Users },
    { to: '/manager/tasks', label: 'Task Management', icon: ListTodo },
    { to: '/manager/team-attendance', label: 'Team Attendance', icon: CalendarCheck },
  ];

  return (
    <div className="mgr-layout">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 95,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Manager Sidebar */}
      <aside className={`mgr-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="mgr-sidebar-header">
          <div>
            <div className="mgr-brand-title">{profile?.company_name || 'Attendance'}</div>
            <div className="mgr-brand-sub">Reporting Manager</div>
          </div>
          <button
            type="button"
            className="mgr-sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close Sidebar"
          >
            <X size={20} color="#fff" />
          </button>
        </div>

        <nav className="mgr-nav">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`mgr-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mgr-sidebar-footer">
          <div className="mgr-user-info">
            <div className="mgr-avatar">
              {profile?.full_name?.charAt(0) || user?.username?.charAt(0)?.toUpperCase() || 'M'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {profile?.full_name || user?.username}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                {profile?.designation || 'Team Leader'}
              </div>
            </div>
          </div>

          <button className="mgr-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="mgr-main">
        <header className="mgr-topbar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className="mgr-sidebar-toggle-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open Sidebar"
            >
              <Menu size={20} />
            </button>

            <div style={{ fontWeight: 600, fontSize: '15px', color: '#0f172a' }}>
              Welcome, {profile?.full_name || user?.username}
            </div>
          </div>
        </header>

        <main className="mgr-content">
          <Outlet />
        </main>
      </div>

      <RolePendingActionsModal
        isOpen={reminderModalOpen}
        role="REPORTING_MANAGER"
        totalCount={reminderData.totalCount}
        summary={reminderData.summary}
        items={reminderData.items}
        onClose={() => setReminderModalOpen(false)}
        onNavigateAction={(url) => {
          setReminderModalOpen(false);
          navigate(url);
        }}
      />
    </div>
  );
};

export default ManagerLayout;

