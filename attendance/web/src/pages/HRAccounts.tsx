import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, ShieldCheck, RefreshCw, Search, X } from 'lucide-react';
import api from '../services/api';
import { CustomSelect } from '../components/CustomSelect';

interface HRAccount {
  id: number;
  username: string;
  phone_number: string | null;
  role: string;
  company_id: number | null;
  is_active: boolean;
}

interface Company {
  id: number;
  name: string;
  status: boolean;
}

const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  border: '1px solid var(--border, #d1d5db)',
  borderRadius: '8px',
  background: 'var(--surface, #fff)',
  color: 'var(--text-primary, #111827)',
  boxSizing: 'border-box' as const,
};

const buttonStyle = {
  padding: '9px 13px',
  borderRadius: '8px',
  border: '1px solid var(--border, #d1d5db)',
  cursor: 'pointer',
  fontWeight: 600 as const,
};

const HRAccounts = () => {
  const [accounts, setAccounts] = useState<HRAccount[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HRAccount | null>(null);
  const [form, setForm] = useState({
    username: '',
    password: '',
    company_id: '',
    phone_number: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [hrResponse, companyResponse] = await Promise.all([
        api.get('/auth/hr-accounts/'),
        api.get('/companies/'),
      ]);

      const hrData = hrResponse.data;
      const companyData = companyResponse.data;

      setAccounts(Array.isArray(hrData) ? hrData : hrData?.results ?? []);
      setCompanies(
        (Array.isArray(companyData) ? companyData : companyData?.results ?? [])
          .filter((company: Company) => company.status)
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        'Unable to load HR accounts. Check your Super Admin access and API connection.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ username: '', password: '', company_id: '', phone_number: '' });
    setError('');
    setNotice('');
    setShowForm(true);
  };

  const openEdit = (account: HRAccount) => {
    setEditing(account);
    setForm({
      username: account.username,
      password: '',
      company_id: account.company_id == null ? '' : String(account.company_id),
      phone_number: account.phone_number || '',
    });
    setError('');
    setNotice('');
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!form.username.trim() || !form.company_id) {
      setError('Username and company are required.');
      return;
    }

    if (!editing && form.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    const payload: Record<string, string | number> = {
      username: form.username.trim(),
      company_id: Number(form.company_id),
    };

    if (form.phone_number.trim()) {
      payload.phone_number = form.phone_number.trim();
    }

    if (form.password) {
      payload.password = form.password;
    }

    setSaving(true);

    try {
      if (editing) {
        await api.patch(`/auth/hr-accounts/${editing.id}/`, payload);
        setNotice('HR account updated successfully.');
      } else {
        await api.post('/auth/hr-accounts/', payload);
        setNotice('HR account created successfully.');
      }

      setShowForm(false);
      await loadData();
      setNotice(editing ? 'HR account updated successfully.' : 'HR account created successfully.');
    } catch (err: any) {
      const data = err?.response?.data;
      const message =
        typeof data === 'string'
          ? data
          : data?.detail ||
            Object.entries(data || {})
              .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
              .join('\n') ||
            'Unable to save the HR account.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (account: HRAccount) => {
    const action = account.is_active ? 'deactivate' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${action} ${account.username}?`)) {
      return;
    }

    setError('');
    setNotice('');

    try {
      if (account.is_active) {
        await api.delete(`/auth/hr-accounts/${account.id}/`);
      } else {
        await api.patch(`/auth/hr-accounts/${account.id}/`, { is_active: true });
      }

      setNotice(`HR account ${action}d successfully.`);
      await loadData();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        `Unable to ${action} this HR account.`
      );
    }
  };

  const filteredAccounts = accounts.filter((account) => {
    const companyName = companies.find((company) => company.id === account.company_id)?.name || '';
    const query = search.toLowerCase();
    return (
      account.username.toLowerCase().includes(query) ||
      companyName.toLowerCase().includes(query) ||
      String(account.phone_number || '').includes(query)
    );
  });

  return (
    <div style={{ padding: 'clamp(16px, 3vw, 28px)', maxWidth: 1250, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: 'var(--text-primary, #111827)' }}>HR Accounts</h1>
          <p style={{ margin: '7px 0 0', color: 'var(--text-secondary, #6b7280)' }}>
            Create and manage HR access for each company.
          </p>
        </div>
        <button type="button" onClick={openCreate} style={{ ...buttonStyle, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--primary, #e56108)', color: '#fff', borderColor: 'transparent' }}>
          <Plus size={17} /> Create HR Account
        </button>
      </div>

      {error && (
        <div role="alert" style={{ padding: 13, marginBottom: 16, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}
      {notice && (
        <div role="status" style={{ padding: 13, marginBottom: 16, borderRadius: 8, background: '#eff6ff', color: '#0757B8' }}>
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, maxWidth: 460 }}>
        <Search size={19} color="var(--text-secondary, #6b7280)" />
        <input
          aria-label="Search HR accounts"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search username, phone or company..."
          style={inputStyle}
        />
        <button type="button" title="Refresh accounts" onClick={() => void loadData()} style={buttonStyle}>
          <RefreshCw size={17} />
        </button>
      </div>

      <div style={{ overflowX: 'auto', background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: 'var(--background, #f8fafc)', textAlign: 'left' }}>
              {['Username', 'Company', 'Phone', 'Status', 'Actions'].map((label) => (
                <th key={label} style={{ padding: '14px 16px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-secondary, #6b7280)', borderBottom: '1px solid var(--border, #e5e7eb)' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center' }}>Loading HR accounts...</td></tr>
            ) : filteredAccounts.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary, #6b7280)' }}>No HR accounts found.</td></tr>
            ) : filteredAccounts.map((account) => (
              <tr key={account.id}>
                <td style={{ padding: '15px 16px', borderBottom: '1px solid var(--border, #e5e7eb)', fontWeight: 600 }}>{account.username}</td>
                <td style={{ padding: '15px 16px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                  {companies.find((company) => company.id === account.company_id)?.name || `Company #${account.company_id ?? 'unassigned'}`}
                </td>
                <td style={{ padding: '15px 16px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>{account.phone_number || ''}</td>
                <td style={{ padding: '15px 16px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                  <span style={{ display: 'inline-block', padding: '5px 9px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: account.is_active ? '#dcfce7' : '#fee2e2', color: account.is_active ? '#166534' : '#991b1b' }}>
                    {account.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '15px 16px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => openEdit(account)} style={buttonStyle} title="Edit account">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => void toggleStatus(account)} style={{ ...buttonStyle, color: account.is_active ? '#b91c1c' : '#0757B8' }}>
                      {account.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, color: 'var(--text-secondary, #6b7280)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
        <ShieldCheck size={16} /> Only Super Admin can manage HR accounts. Deactivated accounts cannot sign in.
      </div>

      {showForm && (
        <div role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setShowForm(false);
        }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, .55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="hr-form-title" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface, #fff)', borderRadius: 14, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 id="hr-form-title" style={{ margin: 0, fontSize: 21 }}>{editing ? 'Edit HR Account' : 'Create HR Account'}</h2>
              <button type="button" onClick={() => setShowForm(false)} disabled={saving} aria-label="Close form" style={{ ...buttonStyle, border: 0 }}><X size={19} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
              <label style={{ display: 'grid', gap: 7, fontWeight: 600, fontSize: 14 }}>
                Username *
                <input required autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} style={inputStyle} />
              </label>

              <div style={{ display: 'grid', gap: 7, fontWeight: 600, fontSize: 14 }}>
                <span>Company *</span>
                <CustomSelect
                  value={form.company_id}
                  onChange={(val) => setForm({ ...form, company_id: val })}
                  options={companies.map((c) => ({ value: String(c.id), label: c.name }))}
                  placeholder="Select a company"
                  searchPlaceholder="Search company..."
                />
              </div>

              <label style={{ display: 'grid', gap: 7, fontWeight: 600, fontSize: 14 }}>
                Phone number (optional)
                <input type="tel" autoComplete="tel" value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} style={inputStyle} />
              </label>

              <label style={{ display: 'grid', gap: 7, fontWeight: 600, fontSize: 14 }}>
                {editing ? 'New password (leave blank to keep current)' : 'Password *'}
                <input
                  type="password"
                  autoComplete={editing ? 'new-password' : 'new-password'}
                  required={!editing}
                  minLength={8}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  style={inputStyle}
                />
              </label>

              {error && <div role="alert" style={{ color: '#b91c1c', whiteSpace: 'pre-wrap', fontSize: 13 }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button type="button" disabled={saving} onClick={() => setShowForm(false)} style={buttonStyle}>Cancel</button>
                <button type="submit" disabled={saving} style={{ ...buttonStyle, background: 'var(--primary, #e56108)', color: '#fff', borderColor: 'transparent' }}>
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRAccounts;

