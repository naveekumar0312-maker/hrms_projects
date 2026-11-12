import './Holidays.css';
import { CustomSelect } from '../components/CustomSelect';
import CustomDatePicker from '../components/CustomDatePicker';
import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import api from '../services/api';
import type { Company } from './Companies';
interface Holiday {
  id: number;
  company: number;
  company_name?: string;
  name: string;
  date: string;
  description?: string | null;
  is_active: boolean;
}

const currentDate = new Date();

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #D1D5DB',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 14px',
  border: 0,
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
};

export default function Holidays() {
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();

  const isSuperAdmin = storedUser.role === 'SUPER_ADMIN';

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1));
  const [year, setYear] = useState(String(currentDate.getFullYear()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    company: '',
    name: '',
    date: '',
    description: '',
  });

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/holidays/', {
        params: { month, year },
      });
      const data = response.data;
      setHolidays(Array.isArray(data) ? data : data?.results ?? []);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        'Unable to load holidays. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchHolidays();
  }, [fetchHolidays]);

  useEffect(() => {
    if (!isSuperAdmin) return;

    api.get('/companies/')
      .then((response) => {
        const data = response.data;
        setCompanies(Array.isArray(data) ? data : data?.results ?? []);
      })
      .catch(() => setError('Unable to load companies.'));
  }, [isSuperAdmin]);

  const startCreate = () => {
    setEditingId(null);
    setForm({
      company: '',
      name: '',
      date: `${year}-${month.padStart(2, '0')}-01`,
      description: '',
    });
    setError('');
    setSuccess('');
    setShowForm(true);
  };

  const startEdit = (holiday: Holiday) => {
    setEditingId(holiday.id);
    setForm({
      company: String(holiday.company),
      name: holiday.name,
      date: holiday.date,
      description: holiday.description || '',
    });
    setError('');
    setSuccess('');
    setShowForm(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim() || !form.date) {
      setError('Holiday name and date are required.');
      return;
    }

    if (isSuperAdmin && !form.company) {
      setError('Please select a company.');
      return;
    }

    const payload: Record<string, string> = {
      name: form.name.trim(),
      date: form.date,
      description: form.description.trim(),
    };

    if (isSuperAdmin) payload.company = form.company;

    setSaving(true);

    try {
      if (editingId !== null) {
        await api.patch(`/holidays/${editingId}/`, payload);
        setSuccess('Holiday updated successfully.');
      } else {
        await api.post('/holidays/', payload);
        setSuccess('Holiday created successfully.');
      }

      setShowForm(false);
      await fetchHolidays();
    } catch (err: any) {
      const data = err.response?.data;
      const message =
        typeof data === 'string' ? data :
        data?.date?.[0] ||
        data?.name?.[0] ||
        data?.company?.[0] ||
        data?.detail ||
        data?.non_field_errors?.[0] ||
        'Unable to save holiday. Check the details and try again.';

      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (holiday: Holiday) => {
    if (!window.confirm(`Delete "${holiday.name}"?`)) return;

    setError('');
    setSuccess('');

    try {
      await api.delete(`/holidays/${holiday.id}/`);
      setSuccess('Holiday deleted successfully.');
      await fetchHolidays();
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        'Unable to delete this holiday.'
      );
    }
  };

  return (
    <div className="holiday-page" style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: '#111827' }}>
            Holiday Management
          </h1>
          <p style={{ color: '#6B7280', margin: '8px 0 0', fontSize: 14 }}>
            Manage company holidays and view the holiday calendar.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void fetchHolidays()}
            style={{ ...buttonStyle, background: '#F3F4F6', color: '#374151' }}
          >
            <RefreshCw size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Refresh
          </button>
          <button
            type="button"
            onClick={startCreate}
            style={{ ...buttonStyle, background: '#0056B3', color: '#FFFFFF' }}
          >
            <Plus size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Add Holiday
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{
          padding: 12, marginBottom: 16, borderRadius: 8,
          background: '#FEF2F2', color: '#B91C1C',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div role="status" style={{
          padding: 12, marginBottom: 16, borderRadius: 8,
          background: '#EFF6FF', color: '#0757B8',
        }}>
          {success}
        </div>
      )}

      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap',
        padding: 16, background: '#FFFFFF', border: '1px solid #E5E7EB',
        borderRadius: 12, marginBottom: 20,
      }}>
        <div style={{ minWidth: 170 }}>
          <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 6 }}>Month</div>
          <CustomSelect
            value={month}
            onChange={setMonth}
            placeholder="Select month"
            searchPlaceholder="Search month..."
            options={[
              { value: '1', label: 'January' },
              { value: '2', label: 'February' },
              { value: '3', label: 'March' },
              { value: '4', label: 'April' },
              { value: '5', label: 'May' },
              { value: '6', label: 'June' },
              { value: '7', label: 'July' },
              { value: '8', label: 'August' },
              { value: '9', label: 'September' },
              { value: '10', label: 'October' },
              { value: '11', label: 'November' },
              { value: '12', label: 'December' },
            ]}
          />
        </div>

        <div style={{ minWidth: 140 }}>
          <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 6 }}>Year</div>
          <CustomSelect
            value={year}
            onChange={setYear}
            placeholder="Select year"
            searchPlaceholder="Search year..."
            options={Array.from(
              { length: 7 },
              (_, index) => currentDate.getFullYear() - 2 + index
            ).map((value) => ({ value: String(value), label: String(value) }))}
          />
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            padding: 20, background: '#FFFFFF',
            border: '1px solid #E5E7EB', borderRadius: 12, marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 18, marginTop: 0 }}>
            {editingId !== null ? 'Edit Holiday' : 'Add New Holiday'}
          </h2>

          {isSuperAdmin && (
            <label className="holiday-company-field">
              Company *
              <CustomSelect
                value={form.company}
                onChange={(value) => setForm({ ...form, company: value })}
                placeholder="Select company"
                searchPlaceholder="Search company..."
                options={[
                  { value: '', label: 'Select company' },
                  ...companies.map((company) => ({
                    value: String(company.id),
                    label: company.name,
                  })),
                ]}
              />
            </label>
          )}

          <div className="holiday-form-grid">
            <label style={{ fontSize: 13 }}>
              Holiday Name *
              <input
                required
                maxLength={255}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. Independence Day"
                style={{ ...inputStyle, marginTop: 6 }}
              />
            </label>

            <CustomDatePicker
              label="Date *"
              value={form.date}
              onChange={(date) => setForm({ ...form, date })}
              alignRight
              required
            />
          </div>

          <label className="holiday-description-field">
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Optional holiday details"
              style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="submit"
              disabled={saving}
              style={{ ...buttonStyle, background: '#0056B3', color: '#FFFFFF' }}
            >
              {saving ? 'Saving...' : editingId !== null ? 'Save Changes' : 'Create Holiday'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{ ...buttonStyle, background: '#F3F4F6', color: '#374151' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{
        background: '#FFFFFF', border: '1px solid #E5E7EB',
        borderRadius: 12, overflowX: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
          <thead style={{ background: '#F9FAFB' }}>
            <tr>
              {['Holiday', 'Company', 'Date', 'Description', 'Actions'].map((heading) => (
                <th key={heading} style={{
                  padding: 14, textAlign: 'left', fontSize: 12,
                  color: '#6B7280', borderBottom: '1px solid #E5E7EB',
                }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center' }}>Loading holidays...</td></tr>
            ) : holidays.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 36, textAlign: 'center', color: '#6B7280' }}>
                  <CalendarDays size={28} style={{ display: 'block', margin: '0 auto 10px' }} />
                  No holidays found for this month.
                </td>
              </tr>
            ) : holidays.map((holiday) => {
              const compObj = companies.find((c) => String(c.id) === String(holiday.company));
              const displayCompName = holiday.company_name || compObj?.name || `Company #${holiday.company}`;
              return (
                <tr key={holiday.id}>
                  <td style={{ padding: 14, borderBottom: '1px solid #F3F4F6', fontWeight: 600 }}>
                    {holiday.name}
                  </td>
                  <td style={{ padding: 14, borderBottom: '1px solid #F3F4F6' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 9px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background: '#EFF6FF',
                      color: '#1D4ED8',
                      border: '1px solid #BFDBFE'
                    }}>
                      {displayCompName}
                    </span>
                  </td>
                  <td style={{ padding: 14, borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>
                    {new Date(`${holiday.date}T00:00:00`).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td style={{ padding: 14, borderBottom: '1px solid #F3F4F6', color: '#6B7280' }}>
                    {holiday.description || ''}
                  </td>
                  <td style={{ padding: 14, borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      title="Edit holiday"
                      onClick={() => startEdit(holiday)}
                      style={{ ...buttonStyle, padding: 8, background: '#FFF7ED', color: '#C2410C', marginRight: 6 }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      title="Delete holiday"
                      onClick={() => void handleDelete(holiday)}
                      style={{ ...buttonStyle, padding: 8, background: '#FEF2F2', color: '#B91C1C' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}







