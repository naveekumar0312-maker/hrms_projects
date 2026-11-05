import React, { useState, useEffect } from 'react';
import NotificationBell from '../components/NotificationBell';
import PushNotificationRegistration from '../components/PushNotificationRegistration';

import {
  Link,
  Outlet,
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from 'react-router-dom';

import {
  LayoutDashboard,
  Users,
  MapPin,
  LocateFixed,
  Calendar,
  LogOut,
  Building2,
  Clock,
  Search,
  Calendar as CalendarIcon,
  Menu,
  X,
  ShieldCheck,
  House,

  Palette,
  ChevronDown,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';


// ============================================================
// SIDEBAR
// ============================================================

const Sidebar = ({
  isOpen,
  closeSidebar,
}: {
  isOpen: boolean;
  closeSidebar: () => void;
}) => {
  
  const { logout, user } = React.useContext(AuthContext);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    let active = true;

    const loadCompanyName = async () => {
      if (user?.role !== 'HR') {
        setCompanyName('');
        return;
      }

      try {
        const response = await api.get('/companies/');
        const companies = Array.isArray(response.data)
          ? response.data
          : response.data?.results || [];

        if (active && companies.length > 0) {
          setCompanyName(companies[0].name || '');
        }
      } catch (error) {
        console.error('Unable to load HR company name:', error);
      }
    };

    loadCompanyName();

    return () => {
      active = false;
    };
  }, [user?.role]);
  const navigate = useNavigate();
  const route = useLocation();
  const { companySlug: routeSlug } = useParams<{ companySlug?: string }>();
  const activeCompanySlug = routeSlug || user?.company_slug || localStorage.getItem('attendance_company_slug');
  const isSuper = user?.role === 'SUPER_ADMIN' || (user?.role === 'ADMIN' && (user?.is_superuser || user?.is_staff));
  
  const basePath = isSuper
    ? (route.pathname.startsWith('/admin') ? '/admin' : '/super-admin')
    : (activeCompanySlug ? `/${encodeURIComponent(activeCompanySlug)}/hr` : '/admin');

  const [attendanceOpen, setAttendanceOpen] = useState(
    route.pathname.includes('/attendance') ||
    route.pathname.includes('/leaves') ||
    route.pathname.includes('/permissions') ||
    route.pathname.includes('/wfh') ||
    route.pathname.includes('/holidays')
  );
  const [companiesOpen, setCompaniesOpen] = useState(
    route.pathname.includes('/shifts') ||
    route.pathname.includes('/companies') ||
    route.pathname.includes('/hr-accounts') ||
    route.pathname.includes('/branches')
  );

  const handleLogout = () => {
    closeSidebar();
    const isSuper = user?.role === 'SUPER_ADMIN' || (user?.role === 'ADMIN' && (user?.is_superuser || user?.is_staff));
    const companySlug = user?.company_slug || localStorage.getItem('attendance_company_slug');
    logout();
    if (isSuper) {
      navigate('/super-admin/login');
    } else if (companySlug) {
      navigate(`/${encodeURIComponent(companySlug)}/hr/login`);
    } else {
      navigate('/login');
    }
  };

  const handleNavClick = () => {
    // Always close mobile sidebar after navigation
    closeSidebar();
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        
        {/* Sidebar Header */}
        <div
          className="sidebar-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '72px',
          }}
        >
          <div className="sidebar-brand">{companyName || (user?.role === 'SUPER_ADMIN' ? 'Super Admin' : user?.role === 'HR' ? 'Loading company...' : 'Attendance')}</div>

          {/* Mobile Close Button */}
          <button
            type="button"
            className="btn-icon employee-sidebar-close"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            <X size={20} color="var(--surface)" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="nav-links">

          <Link
            to={`${basePath}/dashboard`}
            onClick={handleNavClick}
            className={`nav-link ${
              route.pathname.endsWith('/dashboard') || route.pathname === basePath || route.pathname === `${basePath}/`
                ? 'active'
                : ''
            }`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>

          {/* Attendance dropdown */}
          <button
            type="button"
            className={`nav-link nav-dropdown-trigger ${
              route.pathname.includes('/attendance') ||
              route.pathname.includes('/leaves') ||
              route.pathname.includes('/permissions') ||
    route.pathname.includes('/wfh') ||
              route.pathname.includes('/holidays')
                ? 'active'
                : ''
            }`}
            aria-expanded={attendanceOpen}
            onClick={() => setAttendanceOpen((open) => !open)}
          >
            <Calendar size={18} />
            <span>Attendance</span>
            {attendanceOpen
              ? <ChevronDown className="nav-dropdown-arrow" size={16} />
              : <ChevronRight className="nav-dropdown-arrow" size={16} />}
          </button>

          {attendanceOpen && (
            <div className="nav-submenu">
              <Link
                to={`${basePath}/attendance`}
                onClick={handleNavClick}
                className={`nav-link nav-sub-link ${
                  route.pathname.includes('/attendance') ? 'active' : ''
                }`}
              >
                <Calendar size={16} />
                <span>Attendance</span>
              </Link>
              <Link
                to={`${basePath}/leaves`}
                onClick={handleNavClick}
                className={`nav-link nav-sub-link ${
                  route.pathname.includes('/leaves') ? 'active' : ''
                }`}
              >
                <CalendarIcon size={16} />
                <span>Leave</span>
              </Link>
              <Link
                to={`${basePath}/permissions`}
                onClick={handleNavClick}
                className={`nav-link nav-sub-link ${
                  route.pathname.includes('/permissions') ||
    route.pathname.includes('/wfh') ? 'active' : ''
                }`}
              >
                <ShieldCheck size={16} />
                <span>Permission</span>
              </Link>
              <Link
                to={`${basePath}/wfh`}
                onClick={handleNavClick}
                className={`nav-link nav-sub-link ${
                  route.pathname.includes('/wfh') ? 'active' : ''
                }`}
              >
                <House size={16} />
                <span>Work From Home</span>
              </Link>
              <Link
                to={`${basePath}/holidays`}
                onClick={handleNavClick}
                className={`nav-link nav-sub-link ${
                  route.pathname.includes('/holidays') ? 'active' : ''
                }`}
              >
                <Calendar size={16} />
                <span>Holidays</span>
              </Link>
            </div>
          )}

          {/* Employees stays separate */}
          <Link
            to={`${basePath}/employees`}
            onClick={handleNavClick}
            className={`nav-link ${
              route.pathname.includes('/employees') ? 'active' : ''
            }`}
          >
            <Users size={18} />
            <span>Employees</span>
          </Link>

          {/* Reporting Managers */}
          <Link
            to={`${basePath}/reporting-managers`}
            onClick={handleNavClick}
            className={`nav-link ${
              route.pathname.includes('/reporting-managers') ? 'active' : ''
            }`}
          >
            <UserCheck size={18} />
            <span>Reporting Managers</span>
          </Link>

          {/* Live employee locations */}
          <Link
            to={`${basePath}/live-locations`}
            onClick={handleNavClick}
            className={`nav-link ${
              route.pathname.includes('/live-locations') ? 'active' : ''
            }`}
          >
            <LocateFixed size={18} />
            <span>Live Locations</span>
          </Link>
          {/* Company-related dropdown */}
          <button
            type="button"
            className={`nav-link nav-dropdown-trigger ${
              route.pathname.includes('/shifts') ||
              route.pathname.includes('/companies') ||
              route.pathname.includes('/hr-accounts') ||
              route.pathname.includes('/branches')
                ? 'active'
                : ''
            }`}
            aria-expanded={companiesOpen}
            onClick={() => setCompaniesOpen((open) => !open)}
          >
            <Building2 size={18} />
            <span>Companies</span>
            {companiesOpen
              ? <ChevronDown className="nav-dropdown-arrow" size={16} />
              : <ChevronRight className="nav-dropdown-arrow" size={16} />}
          </button>

          {companiesOpen && (
            <div className="nav-submenu">
              <Link
                to={`${basePath}/shifts`}
                onClick={handleNavClick}
                className={`nav-link nav-sub-link ${
                  route.pathname.includes('/shifts') ? 'active' : ''
                }`}
              >
                <Clock size={16} />
                <span>Shifts</span>
              </Link>

              {['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '') && (
                <Link
                  to={`${basePath}/companies`}
                  onClick={handleNavClick}
                  className={`nav-link nav-sub-link ${
                    route.pathname.includes('/companies') ? 'active' : ''
                  }`}
                >
                  <Building2 size={16} />
                  <span>Companies List</span>
                </Link>
              )}

              {user?.role === 'SUPER_ADMIN' && (
                <Link
                  to={`${basePath}/hr-accounts`}
                  onClick={handleNavClick}
                  className={`nav-link nav-sub-link ${
                    route.pathname.includes('/hr-accounts') ? 'active' : ''
                  }`}
                >
                  <Users size={16} />
                  <span>HR Accounts</span>
                </Link>
              )}

              <Link
                to={`${basePath}/branches`}
                onClick={handleNavClick}
                className={`nav-link nav-sub-link ${
                  route.pathname.includes('/branches') ? 'active' : ''
                }`}
              >
                <MapPin size={16} />
                <span>Branches</span>
              </Link>
            </div>
          )}

          {/* Branding stays separate */}
          {user?.role === 'SUPER_ADMIN' && (
            <Link
              to={`${basePath}/branding-settings`}
              onClick={handleNavClick}
              className={`nav-link ${
                route.pathname.includes('/branding-settings')
                  ? 'active'
                  : ''
              }`}
            >
              <Palette size={18} />
              <span>Branding &amp; Settings</span>
            </Link>
          )}

          {user?.role === 'SUPER_ADMIN' && (
            <Link
              to={`${basePath}/company-branding-list`}
              onClick={handleNavClick}
              className={`nav-link ${
                route.pathname.includes('/company-branding-list')
                  ? 'active'
                  : ''
              }`}
            >
              <Building2 size={18} />
              <span>Company Branding List</span>
            </Link>
          )}
        </nav>

        {/* Logout */}
        <div
          className="sidebar-footer"
          style={{
            marginTop: 'auto',
            padding: '1.5rem 1rem',
          }}
        >
          <button
            type="button"
            className="nav-link"
            style={{
              width: '100%',
              color: 'var(--danger)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};


// ============================================================
// TOP HEADER
// ============================================================

const TopHeader = ({
  toggleSidebar,
  isSidebarOpen,
}: {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}) => {
  const { user } = React.useContext(AuthContext);
  return (
    <header
      className="top-header"
      style={{
        padding: '0 2rem',
        height: '72px',
      }}
    >
      {/* Left Side */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flex: 1,
        }}
      >
        {/* Mobile Menu */}
        <button
          type="button"
          onClick={toggleSidebar}
          style={{
            padding: '0.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          className="mobile-menu-btn"
          aria-label={
            isSidebarOpen ? 'Close navigation' : 'Open navigation'
          }
        >
          {isSidebarOpen ? (
            <X size={20} color="var(--text-primary)" />
          ) : (
            <Menu size={20} color="var(--text-primary)" />
          )}
        </button>

        {/* Search */}
        <div
          style={{
            flex: 1,
            maxWidth: '400px',
            position: 'relative',
          }}
          className="mobile-hide"
        >
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />

          <input
            type="text"
            placeholder="Search employees, attendance, branches..."
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 2.75rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Right Side */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
        }}
      >
        {/* Date / Time */}
        <div
          className="mobile-hide"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: 'var(--surface)',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}
        >
          <CalendarIcon
            size={16}
            color="var(--primary)"
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1,
              }}
            >
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>

            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '0.2rem',
              }}
            >
              {new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        <div className="push-controls-wrapper desktop-push-controls" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <NotificationBell />
          
        </div>
        {/* Admin Profile */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            className="avatar"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || user?.name || user?.username || user?.email || "User")}&background=0056B3&color=fff`}
              alt={user?.full_name || user?.name || user?.username || "User"}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>

          <div className="mobile-hide">
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                lineHeight: 1,
                color: 'var(--text-primary)',
              }}
            >{user?.full_name || user?.name || user?.username || user?.email || "User"}</span>

            <br />

            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '0.2rem',
              }}
            >
              {user?.role === "SUPER_ADMIN" ? "Super Admin" : user?.role === "HR" ? "HR" : user?.role === "ADMIN" ? "Admin" : user?.role || "User"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};


// ============================================================
// ADMIN LAYOUT
// ============================================================

const AdminLayout = () => {
  const { user } = React.useContext(AuthContext);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  

  // ----------------------------------------------------------
  // Close sidebar whenever route changes
  // ----------------------------------------------------------
 

  // ----------------------------------------------------------
  // Close sidebar when Escape is pressed
  // ----------------------------------------------------------
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // ----------------------------------------------------------
  // Prevent body scroll when mobile sidebar is open
  // ----------------------------------------------------------
  useEffect(() => {
    if (
      sidebarOpen &&
      window.innerWidth <= 1024
    ) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // ----------------------------------------------------------
  // Sidebar Controls
  // ----------------------------------------------------------
  const toggleSidebar = () => {
    setSidebarOpen((previous) => !previous);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // ----------------------------------------------------------
  // Authentication Check
  // IMPORTANT:
  // This comes AFTER all hooks.
  // ----------------------------------------------------------
  if (!user || !['SUPER_ADMIN', 'HR', 'ADMIN'].includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="app-container">

      
      <PushNotificationRegistration />
<Sidebar
        isOpen={sidebarOpen}
        closeSidebar={closeSidebar}
      />

      <div className="main-content">

        <TopHeader
          toggleSidebar={toggleSidebar}
          isSidebarOpen={sidebarOpen}
        />

        <div className="admin-mobile-push-controls">
          <NotificationBell />
          
        </div>

        <main className="page-content">
          <Outlet />
        </main>

      </div>
    </div>
  );
};

export default AdminLayout;



































