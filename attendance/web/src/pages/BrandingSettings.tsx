import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Building2,
  ImagePlus,
  Save,
  Copy,
  ExternalLink,
  Palette,
  RefreshCw,
} from 'lucide-react'
import api from '../services/api'
import { CustomSelect } from '../components/CustomSelect'
import './BrandingSettings.css'

interface Company {
  id: number
  name: string
  slug: string | null
  status: boolean
}

interface Branding {
  name: string
  slug: string
  logo: string | null
  login_background?: string | null
  tagline: string
  primary_color: string
  left_panel_heading: string
  left_panel_content: string
  footer_message: string
  left_panel_color: string
  login_button_color: string
  status?: boolean
}

const DEFAULT_PANEL_COLOR = '#315C55'
const DEFAULT_BUTTON_COLOR = '#E56717'

const BrandingSettings = () => {
  const [searchParams] = useSearchParams()
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyId, setCompanyId] = useState('')
  const [branding, setBranding] = useState<Branding | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const apiOrigin = useMemo(
    () => (api.defaults.baseURL || '').replace(/\/api\/?$/, ''),
    [],
  )

  const mediaUrl = (value: string | null | undefined) => {
    if (!value) return ''
    if (/^https?:\/\//i.test(value)) return value
    return `${apiOrigin}${value.startsWith('/') ? '' : '/'}${value}`
  }

  useEffect(() => {
    let active = true

    api.get('/companies/')
      .then((response) => {
        if (!active) return

        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.results || []

        const available = data.filter((item: Company) => item.status)
        setCompanies(available)

        if (available.length) {
          const requestedId = searchParams.get('company')
          const requestedCompany = available.find(
            (item: Company) => String(item.id) === requestedId,
          )
          setCompanyId(String(requestedCompany?.id ?? available[0].id))
        } else {
          setError('No active companies found.')
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.response?.data?.detail || 'Unable to load companies.')
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [searchParams])

  useEffect(() => {
    if (!companyId) {
      setBranding(null)
      return
    }

    let active = true
    setLoading(true)
    setError('')
    setMessage('')
    setLogoFile(null)
    setLogoPreview('')
    setBranding(null)

    api.get(`/companies/${companyId}/branding/`)
      .then((response) => {
        if (active) {
          const data = response.data as Branding
          setBranding({
            ...data,
            left_panel_heading: data.left_panel_heading || '',
            left_panel_content: data.left_panel_content || '',
            footer_message: data.footer_message || '',
            left_panel_color: data.left_panel_color || DEFAULT_PANEL_COLOR,
            login_button_color: data.login_button_color || DEFAULT_BUTTON_COLOR,
          })
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.detail ||
            'Unable to load branding settings. Check Super Admin access.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [companyId])

  useEffect(() => {
    return () => {
      if (logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview)
      }
    }
  }, [logoPreview])

  const update = (field: keyof Branding, value: string) => {
    setBranding((current) =>
      current ? { ...current, [field]: value } : current,
    )
    setMessage('')
  }

  const handleLogo = (file?: File) => {
    if (!file || !branding) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Logo image must be 5 MB or less.')
      return
    }

    setError('')
    setMessage('')
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const reloadBranding = async () => {
    if (!companyId) return

    setLoading(true)
    setError('')
    setMessage('')
    setLogoFile(null)
    setLogoPreview('')

    try {
      const response = await api.get(`/companies/${companyId}/branding/`)
      const data = response.data as Branding

      setBranding({
        ...data,
        left_panel_heading: data.left_panel_heading || '',
        left_panel_content: data.left_panel_content || '',
        footer_message: data.footer_message || '',
        left_panel_color: data.left_panel_color || DEFAULT_PANEL_COLOR,
            login_button_color: data.login_button_color || DEFAULT_BUTTON_COLOR,
      })
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        'Unable to reload branding settings. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }
  const refreshCompaniesAndBranding = async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await api.get('/companies/')
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.results || []
      const available = data.filter((item: Company) => item.status)
      setCompanies(available)

      if (!available.length) {
        setCompanyId('')
        setBranding(null)
        setError('No active companies found.')
        return
      }

      const selectedStillExists = available.some(
        (item: Company) => String(item.id) === companyId
      )
      const nextId = selectedStillExists ? companyId : String(available[0].id)
      if (nextId !== companyId) {
        setCompanyId(nextId)
        return
      }

      await reloadBranding()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to refresh companies.')
    } finally {
      setLoading(false)
    }
  }
  const handleSave = async () => {
    if (!branding || !companyId) return

    if (!/^#[0-9a-fA-F]{6}$/.test(branding.left_panel_color)) {
      setError('Enter a valid left-panel hex colour, such as #315C55.')
      return
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(branding.login_button_color || '')) {
      setError('Enter a valid login-button hex colour, such as #E56717.')
      return
    }

    if (!branding.name.trim()) {
      setError('Company name is required.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const form = new FormData()
      form.append('name', branding.name.trim())
      form.append('tagline', branding.tagline || '')
      form.append('primary_color', branding.primary_color || DEFAULT_BUTTON_COLOR)
      form.append('left_panel_heading', branding.left_panel_heading || '')
      form.append('left_panel_content', branding.left_panel_content || '')
      form.append('footer_message', branding.footer_message || '')
      form.append('left_panel_color', branding.left_panel_color)
      form.append('login_button_color', branding.login_button_color || DEFAULT_BUTTON_COLOR)

      if (logoFile) {
        form.append('logo', logoFile)
      }

      const response = await api.patch(
        `/companies/${companyId}/branding/`,
        form,
      )

      setBranding({
        ...response.data,
        left_panel_heading: response.data.left_panel_heading || '',
        left_panel_content: response.data.left_panel_content || '',
        footer_message: response.data.footer_message || '',
        left_panel_color: response.data.left_panel_color || DEFAULT_PANEL_COLOR,
        login_button_color: response.data.login_button_color || DEFAULT_BUTTON_COLOR,
      })
      setLogoFile(null)
      setLogoPreview('')
      setMessage('Company login branding saved successfully.')
    } catch (err: any) {
      const data = err.response?.data

      if (data && typeof data === 'object') {
        setError(
          Object.entries(data)
            .map(([key, value]) =>
              `${key}: ${Array.isArray(value) ? value.join(' ') : String(value)}`,
            )
            .join(' | '),
        )
      } else {
        setError('Unable to save settings. Check your connection and permissions.')
      }
    } finally {
      setSaving(false)
    }
  }

  const loginUrl = branding?.slug
    ? `${window.location.origin}/${branding.slug}/login`
    : ''

  const copyLoginUrl = async () => {
    if (!loginUrl) return

    try {
      await navigator.clipboard.writeText(loginUrl)
      setMessage('Company login URL copied.')
      setError('')
    } catch {
      setError('Copy failed. Select and copy the login URL manually.')
    }
  }

  const panelColor = /^#[0-9a-fA-F]{6}$/.test(branding?.left_panel_color || '')
    ? branding!.left_panel_color
    : DEFAULT_PANEL_COLOR

  if (loading && !companies.length) {
    return (
      <main className="branding-page">
        <p className="branding-muted">Loading branding settings...</p>
      </main>
    )
  }

  return (
    <main className="branding-page">
      <header className="branding-heading">
        <div>
          <span className="branding-eyebrow">SUPER ADMIN</span>
          <h1>Login Branding</h1>
          <p>Customise the company login experience from one place.</p>
        </div>
        <div className="branding-heading-icon">
          <Palette size={25} />
        </div>
      </header>

      {error && (
        <div className="branding-alert branding-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="branding-alert branding-success" role="status">
          {message}
        </div>
      )}

      <section className="branding-panel">
        <label className="branding-label">
          Select company
        </label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <CustomSelect
              value={companyId}
              onChange={setCompanyId}
              options={companies.map((c) => ({ value: String(c.id), label: c.name }))}
              placeholder="Select company..."
              searchPlaceholder="Search companies..."
              icon={<Building2 size={17} />}
            />
          </div>
          <button
            type="button"
            className="branding-icon-button"
            title="Refresh company list and branding"
            onClick={refreshCompaniesAndBranding}
            disabled={!companyId || loading}
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </section>

      {loading && (
        <p className="branding-muted">Loading selected company...</p>
      )}

      {!loading && branding && (
        <div className="branding-grid">
          <section className="branding-panel branding-form-panel">
            <h2>Company login content</h2>
            <p className="branding-muted">
              Changes apply to this company only. The right-side login form
              keeps its standard design.
            </p>

            <label className="branding-label" htmlFor="brand-name">
              Company name
            </label>
            <input
              id="brand-name"
              className="branding-input"
              value={branding.name}
              onChange={(event) => update('name', event.target.value)}
              maxLength={255}
              required
            />

            <label className="branding-label" htmlFor="brand-heading">
              Left panel heading
            </label>
            <input
              id="brand-heading"
              className="branding-input"
              value={branding.left_panel_heading}
              onChange={(event) =>
                update('left_panel_heading', event.target.value)
              }
              maxLength={255}
              placeholder="Welcome to your workplace"
            />

            <label className="branding-label" htmlFor="brand-content">
              Supporting content
            </label>
            <textarea
              id="brand-content"
              className="branding-input branding-textarea"
              value={branding.left_panel_content}
              onChange={(event) =>
                update('left_panel_content', event.target.value)
              }
              rows={4}
              placeholder="Write the message shown below the heading..."
            />

            <label className="branding-label" htmlFor="brand-footer">
              Footer message
            </label>
            <input
              id="brand-footer"
              className="branding-input"
              value={branding.footer_message}
              onChange={(event) =>
                update('footer_message', event.target.value)
              }
              maxLength={255}
              placeholder="A short footer message"
            />

            <label className="branding-label" htmlFor="brand-tagline">
              Company tagline (optional)
            </label>
            <input
              id="brand-tagline"
              className="branding-input"
              value={branding.tagline || ''}
              onChange={(event) => update('tagline', event.target.value)}
              maxLength={255}
              placeholder="Short company identity"
            />

            <div className="branding-section-divider" />

            <h3>Left panel colour</h3>
            <p className="branding-muted">
              Only the left panel changes. The Sign In button uses a separate
              fixed colour.
            </p>

            <label className="branding-label" htmlFor="left-panel-color">
              Choose left panel colour
            </label>
            <div className="branding-color-row">
              <input
                id="left-panel-color"
                type="color"
                value={panelColor}
                onChange={(event) =>
                  update('left_panel_color', event.target.value.toUpperCase())
                }
                aria-label="Choose left panel colour"
              />
              <input
                className="branding-input"
                value={branding.left_panel_color || DEFAULT_PANEL_COLOR}
                onChange={(event) =>
                  update('left_panel_color', event.target.value)
                }
                maxLength={7}
                placeholder="#315C55"
              />
            </div>

            <h3>Sign In button colour</h3>
            <p className="branding-muted">
              This colour applies to the selected company login page only.
            </p>
            <label className="branding-label" htmlFor="login-button-color">
              Choose Sign In button colour
            </label>
            <div className="branding-color-row">
              <input
                id="login-button-color"
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(branding.login_button_color || '') ? branding.login_button_color : DEFAULT_BUTTON_COLOR}
                onChange={(event) => update('login_button_color', event.target.value.toUpperCase())}
                aria-label="Choose Sign In button colour"
              />
              <input
                className="branding-input"
                value={branding.login_button_color || DEFAULT_BUTTON_COLOR}
                onChange={(event) => update('login_button_color', event.target.value)}
                maxLength={7}
                placeholder="#E56717"
              />
            </div>
            <label className="branding-label" htmlFor="brand-logo">
              Company logo
            </label>
            <label className="branding-upload" htmlFor="brand-logo">
              <ImagePlus size={22} />
              <span>{logoFile?.name || 'Choose company logo'}</span>
              <small>PNG, JPG or WebP  Max 5 MB</small>
            </label>
            <input
              id="brand-logo"
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => handleLogo(event.target.files?.[0])}
            />

            {(logoPreview || branding.logo) && (
              <div className="branding-logo-preview-wrap">
                <img
                  className="branding-logo-preview"
                  src={logoPreview || mediaUrl(branding.logo)}
                  alt="Company logo preview"
                />
              </div>
            )}

            <button
              type="button"
              className="branding-save-button"
              onClick={handleSave}
              disabled={saving || !branding.name.trim()}
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save login branding'}
            </button>
          </section>

          <section className="branding-panel branding-preview-panel">
            <h2>Live login preview</h2>
            <p className="branding-muted">
              Preview the layout before saving your settings.
            </p>

            <div className="branding-live-preview">
              <div
                className="branding-preview-left"
                style={{ backgroundColor: panelColor }}
              >
                {(logoPreview || branding.logo) && (
                  <img
                    className="branding-preview-logo"
                    src={logoPreview || mediaUrl(branding.logo)}
                    alt={`${branding.name} logo`}
                  />
                )}
                <span className="branding-preview-company">
                  {branding.name || 'Company name'}
                </span>
                <div className="branding-preview-copy">
                  <h3>
                    {branding.left_panel_heading ||
                      branding.tagline ||
                      'Welcome to your workplace'}
                  </h3>
                  <p>
                    {branding.left_panel_content ||
                      'Your company message will appear here.'}
                  </p>
                </div>
                <small className="branding-preview-footer">
                  {branding.footer_message}
                </small>
              </div>

              <div className="branding-preview-right">
                <div className="branding-preview-form">
                  <span className="branding-preview-eyebrow">
                    YOUR WORKSPACE
                  </span>
                  <h3>Welcome back</h3>
                  <p>Sign in to your account</p>
                  <div className="branding-preview-field">
                    Username, email or phone
                  </div>
                  <div className="branding-preview-field">
                    Password
                  </div>
                  <div
                    className="branding-preview-login"
                    style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(branding.login_button_color || "") ? branding.login_button_color : DEFAULT_BUTTON_COLOR }}
                  >
                    Sign In
                  </div>
                </div>
              </div>
            </div>

            <label className="branding-label" htmlFor="company-login-url">
              Company login URL
            </label>
            <div className="branding-url-row">
              <input
                id="company-login-url"
                className="branding-input"
                readOnly
                value={loginUrl}
              />
              <button
                type="button"
                className="branding-icon-button"
                onClick={copyLoginUrl}
                title="Copy login URL"
                disabled={!loginUrl}
              >
                <Copy size={17} />
              </button>
              <button
                type="button"
                className="branding-icon-button"
                onClick={() =>
                  window.open(loginUrl, '_blank', 'noopener,noreferrer')
                }
                title="Open login page"
                disabled={!loginUrl}
              >
                <ExternalLink size={17} />
              </button>
            </div>

            <p className="branding-muted">
              Each company has its own branding. The company slug determines
              its login URL.
            </p>
          </section>
        </div>
      )}
    </main>
  )
}

export default BrandingSettings


