import { useContext, useEffect, useState } from 'react';
import NotificationBell from '../components/NotificationBell';
import PushNotificationRegistration from '../components/PushNotificationRegistration';
import PersonalAlarm from '../components/PersonalAlarm';

import {
  Outlet,
  Link,
  useLocation,
  Navigate,
  useNavigate,
} from 'react-router-dom';

import { 
  LayoutDashboard,
  Calendar,
  FileText,
  User,
  LogOut,
  Calendar as CalendarIcon,
  Menu,
  X,
  ShieldCheck,
  House,
  ListTodo,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import { AuthContext } from '../context/AuthContext';


/* ============================================================
   EMPLOYEE SIDEBAR
   ============================================================ */

const EmployeeSidebar = ({
  isOpen,
  toggleSidebar,
  closeSidebar,
}: {
  isOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}) => {
  const location = useLocation();
  const { logout, employee } = useContext(AuthContext);
  const sidebarCompanyName =
    employee?.company_name ||
    (typeof employee?.company === 'object' ? employee.company?.name : '') ||
    employee?.branch?.company_name ||
    employee?.branch?.company?.name ||
    '';
  const navigate = useNavigate();

  const isAttendanceRelated = 
    location.pathname.startsWith('/attendance') ||
    location.pathname.startsWith('/leave') ||
    location.pathname.startsWith('/wfh') ||
    location.pathname.startsWith('/holidays') ||
    location.pathname.startsWith('/permission') ||
    location.pathname.startsWith('/reports');

  const [attendanceOpen, setAttendanceOpen] = useState(isAttendanceRelated);

  const handleLogout = () => {
    closeSidebar();
    logout();
    const companySlug = localStorage.getItem('attendance_company_slug');
    navigate(companySlug ? `/${encodeURIComponent(companySlug)}/login` : '/login');
  };

  /*
   * Navigation click:
   * Always CLOSE sidebar.
   * Do not use toggle here because toggle can reopen it.
   */
  const handleNavigation = () => {
    closeSidebar();
  };

  return (
    <>
      {/* ======================================================
          MOBILE OVERLAY
          ====================================================== */}

      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={toggleSidebar}
        aria-hidden={!isOpen}
      />

      {/* ======================================================
          SIDEBAR
          ====================================================== */}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>

        {/* Sidebar Header */}
        <div className="sidebar-header">

          <div className="sidebar-brand">
            {sidebarCompanyName || "Attendance"}
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            className="btn-icon employee-sidebar-close"
            onClick={closeSidebar}
            aria-label="Close navigation menu"
          >
            <X
              size={20}
              color="var(--surface)"
            />
          </button>

        </div>


        {/* ====================================================
            NAVIGATION
            ==================================================== */}

        <nav className="nav-links">

          {/* Dashboard */}
          <Link
            to="/dashboard"
            onClick={handleNavigation}
            className={`nav-link ${
              location.pathname === '/dashboard' ||
              location.pathname === '/dashboard/'
                ? 'active'
                : ''
            }`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>

          {/* Attendance Dropdown */}
          <button
            type="button"
            className={`nav-link nav-dropdown-trigger ${
              location.pathname.startsWith('/attendance') ||
              location.pathname.startsWith('/leave') ||
              location.pathname.startsWith('/wfh') ||
              location.pathname.startsWith('/holidays') ||
              location.pathname.startsWith('/permission') ||
              location.pathname.startsWith('/reports')
                ? 'active'
                : ''
            }`}
            onClick={() => setAttendanceOpen((open) => !open)}
            style={{
              background: 'none',
              border: 'none',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'inherit',
              font: 'inherit',
            }}
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
                to="/leave"
                onClick={handleNavigation}
                className={`nav-link nav-sub-link ${
                  location.pathname.startsWith('/leave')
                    ? 'active'
                    : ''
                }`}
              >
                <CalendarIcon size={16} />
                <span>Leave</span>
              </Link>

              <Link
                to="/wfh"
                onClick={handleNavigation}
                className={`nav-link nav-sub-link ${
                  location.pathname.startsWith('/wfh') ? 'active' : ''
                }`}
              >
                <House size={16} />
                <span>Work From Home</span>
              </Link>

              <Link
                to="/holidays"
                onClick={handleNavigation}
                className={`nav-link nav-sub-link ${
                  location.pathname.startsWith('/holidays') ? 'active' : ''
                }`}
              >
                <Calendar size={16} />
                <span>Holidays</span>
              </Link>

              <Link
                to="/permission"
                onClick={handleNavigation}
                className={`nav-link nav-sub-link ${
                  location.pathname.startsWith('/permission')
                    ? 'active'
                    : ''
                }`}
              >
                <ShieldCheck size={16} />
                <span>Permission</span>
              </Link>

              <Link
                to="/reports"
                onClick={handleNavigation}
                className={`nav-link nav-sub-link ${
                  location.pathname.startsWith('/reports')
                    ? 'active'
                    : ''
                }`}
              >
                <FileText size={16} />
                <span>Reports</span>
              </Link>
            </div>
          )}

          {/* Balance / Remaining Items */}
          {/* My Tasks */}
          <Link
            to="/tasks"
            onClick={handleNavigation}
            className={`nav-link ${
              location.pathname.startsWith('/tasks')
                ? 'active'
                : ''
            }`}
          >
            <ListTodo size={18} />
            <span>My Tasks</span>
          </Link>

          {/* Profile */}
          <Link
            to="/profile"
            onClick={handleNavigation}
            className={`nav-link ${
              location.pathname.startsWith('/profile')
                ? 'active'
                : ''
            }`}
          >
            <User size={18} />
            <span>Profile</span>
          </Link>

        </nav>

        {/* ====================================================
            LOGOUT
            ==================================================== */}

        <div
          className="sidebar-footer employee-sidebar-logout"
          style={{
            marginTop: 'auto',
            padding: '1.5rem 1rem',
          }}
        >
          <button
            type="button"
            className="nav-link"
            onClick={handleLogout}
            style={{
              width: '100%',
              color: 'var(--danger)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>

      </aside>
    </>
  );
};


/* ============================================================
   EMPLOYEE TOP HEADER
   ============================================================ */

const EmployeeTopHeader = ({
  toggleSidebar,
}: {
  toggleSidebar: () => void;
}) => {
  const { employee } = useContext(AuthContext);

  const employeeName =
    employee?.full_name?.split(' ')[0] || 'Employee';

  const role =
    employee?.designation || 'Staff';


  /* ============================================================
     PROFILE IMAGE URL
     ============================================================ */

  const getImageUrl = (
    url: string | null | undefined
  ) => {
    if (!url) {
      return null;
    }

    if (url.startsWith('http')) {

      if (
        url.includes('127.0.0.1') ||
        url.includes('localhost')
      ) {
        try {
          const path = new URL(url).pathname;

          return `${window.location.origin}${path}`;
        } catch {
          return url;
        }
      }

      return url;
    }

    return `${window.location.origin}${url.startsWith("/") ? url : "/" + url}`;
  };


  /* ============================================================
     DATE / TIME
     ============================================================ */

  const currentDate = new Date();

  const formattedDate =
    currentDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const formattedTime =
    currentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });


  return (
    <header
      className="top-header employee-top-header"
      style={{
        backgroundColor: 'var(--bg-page)',
        borderBottom: 'none',
        height: '72px',
      }}
    >

      {/* ======================================================
          LEFT SIDE
          ====================================================== */}

      <div
        className="employee-header-left"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flex: 1,
          minWidth: 0,
        }}
      >

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="mobile-menu-btn"
          aria-label="Open navigation menu"
        >
          <Menu
            size={20}
            color="var(--text-primary)"
          />
        </button>


        {/* Welcome Message */}
        <div
          className="mobile-hide"
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Welcome, {employeeName}
          </h2>
        </div>

      </div>


      {/* ======================================================
          RIGHT SIDE
          ====================================================== */}

      <div
        className="employee-header-right"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >

        {/* Date / Time */}
        <div
          className="employee-date-widget"
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
              {formattedDate}
            </span>

            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '0.2rem',
              }}
            >
              {formattedTime}
            </span>
          </div>
        </div>


        {/* Notification Bell & Employee Profile */}
        <div
          className="employee-header-profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
          }}
        >
          <NotificationBell />

          {/* Avatar */}
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

            {employee?.profile_photo ? (
              <img
                src={
                  getImageUrl(
                    employee.profile_photo
                  ) || ''
                }
                alt="Profile"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                  employeeName
                )}&background=0056B3&color=fff`}
                alt={employeeName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}

          </div>


          {/* Name / Designation */}
          <div
            className="employee-header-user-info"
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                lineHeight: 1,
                color: 'var(--text-primary)',
              }}
            >
              {employeeName}
            </span>

            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '0.2rem',
              }}
            >
              {role}
            </span>
          </div>

        </div>

      </div>

    </header>
  );
};


/* ============================================================
   EMPLOYEE LAYOUT
   ============================================================ */

const EmployeeLayout = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);


  /* ============================================================
     SIDEBAR TOGGLE
     ============================================================ */

  const toggleSidebar = () => {
    setSidebarOpen(
      (previousState) => !previousState
    );
  };


  /* ============================================================
     CLOSE SIDEBAR
     ============================================================ */

  const closeSidebar = () => {
    setSidebarOpen(false);
  };


  /* ============================================================
     CLOSE SIDEBAR AFTER ROUTE CHANGE
     ============================================================ */

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);


  /* ============================================================
     CLOSE SIDEBAR WITH ESCAPE
     ============================================================ */

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    document.addEventListener(
      'keydown',
      handleEscape
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, [sidebarOpen]);


  /* ============================================================
     LOCK BODY SCROLL WHEN MOBILE SIDEBAR IS OPEN
     ============================================================ */

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


  /* ============================================================
     AUTH CHECK
     ============================================================ */

  if (
    !user ||
    (user.role !== 'EMPLOYEE' && user.role !== 'TEAM_LEADER')
  ) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }


  /* ============================================================
     LAYOUT
     ============================================================ */

  return (
    <div className="app-container">

      {/* Employee Sidebar */}
      <EmployeeSidebar
        isOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        closeSidebar={closeSidebar}
      />


      {/* Main Content */}
      <div className="main-content">

        {/* Top Header */}
        <EmployeeTopHeader
          toggleSidebar={toggleSidebar}
        />


        {/* Page Content */}
        <main className="page-content">
          <PersonalAlarm />
          <PushNotificationRegistration />
          <Outlet />
        </main>

      </div>

    </div>
  );
};


export default EmployeeLayout;






















