import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Shield,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api/index';
import './ManagerLogin.css';

interface LoginResponse {
  access: string;
  refresh: string;
  user: {
    id: number;
    username: string;
    email?: string;
    role: string;
    first_name?: string;
    last_name?: string;
    company?: number;
    company_name?: string;
    company_slug?: string;
  };
  employee?: any;
}

const ManagerLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useContext(AuthContext);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in as REPORTING_MANAGER or TEAM_LEADER, redirect appropriately
  useEffect(() => {
    if (isAuthenticated && user?.role === 'REPORTING_MANAGER') {
      const from = (location.state as any)?.from?.pathname || '/manager/dashboard';
      navigate(from, { replace: true });
    } else if (isAuthenticated && user?.role === 'TEAM_LEADER') {
      const from = (location.state as any)?.from?.pathname || '/team-leader/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setError('Please enter your manager username, email, or phone number.');
      return;
    }

    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setLoading(true);

    try {
      // Direct call to manager login endpoint which enforces REPORTING_MANAGER role
      const res = await api.post<LoginResponse>('/auth/manager/login/', {
        username: trimmedIdentifier,
        password: password,
      });

      const data = res.data;

      if (!data?.access || !data?.user) {
        throw new Error('Invalid response structure received from authentication server.');
      }

      // Security check: ensure role is strictly REPORTING_MANAGER or TEAM_LEADER
      if (!['REPORTING_MANAGER', 'TEAM_LEADER'].includes(data.user.role)) {
        throw new Error('Access denied: Account is not configured with Manager or Team Leader privileges.');
      }

      // Save tokens & user session
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.company_slug) {
        localStorage.setItem('attendance_company_slug', data.user.company_slug);
      }

      // Update AuthContext
      login(data);

      // Role-based redirection
      if (data.user.role === 'TEAM_LEADER') {
        const from = (location.state as any)?.from?.pathname || '/team-leader/dashboard';
        navigate(from, { replace: true });
      } else {
        const from = (location.state as any)?.from?.pathname || '/manager/dashboard';
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      console.error('Manager login failed:', err);

      let msg = 'Unable to sign in. Please verify your credentials and try again.';

      if (err.response?.data) {
        const d = err.response.data;
        if (typeof d === 'string') {
          msg = d;
        } else if (d.error) {
          msg = d.error;
        } else if (d.detail) {
          msg = d.detail;
        } else if (d.non_field_errors && Array.isArray(d.non_field_errors)) {
          msg = d.non_field_errors.join(' ');
        } else {
          // Flatten any field errors
          const firstKey = Object.keys(d)[0];
          if (firstKey && Array.isArray(d[firstKey])) {
            msg = `${firstKey}: ${d[firstKey].join(' ')}`;
          } else if (firstKey) {
            msg = String(d[firstKey]);
          }
        }
      } else if (err.message) {
        msg = err.message;
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manager-login-page">
      {/* LEFT BRANDING HERO BANNER */}
      <div className="manager-login-banner">
        <div className="manager-banner-header">
          <div className="manager-banner-logo-badge">
            <Shield size={24} />
          </div>
          <div className="manager-banner-company">Attendance Management</div>
        </div>

        <div className="manager-banner-content">
          <span className="manager-banner-badge">
            <Users size={14} /> Team Leadership Portal
          </span>
          <h1>Empower Your Team. Oversee Operations.</h1>
          <p>
            Dedicated portal for Reporting Managers and Team Leaders to monitor live attendance,
            review team schedules, inspect leave requests, and maintain high operational efficiency.
          </p>

          <div className="manager-banner-features">
            <div className="manager-banner-feat">
              <span className="manager-banner-feat-bullet">
                <CheckCircle2 size={14} />
              </span>
              <span>Live daily check-in / check-out status of assigned team members</span>
            </div>
            <div className="manager-banner-feat">
              <span className="manager-banner-feat-bullet">
                <CheckCircle2 size={14} />
              </span>
              <span>Departmental roster tracking and shifts oversight</span>
            </div>
            <div className="manager-banner-feat">
              <span className="manager-banner-feat-bullet">
                <CheckCircle2 size={14} />
              </span>
              <span>Real-time team attendance summaries and punctual reporting</span>
            </div>
          </div>
        </div>

        <div className="manager-banner-footer">
          <span>&copy; {new Date().getFullYear()} Yaazh 360 HRMS &bull; All rights reserved</span>
        </div>
      </div>

      {/* RIGHT LOGIN FORM CONTAINER */}
      <div className="manager-login-form-container">
        <div className="manager-login-box">
          <div className="manager-login-box-header">
            <div className="manager-role-tag">
              <Users size={14} />
              <span>Reporting Manager</span>
            </div>
            <h2>Manager Sign In</h2>
            <p>Access your team dashboard using your designated manager credentials.</p>
          </div>

          {error && (
            <div className="manager-login-error" role="alert">
              <AlertCircle size={18} className="manager-error-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* IDENTIFIER FIELD */}
            <div className="manager-form-group">
              <label htmlFor="manager-identifier">Username, Email, or Phone</label>
              <div className="manager-input-wrap">
                <User size={18} className="manager-input-icon" />
                <input
                  id="manager-identifier"
                  type="text"
                  placeholder="e.g. naveen_kumar or naveen@company.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* PASSWORD FIELD */}
            <div className="manager-form-group">
              <div className="manager-label-row">
                <label htmlFor="manager-password">Password</label>
              </div>
              <div className="manager-input-wrap">
                <Lock size={18} className="manager-input-icon" />
                <input
                  id="manager-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your manager password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="manager-password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              className="manager-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="manager-spinner" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Team Portal</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* FOOTER HELPER */}
          <div className="manager-login-footer">
            <p className="manager-footer-hint">
              Need HR administrator access instead?{' '}
              <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
                Go to Portal Selection
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerLogin;

