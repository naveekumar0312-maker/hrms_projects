import { useContext, useEffect, useState, type FormEvent, type CSSProperties } from 'react'
import { Eye, EyeOff, Lock, User as UserIcon, LockKeyhole, UserRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import api from '../api/index'
import './UniversalLogin.css'

interface UniversalLoginProps {
  loginMode?: 'super-admin' | 'hr' | 'manager' | 'general'
}

interface CompanyBranding {
  slug: string
  name: string
  logo?: string | null
  login_background?: string | null
  tagline?: string
  primary_color?: string
  left_panel_heading?: string
  left_panel_content?: string
  footer_message?: string
  left_panel_color?: string
  login_button_color?: string
  status: boolean
}

const DEFAULT_PANEL_COLOR = '#315C55'
const DEFAULT_BUTTON_COLOR = '#E56717'

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

  // Company Branding state (used when companySlug is present)
  const [brandingLoading, setBrandingLoading] = useState(!!companySlug)
  const [branding, setBranding] = useState<CompanyBranding | null>(null)
  const [brandingError, setBrandingError] = useState('')

  useEffect(() => {
    let cancelled = false

    if (!companySlug) {
      setBranding(null)
      setBrandingError('')
      setBrandingLoading(false)
      return
    }

    setBrandingLoading(true)
    setBrandingError('')
    setBranding(null)

    api.get(`/companies/public/${encodeURIComponent(companySlug)}/branding/`)
      .then((response) => {
        if (cancelled) return
        const data = response.data as CompanyBranding

        if (!data?.slug || data.slug !== companySlug || data.status !== true) {
          setBrandingError('This company login page is unavailable.')
          return
        }

        setBranding(data)
      })
      .catch((err: any) => {
        if (cancelled) return
        setBrandingError(
          err?.response?.status === 404
            ? 'Company not found. Please check your login link.'
            : 'Unable to load company login settings. Please try again later.'
        )
      })
      .finally(() => {
        if (!cancelled) setBrandingLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companySlug])

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

      // If logging into a specific company, verify tenant match if user has company assigned
      if (companySlug && user?.company) {
        const userCompanySlug =
          typeof user.company === 'object'
            ? user.company.slug || user.company_slug
            : user.company_slug

        if (userCompanySlug && userCompanySlug !== companySlug) {
          setError('Your account does not belong to this company.')
          return
        }
      }

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

  // ==========================================================
  // BRANDED LOGIN VIEW (Used when URL has /:companySlug/login)
  // ==========================================================
  if (companySlug) {
    if (brandingLoading) {
      return (
        <main className="universal-login login-status-page">
          <div className="login-status-message">Loading company login...</div>
        </main>
      )
    }

    if (brandingError) {
      return (
        <main className="universal-login login-status-page">
          <div className="login-status-message">
            <h1>Login unavailable</h1>
            <p>{brandingError}</p>
          </div>
        </main>
      )
    }

    const logoUrl = (() => {
      const raw = branding?.logo?.trim()
      if (!raw) return ''
      const markdownMatch = raw.match(/^\[(https?:\/\/[^\]]+)\]\((https?:\/\/[^)]+)\)$/i)
      const value = markdownMatch ? markdownMatch[2] : raw
      if (/^https?:\/\//i.test(value)) return value
      const base = (api.defaults.baseURL || window.location.origin)
        .replace(/\/api\/?$/, '')
        .replace(/\/+$/, '')
      return `${base}/${value.replace(/^\/+/, '')}`
    })()

    const panelColor = /^#[0-9a-fA-F]{6}$/.test(branding?.left_panel_color || '')
      ? branding!.left_panel_color!
      : DEFAULT_PANEL_COLOR

    const buttonColor = /^#[0-9a-fA-F]{6}$/.test(branding?.login_button_color || '')
      ? branding!.login_button_color!
      : DEFAULT_BUTTON_COLOR

    return (
      <main className="universal-login">
        <section
          className="login-brand-panel"
          style={{ '--brand-panel-color': panelColor } as CSSProperties}
        >
          <div className="login-brand-inner">
            {logoUrl && (
              <img
                className="login-company-logo"
                style={{
                  display: 'block',
                  visibility: 'visible',
                  opacity: 1,
                  width: 'auto',
                  height: 'auto',
                  minWidth: '120px',
                  minHeight: '40px',
                }}
                src={logoUrl}
                alt={`${branding?.name || 'Company'} logo`}
                onError={(event) => {
                  console.error('Company logo failed to load:', event.currentTarget.src)
                  event.currentTarget.style.display = 'none'
                }}
              />
            )}

            {branding?.name && (
              <p className="login-company-name">{branding.name}</p>
            )}

            <div className="login-brand-copy">
              <h1>
                {branding?.left_panel_heading ||
                  branding?.tagline ||
                  'Welcome to your workplace'}
              </h1>
              <p>
                {branding?.left_panel_content ||
                  'One place to manage your workday and stay connected with your team.'}
              </p>
            </div>

            <div className="login-brand-footer">
              {branding?.footer_message || ''}
            </div>
          </div>
        </section>

        <section className="login-form-panel">
          <div className="login-form-container">
            <div className="login-heading">
              <span className="login-eyebrow">YOUR WORKSPACE</span>
              <h2>Welcome back</h2>
              <p>Sign in to your account</p>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <form className="login-form" onSubmit={handleLogin}>
              <div className="login-field">
                <label htmlFor="branded-identifier">Username, email or phone</label>
                <div className="login-input-wrapper">
                  <UserRound className="login-input-icon" size={19} />
                  <input
                    id="branded-identifier"
                    name="username"
                    type="text"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="Enter your username or phone"
                    autoComplete="username"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="branded-password">Password</label>
                <div className="login-input-wrapper">
                  <LockKeyhole className="login-input-icon" size={19} />
                  <input
                    id="branded-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={loading}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              <div className="login-options">
                <span />
                <button
                  type="button"
                  className="login-forgot"
                  onClick={() =>
                    setError('Please contact your administrator to reset your password.')
                  }
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className="login-submit"
                disabled={loading}
                style={{ backgroundColor: buttonColor }}
              >
                {loading ? <span className="login-spinner" /> : 'Sign In'}
              </button>
            </form>
          </div>
        </section>
      </main>
    )
  }

  // ==========================================================
  // UNIVERSAL SPLIT LOGIN VIEW (Used for /login, /super-admin/login, /manager/login)
  // ==========================================================
  return (
    <div className="login-screen-split">
      {/* LEFT ARCH HERO WITH CLEAN UNSPLASH TEAM IMAGE */}
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
              <label htmlFor="identifier" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
                Username
              </label>
              <UserIcon className="login-split-icon" size={18} strokeWidth={2} />
              <input
                id="identifier"
                name="username"
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
              <label htmlFor="password" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
                Password
              </label>
              <Lock className="login-split-icon" size={18} strokeWidth={2} />
              <input
                id="password"
                name="password"
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
