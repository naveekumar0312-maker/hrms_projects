import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { User, Mail, Phone, Briefcase, Building2, MapPin, Clock, Key } from 'lucide-react';
import { Link } from 'react-router-dom';

const EmployeeProfile = () => {
  const { employee } = useContext(AuthContext);

  if (!employee) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading profile...</p>
      </div>
    );
  }

  const getImageUrl = (url: string | null | undefined) => {
  if (!url) return '';

  if (url.startsWith('http')) {
    if (url.includes('127.0.0.1') || url.includes('localhost')) {
      try {
        const path = new URL(url).pathname;
        return `${path}`;
      } catch {
        return url;
      }
    }

    return url;
  }

  return `${url}`;
};

  return (
    <div>
      <div className="page-header">
        <h2>My Profile</h2>
        <p className="page-subtitle">View your personal and job details</p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>

        {/* Header Section */}
        <div className="flex-column-mobile" style={{ padding: '2.5rem', backgroundColor: 'var(--bg-page)', display: 'flex', alignItems: 'center', gap: '2rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 800, overflow: 'hidden', border: '3px solid white', boxShadow: 'var(--shadow-sm)' }}>
            {employee.profile_photo ? (
              <img src={getImageUrl(employee.profile_photo)!} alt={employee.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              employee.full_name.charAt(0)
            )}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-primary)', fontWeight: 800 }}>{employee.full_name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <span className="badge badge-neutral" style={{ fontSize: '0.85rem' }}>ID: {employee.employee_id}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={16} /> {employee.designation || 'Staff'}
              </span>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="stat-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>

          <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <Mail size={18} /> <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</span>
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem', wordBreak: 'break-word' }}>{employee.email || 'Not available'}</div>
          </div>

          <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <Phone size={18} /> <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</span>
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>{employee.phone_number || 'Not available'}</div>
          </div>

          <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <User size={18} /> <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</span>
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem', wordBreak: 'break-word' }}>{employee.department || 'Not available'}</div>
          </div>

          <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <Building2 size={18} /> <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company</span>
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem', wordBreak: 'break-word' }}>{employee.company?.name || 'Not available'}</div>
          </div>

          <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <MapPin size={18} /> <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branch</span>
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem', wordBreak: 'break-word' }}>{employee.branch?.name || employee.branch?.branch_name || 'Not available'}</div>
          </div>

          <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <Clock size={18} /> <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shift</span>
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem', wordBreak: 'break-word' }}>
              {employee.shift?.name || 'Not available'}
              {employee.shift?.start_time && employee.shift?.end_time && (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '0.5rem', fontWeight: 500 }}>
                  ({new Date(`2000-01-01T${employee.shift.start_time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {new Date(`2000-01-01T${employee.shift.end_time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
            </div>
          </div>

          <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <Briefcase size={18} /> <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Work Type</span>
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>
              {employee.work_type === 'FIELD' ? 'Field / Marketing' : employee.work_type === 'OFFICE' ? 'Office' : (employee.work_type || 'Not available')}
            </div>
          </div>

          <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <User size={18} /> <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>
              {employee.status !== undefined ? (
                <div className={`badge ${employee.status ? 'badge-success' : 'badge-danger'}`} style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
                  {employee.status ? 'ACTIVE' : 'INACTIVE'}
                </div>
              ) : 'Not available'}
            </div>
          </div>

        </div>
      </div>

      <div>
        <Link to="/profile/change-password" className="btn btn-secondary" style={{ display: 'inline-flex', gap: '0.5rem' }}>
          <Key size={18} /> Change Password
        </Link>
      </div>
    </div>
  );
};

export default EmployeeProfile;

