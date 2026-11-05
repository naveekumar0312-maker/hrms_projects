import React, { useContext } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from 'react-router-dom';

import {
  AuthProvider,
  AuthContext,
} from './context/AuthContext';

// ============================================================
// ADMIN PAGES
// ============================================================

import Branches from './pages/Branches';
import Employees from './pages/Employees';
import EmployeeFormPage from './pages/EmployeeFormPage';
import EmployeeDetailsPage from './pages/EmployeeDetailsPage';
import Shifts from './pages/Shifts';
import Attendance from './pages/Attendance';
import Companies from './pages/Companies';
import HRAccounts from './pages/HRAccounts';
import BrandingSettings from './pages/BrandingSettings';
import CompanyBrandingList from './pages/CompanyBrandingList';
import Dashboard from './pages/Dashboard';
import LiveLocations from './pages/LiveLocations';
import AdminLayout from './layouts/AdminLayout';
import WFHManagement from './pages/WFHManagement';
import Holidays from './pages/Holidays';
import ReportingManagers from './pages/ReportingManagers';

// ============================================================
// REPORTING MANAGER PAGES & LAYOUT
// ============================================================
import ManagerLayout from './layouts/ManagerLayout';
import ManagerDashboard from './pages/manager/Dashboard';
import ManagerTeam from './pages/manager/Team';
import ManagerTeamAttendance from './pages/manager/TeamAttendance';
import TaskManager from './pages/manager/TaskManager';

// ============================================================
// UNIVERSAL
// ============================================================

import UniversalLogin from './pages/UniversalLogin';
// WebSplash removed per request
import CustomAlertProvider from './components/CustomAlert';

// ============================================================
// EMPLOYEE PAGES
// ============================================================

import EmployeeLayout from './layouts/EmployeeLayout';
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeAttendanceHistory from './pages/employee/AttendanceHistory';
import EmployeeReports from './pages/employee/Reports';
import EmployeeProfile from './pages/employee/Profile';
import EmployeeChangePassword from './pages/employee/ChangePassword';
import EmployeePermission from './pages/employee/Permission';
import EmployeeLeave from './pages/employee/Leave';
import EmployeeWFH from './pages/employee/WFH';
import EmployeeHolidays from './pages/employee/Holidays';
import EmployeeTasks from './pages/employee/Tasks';
import AdminLeaves from './pages/Leaves';
import AdminPermissions from './pages/Permissions';

// ============================================================
// PROTECTED ROUTE
// ============================================================

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: 'ADMIN' | 'SUPER_ADMIN' | 'HR' | 'REPORTING_MANAGER' | 'TEAM_LEADER' | 'EMPLOYEE' | ('EMPLOYEE' | 'TEAM_LEADER')[];
}

const ProtectedRoute = ({
  children,
  allowedRole,
}: ProtectedRouteProps) => {
  const {
    user,
    isAuthenticated,
    isLoading,
  } = useContext(AuthContext);

  if (isLoading) { return null; }

  if (!isAuthenticated || !user) {
    if (allowedRole === 'SUPER_ADMIN') {
      return <Navigate to="/super-admin/login" replace />;
    }
    if (allowedRole === 'REPORTING_MANAGER') {
      return <Navigate to="/manager/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  const allowedRoles = Array.isArray(allowedRole)
    ? allowedRole
    : allowedRole === 'ADMIN'
    ? ['SUPER_ADMIN', 'HR', 'ADMIN']
    : [allowedRole];

  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'SUPER_ADMIN') {
      return <Navigate to="/super-admin/dashboard" replace />;
    }

    if (user.role === 'HR') {
      const slug = user?.company_slug || localStorage.getItem('attendance_company_slug');
      return <Navigate to={slug ? `/${encodeURIComponent(slug)}/hr/dashboard` : '/admin'} replace />;
    }

    if (user.role === 'ADMIN') {
      return <Navigate to="/admin" replace />;
    }

    if (user.role === 'REPORTING_MANAGER') {
      return <Navigate to="/manager/dashboard" replace />;
    }

    if (user.role === 'TEAM_LEADER' || user.role === 'EMPLOYEE') {
      return <Navigate to="/dashboard" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// ============================================================
// COMPANY HR PROTECTED ROUTE (WITH SLUG ENFORCEMENT)
// ============================================================

const CompanyHRProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, isLoading } = useContext(AuthContext);
  const { companySlug } = useParams<{ companySlug: string }>();

  if (isLoading) { return null; }

  if (!isAuthenticated || !user) {
    return <Navigate to={companySlug ? `/${encodeURIComponent(companySlug)}/hr/login` : '/login'} replace />;
  }

  // Only HR allowed
  if (user.role !== 'HR') {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      return <Navigate to="/super-admin/dashboard" replace />;
    }
    if (user.role === 'EMPLOYEE') {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Cross-company isolation: if user is assigned to another company slug, redirect to their assigned company
  const assignedSlug = user?.company_slug || localStorage.getItem('attendance_company_slug');
  if (companySlug && assignedSlug && companySlug !== assignedSlug) {
    return <Navigate to={`/${encodeURIComponent(assignedSlug)}/hr/dashboard`} replace />;
  }

  return <>{children}</>;
};

// ============================================================
// ROOT REDIRECT
// ============================================================

const RootRedirect = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
  } = useContext(AuthContext);

  if (isLoading) { return null; }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'SUPER_ADMIN') {
    return <Navigate to="/super-admin/dashboard" replace />;
  }

  if (user.role === 'HR') {
    const slug = user?.company_slug || localStorage.getItem('attendance_company_slug');
    if (slug) {
      return <Navigate to={`/${encodeURIComponent(slug)}/hr/dashboard`} replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  if (user.role === 'ADMIN') {
    return <Navigate to="/super-admin/dashboard" replace />;
  }

  if (user.role === 'REPORTING_MANAGER') {
    return <Navigate to="/manager/dashboard" replace />;
  }

  if (user.role === 'TEAM_LEADER') {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.role === 'EMPLOYEE') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

// ============================================================
// APP ROUTES
// ============================================================

const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        {/* ==================================================
            1. EXPLICIT GLOBAL SUPER ADMIN LOGIN & PORTAL
        ================================================== */}
        <Route
          path="/super-admin/login"
          element={<UniversalLogin loginMode="super-admin" />}
        />
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRole="SUPER_ADMIN">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="live-locations" element={<LiveLocations />} />
          <Route path="employees/add" element={<EmployeeFormPage />} />
          <Route path="employees/:id/edit" element={<EmployeeFormPage />} />
          <Route path="employees/:id" element={<EmployeeDetailsPage />} />
          <Route path="employees" element={<Employees />} />
          <Route path="shifts" element={<Shifts />} />
          <Route path="companies" element={<Companies />} />
          <Route path="hr-accounts" element={<HRAccounts />} />
          <Route path="branding-settings" element={<BrandingSettings />} />
          <Route path="company-branding-list" element={<CompanyBrandingList />} />
          <Route path="branches" element={<Branches />} />
          <Route path="permissions" element={<AdminPermissions />} />
          <Route path="leaves" element={<AdminLeaves />} />
          <Route path="wfh" element={<WFHManagement />} />
          <Route path="holidays" element={<Holidays />} />
          <Route path="reporting-managers" element={<ReportingManagers />} />
        </Route>

        {/* ==================================================
            2. DEDICATED REPORTING MANAGER LOGIN & PORTAL
               (MUST BE BEFORE WILDCARD /:companySlug ROUTES)
        ================================================== */}
        <Route
          path="/manager/login"
          element={<UniversalLogin loginMode="manager" />}
        />
        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRole="REPORTING_MANAGER">
              <ManagerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ManagerDashboard />} />
          <Route path="team" element={<ManagerTeam />} />
          <Route path="tasks" element={<TaskManager />} />
          <Route path="team-attendance" element={<ManagerTeamAttendance />} />
        </Route>

        {/* ==================================================
            2B. TEAM LEADER PORTAL (REDIRECTS TO UNIFIED DASHBOARD)
        ================================================== */}
        <Route
          path="/team-leader/*"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* ==================================================
            3. GENERAL / LEGACY AUTHENTICATION ROUTES
        ================================================== */}
        <Route
          path="/login"
          element={<UniversalLogin loginMode="general" />}
        />
        <Route
          path="/hr/login"
          element={<Navigate to="/login" replace />}
        />

        {/* ==================================================
            4. ROOT
        ================================================== */}
        <Route
          path="/"
          element={<RootRedirect />}
        />

        {/* ==================================================
            5. EMPLOYEE & TEAM LEADER ROUTES
        ================================================== */}
        <Route
          element={
            <ProtectedRoute allowedRole={['EMPLOYEE', 'TEAM_LEADER']}>
              <EmployeeLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<EmployeeDashboard />} />
          <Route path="/attendance" element={<EmployeeAttendanceHistory />} />
          <Route path="/reports" element={<EmployeeReports />} />
          <Route path="/profile" element={<EmployeeProfile />} />
          <Route path="/profile/change-password" element={<EmployeeChangePassword />} />
          <Route path="/permission" element={<EmployeePermission />} />
          <Route path="/tasks" element={<EmployeeTasks />} />
          <Route path="/leave" element={<EmployeeLeave />} />
          <Route path="/wfh" element={<EmployeeWFH />} />
          <Route path="/holidays" element={<EmployeeHolidays />} />
        </Route>

        {/* ==================================================
            6. LEGACY /admin ROUTES (Redirect or Render according to role)
        ================================================== */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="ADMIN">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="live-locations" element={<LiveLocations />} />
          <Route path="employees/add" element={<EmployeeFormPage />} />
          <Route path="employees/:id/edit" element={<EmployeeFormPage />} />
          <Route path="employees/:id" element={<EmployeeDetailsPage />} />
          <Route path="employees" element={<Employees />} />
          <Route path="shifts" element={<Shifts />} />
          <Route
            path="companies"
            element={
              <ProtectedRoute allowedRole="SUPER_ADMIN">
                <Companies />
              </ProtectedRoute>
            }
          />
          <Route
            path="hr-accounts"
            element={
              <ProtectedRoute allowedRole="SUPER_ADMIN">
                <HRAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="branding-settings"
            element={
              <ProtectedRoute allowedRole="SUPER_ADMIN">
                <BrandingSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="company-branding-list"
            element={
              <ProtectedRoute allowedRole="SUPER_ADMIN">
                <CompanyBrandingList />
              </ProtectedRoute>
            }
          />
          <Route path="branches" element={<Branches />} />
          <Route path="permissions" element={<AdminPermissions />} />
          <Route path="leaves" element={<AdminLeaves />} />
          <Route path="wfh" element={<WFHManagement />} />
          <Route path="holidays" element={<Holidays />} />
          <Route path="reporting-managers" element={<ReportingManagers />} />
        </Route>

        {/* ==================================================
            7. COMPANY-SPECIFIC HR PORTAL
               e.g. /:companySlug/hr/login
                    /:companySlug/hr/dashboard
        ================================================== */}
        <Route
          path="/:companySlug/hr/login"
          element={<UniversalLogin loginMode="hr" />}
        />
        <Route
          path="/:companySlug/hr"
          element={
            <CompanyHRProtectedRoute>
              <AdminLayout />
            </CompanyHRProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="live-locations" element={<LiveLocations />} />
          <Route path="employees/add" element={<EmployeeFormPage />} />
          <Route path="employees/:id/edit" element={<EmployeeFormPage />} />
          <Route path="employees/:id" element={<EmployeeDetailsPage />} />
          <Route path="employees" element={<Employees />} />
          <Route path="shifts" element={<Shifts />} />
          <Route path="branches" element={<Branches />} />
          <Route path="permissions" element={<AdminPermissions />} />
          <Route path="leaves" element={<AdminLeaves />} />
          <Route path="wfh" element={<WFHManagement />} />
          <Route path="holidays" element={<Holidays />} />
          <Route path="reporting-managers" element={<ReportingManagers />} />
        </Route>


        {/* ==================================================
            9. COMPANY-SPECIFIC GENERAL / EMPLOYEE LOGIN
               e.g. /:companySlug/login
        ================================================== */}
        <Route
          path="/:companySlug/login"
          element={<UniversalLogin loginMode="general" />}
        />

        {/* ==================================================
            9. FALLBACK
        ================================================== */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </Router>
  );
};

// ============================================================
// APP
// ============================================================

const AppContent = () => {
  const { isLoading } = useContext(AuthContext);

  if (isLoading) {
    return null;
  }

  return (
    <>
      <AppRoutes />
      <CustomAlertProvider />
    </>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
