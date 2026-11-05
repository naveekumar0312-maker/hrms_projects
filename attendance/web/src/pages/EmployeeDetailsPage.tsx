import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmployeeDocumentsPanel from '../components/EmployeeDocumentsPanel';
import { employeeService } from '../services/employeeService';

const hiddenKey = /(password|token|secret|credential|auth|refresh)/i;

const humanize = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const displayValue = (key: string, value: any): string => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') {
    if (/status|active|enabled/i.test(key)) return value ? 'Active' : 'Inactive';
    return value ? 'Yes' : 'No';
  }
  if (Array.isArray(value)) {
    return value.length ? value.map((v) =>
      typeof v === 'object' && v !== null
        ? Object.entries(v).filter(([k]) => !hiddenKey.test(k))
            .map(([k, item]) => `${humanize(k)}: ${String(item ?? '')}`).join(', ')
        : String(v)
    ).join('  ') : '';
  }
  if (typeof value === 'object') {
    const keys = ['name', 'full_name', 'employee_id', 'company_name', 'branch_name', 'designation', 'title', 'label', 'id'];
    const selected = keys.find((k) => value[k] !== undefined && value[k] !== null && value[k] !== '');
    if (selected) return String(value[selected]);
    return Object.entries(value).filter(([k]) => !hiddenKey.test(k))
      .map(([k, v]) => `${humanize(k)}: ${String(v ?? '')}`).join(', ') || '';
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }
  return String(value);
};

const EmployeeDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const employeeId = Number(id);
  const [employee, setEmployee] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!id || !Number.isInteger(employeeId) || employeeId <= 0) {
      setError('Invalid employee ID.');
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    employeeService.getEmployee(employeeId)
      .then((response) => { if (active) setEmployee(response.data); })
      .catch((err) => {
        console.error('Failed to load employee details:', err);
        if (active) setError(err?.response?.data?.detail || 'Unable to load employee details.');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [id, employeeId]);

  const entries = Object.entries(employee ?? {}).filter(
    ([key]) => !hiddenKey.test(key) && key !== 'id'
  );

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Employee Details</h1>
          <p style={{ color: 'var(--text-secondary, #64748B)' }}>Employee information and uploaded documents</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/employees')}> Back</button>
          {employee && <button className="btn btn-primary" onClick={() => navigate(`/admin/employees/${employeeId}/edit`)}>Edit Employee</button>}
        </div>
      </div>

      {loading && <p>Loading employee details...</p>}
      {!loading && error && <p role="alert" style={{ color: '#B91C1C' }}>{error}</p>}

      {!loading && employee && (
        <>
          <section style={{ padding: 22, border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 22, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid #E2E8F0' }}>
              {employee.profile_photo
                ? <img src={employee.profile_photo} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#FFF0E5', color: '#C4510B', fontSize: 24, fontWeight: 700 }}>{String(employee.full_name ?? employee.name ?? 'E').charAt(0).toUpperCase()}</div>}
              <div>
                <h2 style={{ margin: 0, fontSize: 21 }}>{employee.full_name ?? employee.name ?? 'Employee'}</h2>
                <p style={{ margin: '6px 0', color: '#64748B' }}>{employee.employee_id ?? ''}  {employee.designation ?? ''}</p>
                <strong style={{ color: employee.status ? '#166534' : '#991B1B' }}>{employee.status ? 'Active' : 'Inactive'}</strong>
              </div>
            </div>
            <h3>All Available Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
              {entries.map(([key, value]) => (
                <div key={key} style={{ minWidth: 0, padding: 12, borderRadius: 8, background: '#F8FAFC' }}>
                  <div style={{ fontSize: 12, marginBottom: 6, color: '#64748B' }}>{humanize(key)}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{displayValue(key, value)}</div>
                </div>
              ))}
            </div>
          </section>
          <section style={{ padding: 22, border: '1px solid #E2E8F0', borderRadius: 12, background: '#FFFFFF' }}>
            <h3>Employee Documents</h3>
            <EmployeeDocumentsPanel employeeId={employeeId} />
          </section>
        </>
      )}
    </main>
  );
};

export default EmployeeDetailsPage;
