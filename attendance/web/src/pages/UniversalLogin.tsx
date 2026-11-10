import { useContext, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock, User as UserIcon } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import api from '../api/index'
import './UniversalLogin.css'

interface UniversalLoginProps {
  loginMode?: 'super-admin' | 'hr' | 'manager' | 'general'
}

const UniversalLogin = ({ loginMode = 'general' }: UniversalLoginProps) => {
  const navigate = useNavigate()
  const { companySlug } = useParams<{ companySlug?: string }>()
  const { login } = useContext(AuthContext)

  const [identifier, setIdentifier] = useState(
    () => localStorage.getItem('attendance_remembered_identifier') || ''
  )
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your username and password.')
      return
    }

    try {
      setLoading(true)
      setError('')

      const value = identifier.trim()
      const isPhone = /^\d+$/.test(value)
      const credentials = isPhone
        ? { phone_number: value, password }
        : { username: value, password }

      const payload = {
        ...credentials,
        target_portal: loginMode,
        ...(companySlug ? { company_slug: companySlug } : {}),
      }

      const response = await api.post('/auth/login/', payload)
      const user = response.data?.user || response.data

      // Save identifier for convenience
      localStorage.setItem('attendance_remembered_identifier', value)

      const assignedSlug =
        user?.company_slug ||
        (typeof user?.company === 'object' ? user?.company?.slug : null)

      const activeSlug = companySlug || assignedSlug
      if (activeSlug) {
        localStorage.setItem('attendance_company_slug', activeSlug)
      } else {
        localStorage.removeItem('attendance_company_slug')
      }

      login(response.data)

      // Role-based redirection
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
        navigate('/super-admin/dashboard')
      } else if (user?.role === 'HR') {
        const hrTargetSlug = activeSlug || 'company'
        navigate(`/${encodeURIComponent(hrTargetSlug)}/hr/dashboard`)
      } else if (user?.role === 'REPORTING_MANAGER') {
        navigate('/manager/dashboard')
      } else if (user?.role === 'TEAM_LEADER' || user?.role === 'EMPLOYEE') {
        navigate('/dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      let msg = 'Unable to sign in. Please verify your credentials and try again.'

      if (err.response?.data) {
        const d = err.response.data
        if (typeof d === 'string') {
          msg = d
        } else if (d.detail) {
          msg = Array.isArray(d.detail) ? d.detail.join(' ') : String(d.detail)
        } else if (d.error) {
          msg = Array.isArray(d.error) ? d.error.join(' ') : String(d.error)
        } else if (d.message) {
          msg = Array.isArray(d.message) ? d.message.join(' ') : String(d.message)
        } else if (d.non_field_errors) {
          msg = Array.isArray(d.non_field_errors)
            ? d.non_field_errors.join(' ')
            : String(d.non_field_errors)
        } else {
          const firstKey = Object.keys(d)[0]
          if (firstKey) {
            const val = d[firstKey]
            msg = Array.isArray(val) ? val.join(' ') : String(val)
          }
        }
      } else if (err.message) {
        msg = err.message
      }

      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen-split">
      {/* LEFT ARCH HERO WITH CLEAN UNSPLASH TEAM IMAGE (No badges/overlays) */}
      <div className="login-left-hero-wrapper">
        <div className="login-hero-arch-mask">
          <img
            src="/branding/office-team-unsplash.jpg"
            alt="Office Team"
            className="login-hero-arch-image"
          />
        </div>
      </div>

      {/* RIGHT LOGIN FORM */}
      <div className="login-right-content-wrapper">
        <div className="login-form-inner-container">
          {/* Title Header */}
          <div className="login-welcome-header">
            <h1 className="login-welcome-title">Welcome to Hrms !</h1>
            <p className="login-welcome-subtitle">Please Login to your Account</p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="login-split-error-box" role="alert">
              {error}
            </div>
          )}

          {/* Clean Form */}
          <form className="login-split-form" onSubmit={handleLogin}>
            {/* Username Input with underline */}
            <div className="login-split-field-row">
              <UserIcon className="login-split-icon" size={18} strokeWidth={2} />
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                disabled={loading}
                autoFocus
                required
                className="login-split-input"
              />
            </div>

            {/* Password Input with underline */}
            <div className="login-split-field-row">
              <Lock className="login-split-icon" size={18} strokeWidth={2} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                disabled={loading}
                required
                className="login-split-input"
              />
              <button
                type="button"
                className="login-split-pwd-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Bottom Row: Forgot Password & Submit Pill */}
            <div className="login-split-action-row">
              <button
                type="button"
                className="login-split-forgot-btn"
                onClick={() =>
                  setError(
                    'Please contact your organization administrator or HR to reset your password.'
                  )
                }
              >
                Forgot your Password ?
              </button>

              <button
                type="submit"
                className="login-split-submit-pill"
                disabled={loading}
              >
                {loading ? <span className="login-split-spinner" /> : 'Login'}
              </button>
            </div>
          </form>

          {/* Right Bottom Powered By Logo */}
          <div className="login-split-footer">
            <span className="login-split-footer-text">Powered by</span>
            <img
              src="/branding/yaazh360-logo-transparent.png"
              alt="Yaazh 360"
              className="login-split-footer-img"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default UniversalLogin
