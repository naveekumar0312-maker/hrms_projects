import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Pencil, Trash2, Search, RefreshCw, Palette, Building2 } from 'lucide-react'
import api from '../services/api'

interface Company {
  id: number
  name: string
  slug: string | null
  status: boolean
  branding_configured: boolean
  logo?: string | null
  tagline?: string
  primary_color?: string
  left_panel_color?: string
  login_button_color?: string
  left_panel_heading?: string
  left_panel_content?: string
  footer_message?: string
}

const CompanyBrandingList = () => {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Company | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const apiOrigin = useMemo(
    () => (api.defaults.baseURL || '').replace(/\/api\/?$/, ''),
    [],
  )

  const mediaUrl = (value?: string | null) => {
    if (!value) return ''
    if (/^https?:\/\//i.test(value)) return value
    return `${apiOrigin}${value.startsWith('/') ? '' : '/'}${value}`
  }

  const loadCompanies = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/companies/')
      const data: Company[] = Array.isArray(response.data)
        ? response.data
        : response.data?.results || []
      setCompanies(data.filter((company) => company.branding_configured))
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to load company branding list.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCompanies()
  }, [])

  const deleteBranding = async (company: Company) => {
    const confirmed = window.confirm(
      `Remove branding configuration for "${company.name}"? The company, branches and employees will not be deleted.`,
    )
    if (!confirmed) return

    setBusyId(company.id)
    setError('')
    try {
      await api.delete(`/companies/${company.id}/branding/`)
      setSelected(null)
      await loadCompanies()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to remove branding configuration.')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = companies.filter((company) =>
    `${company.name} ${company.slug || ''}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div style={{ padding: '28px', maxWidth: 1400, margin: '0 auto', color: 'var(--text-primary, #1f2937)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 750 }}>Company Branding List</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary, #6b7280)' }}>
            Manage login branding configurations without deleting company records.
          </p>
        </div>
        <button type="button" onClick={() => void loadCompanies()} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 9, background: 'white', cursor: 'pointer' }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', flex: '1 1 260px', maxWidth: 440 }}>
          <Search size={18} color="#6b7280" />
          <input value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Search company or slug..." style={{ border: 0, outline: 0, width: '100%', background: 'transparent' }} />
        </div>
        <span style={{ color: '#6b7280', fontSize: 14 }}>{filtered.length} configured {filtered.length === 1 ? 'company' : 'companies'}</span>
      </div>

      {error && <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading branding configurations...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: 14 }}>
          <Palette size={32} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 8px' }}>No branding configurations found</h3>
          <p style={{ color: '#6b7280', margin: '0 0 18px' }}>
            Save a company in Branding &amp; Settings to make it appear here.
          </p>
          <button type="button" onClick={() => navigate('/admin/branding-settings')}
            style={{ border: 0, borderRadius: 9, padding: '11px 16px', background: '#e56717', color: 'white', cursor: 'pointer' }}>
            Open Branding &amp; Settings
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 12, background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                {['Company', 'Login slug', 'Brand colours', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} style={{ padding: '14px 16px', fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e5e7eb' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((company) => (
                <tr key={company.id}>
                  <td style={{ padding: '15px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {company.logo ? (
                        <img src={mediaUrl(company.logo)} alt="" style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      ) : (
                        <div style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 8, background: '#fff7ed', color: '#c2410c' }}><Building2 size={20} /></div>
                      )}
                      <div>
                        <div style={{ fontWeight: 650 }}>{company.name}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{company.tagline || 'No tagline'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '15px 16px', borderBottom: '1px solid #f1f5f9' }}>{company.slug || ''}</td>
                  <td style={{ padding: '15px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[company.primary_color || '#E56717', company.left_panel_color || '#E56108', company.login_button_color || '#2563EB'].map((color, index) => (
                        <span key={index} title={color} style={{ width: 22, height: 22, borderRadius: 6, background: color, border: '1px solid #e5e7eb' }} />
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '15px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ padding: '5px 9px', borderRadius: 20, fontSize: 12, background: company.status ? '#dcfce7' : '#fee2e2', color: company.status ? '#166534' : '#991b1b' }}>
                      {company.status ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '15px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', gap: 7 }}>
                      <button type="button" title="View branding" onClick={() => setSelected(company)}
                        style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 7, background: 'white', cursor: 'pointer' }}><Eye size={16} /></button>
                      <button type="button" title="Edit branding" onClick={() => navigate(`/admin/branding-settings?company=${company.id}`)}
                        style={{ padding: 8, border: '1px solid #fed7aa', borderRadius: 7, background: '#fff7ed', color: '#c2410c', cursor: 'pointer' }}><Pencil size={16} /></button>
                      <button type="button" title="Remove branding" disabled={busyId === company.id} onClick={() => void deleteBranding(company)}
                        style={{ padding: 8, border: '1px solid #fecaca', borderRadius: 7, background: '#fef2f2', color: '#b91c1c', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div role="presentation" onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.55)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <section role="dialog" aria-modal="true" aria-label="Company branding details" onClick={(event) => event.stopPropagation()}
            style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', background: 'white', borderRadius: 14, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>{selected.name}</h2>
                <p style={{ margin: '6px 0 0', color: '#6b7280' }}>Branding details</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Close</button>
            </div>
            {selected.logo && <img src={mediaUrl(selected.logo)} alt={`${selected.name} logo`} style={{ maxWidth: 160, maxHeight: 90, objectFit: 'contain', margin: '20px 0' }} />}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1fr) 2fr', gap: 12, marginTop: 22, fontSize: 14 }}>
              <strong>Slug</strong><span>{selected.slug || ''}</span>
              <strong>Tagline</strong><span>{selected.tagline || ''}</span>
              <strong>Panel heading</strong><span>{selected.left_panel_heading || ''}</span>
              <strong>Panel content</strong><span>{selected.left_panel_content || ''}</span>
              <strong>Footer</strong><span>{selected.footer_message || ''}</span>
              <strong>Primary colour</strong><span>{selected.primary_color || ''}</span>
              <strong>Panel colour</strong><span>{selected.left_panel_color || ''}</span>
              <strong>Button colour</strong><span>{selected.login_button_color || ''}</span>
              <strong>Status</strong><span>{selected.status ? 'Active' : 'Inactive'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'end', marginTop: 24 }}>
              <button type="button" onClick={() => navigate(`/admin/branding-settings?company=${selected.id}`)}
                style={{ display: 'flex', gap: 8, alignItems: 'center', border: 0, borderRadius: 9, padding: '10px 14px', background: '#e56717', color: 'white', cursor: 'pointer' }}>
                <Pencil size={16} /> Edit branding
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default CompanyBrandingList
