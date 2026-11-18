import React, { useContext, useState, useRef, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Building2,
  MapPin,
  Clock,
  Key,
  Camera,
  Edit2,
  Check,
  X,
  AlertCircle,
  Calendar,
  Shield,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { resolveMediaUrl } from '../../utils/imageUtils';

const EmployeeProfile = () => {
  const { employee, refreshUser } = useContext(AuthContext);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Editable Form State
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    date_of_birth: '',
    gender: '',
    current_address: '',
    permanent_address: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
  });

  // Populate formData on load
  useEffect(() => {
    if (employee) {
      setFormData({
        full_name: employee.full_name || '',
        phone_number: employee.phone_number || (employee.user?.phone_number ?? '') || '',
        email: employee.email || '',
        date_of_birth: employee.date_of_birth || '',
        gender: employee.gender || '',
        current_address: employee.current_address || '',
        permanent_address: employee.permanent_address || '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_number: employee.emergency_contact_number || '',
      });
    }
  }, [employee]);

  if (!employee) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading profile...</p>
      </div>
    );
  }

  const profilePhotoUrl = resolveMediaUrl(employee.profile_photo);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Upload Profile Photo
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPG, PNG).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size should be less than 5MB.');
      return;
    }

    try {
      setUploadingPhoto(true);
      setErrorMsg('');
      setSuccessMsg('');

      const form = new FormData();
      form.append('profile_photo', file);

      await api.patch('/employees/me/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccessMsg('Profile photo updated successfully!');
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err: any) {
      console.error('Failed to upload photo:', err);
      const detail =
        err.response?.data?.profile_photo?.[0] ||
        err.response?.data?.detail ||
        'Failed to update profile photo.';
      setErrorMsg(detail);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Submit Profile Information
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');
      setSuccessMsg('');

      const payload: Record<string, string> = {
        full_name: formData.full_name.trim(),
        phone_number: formData.phone_number.trim(),
        email: formData.email.trim(),
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        current_address: formData.current_address.trim(),
        permanent_address: formData.permanent_address.trim(),
        emergency_contact_name: formData.emergency_contact_name.trim(),
        emergency_contact_number: formData.emergency_contact_number.trim(),
      };

      await api.patch('/employees/me/', payload);

      setSuccessMsg('Profile details updated successfully!');
      setIsEditing(false);
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      let msg = 'Failed to update profile details.';
      if (err.response?.data) {
        const d = err.response.data;
        const firstKey = Object.keys(d)[0];
        if (firstKey) {
          const val = d[firstKey];
          msg = Array.isArray(val) ? `${firstKey}: ${val[0]}` : String(val);
        }
      }
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setErrorMsg('');
    if (employee) {
      setFormData({
        full_name: employee.full_name || '',
        phone_number: employee.phone_number || (employee.user?.phone_number ?? '') || '',
        email: employee.email || '',
        date_of_birth: employee.date_of_birth || '',
        gender: employee.gender || '',
        current_address: employee.current_address || '',
        permanent_address: employee.permanent_address || '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_number: employee.emergency_contact_number || '',
      });
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            My Profile
          </h2>
          <p className="page-subtitle" style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>
            Manage your personal profile, contact information, and account details
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {!isEditing ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsEditing(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                fontWeight: 700,
                padding: '0.6rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Edit2 size={16} /> Edit Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelEdit}
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1rem',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <X size={16} /> Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 700,
                  padding: '0.6rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <Check size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {successMsg && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#15803D',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: 600,
          }}
        >
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem', borderRadius: 16 }}>
        {/* Profile Hero / Photo Header */}
        <div
          className="flex-column-mobile"
          style={{
            padding: '2.5rem',
            backgroundColor: 'var(--bg-page)',
            display: 'flex',
            alignItems: 'center',
            gap: '2rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Avatar with Upload Badge */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.75rem',
                fontWeight: 800,
                overflow: 'hidden',
                border: '4px solid #fff',
                boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              }}
            >
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt={employee.full_name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                employee.full_name?.charAt(0)?.toUpperCase() || 'E'
              )}
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              accept="image/*"
              style={{ display: 'none' }}
            />

            {/* Change Photo Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              title="Change Profile Photo"
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                border: '3px solid #fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {uploadingPhoto ? <Upload size={16} className="spin" /> : <Camera size={16} />}
            </button>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                {employee.full_name}
              </h3>
              <div
                className={`badge ${employee.status ? 'badge-success' : 'badge-danger'}`}
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: 700 }}
              >
                {employee.status ? 'ACTIVE' : 'INACTIVE'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.3rem 0.85rem',
                  borderRadius: '9999px',
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  border: '1px solid #BBF7D0',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  letterSpacing: '0.02em',
                }}
              >
                #ID:{employee.employee_id}
              </span>
              <span
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Briefcase size={16} /> {employee.designation || 'Staff'}
              </span>
              <span
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Building2 size={16} /> {employee.company?.name || employee.company_name || 'Yaazh 360'}
              </span>
            </div>

            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click the camera icon on your photo to upload or change your profile picture anytime.
            </p>
          </div>
        </div>

        {/* Content Body */}
        {!isEditing ? (
          /* View Mode */
          <div
            className="stat-card-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            }}
          >
            {/* Full Name */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                <User size={18} />{' '}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Full Name
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>
                {employee.full_name || 'Not set'}
              </div>
            </div>

            {/* Email */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                <Mail size={18} />{' '}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Email
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem', wordBreak: 'break-word' }}>
                {employee.email || 'Not available'}
              </div>
            </div>

            {/* Phone */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                <Phone size={18} />{' '}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Phone Number
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>
                {employee.phone_number || (employee.user?.phone_number ?? '') || 'Not available'}
              </div>
            </div>

            {/* Date of Birth */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                <Calendar size={18} />{' '}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Date of Birth
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>
                {employee.date_of_birth ? new Date(employee.date_of_birth).toLocaleDateString('en-GB') : 'Not set'}
              </div>
            </div>

            {/* Gender */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                <User size={18} />{' '}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Gender
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>
                {employee.gender || 'Not specified'}
              </div>
            </div>

            {/* Department */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                <Briefcase size={18} />{' '}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Department
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>
                {employee.department || 'Not available'}
              </div>
            </div>

            {/* Branch */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                <MapPin size={18} />{' '}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Branch
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>
                {employee.branch?.name || employee.branch?.branch_name || 'Not available'}
              </div>
            </div>

            {/* Shift */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                <Clock size={18} />{' '}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Shift
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>
                {employee.shift?.name || 'Not available'}
              </div>
            </div>

            {/* Work Type */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                <Briefcase size={18} />{' '}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Work Type
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>
                {employee.work_type === 'FIELD'
                  ? 'Field / Marketing'
                  : employee.work_type === 'OFFICE'
                  ? 'Office'
                  : employee.work_type || 'Not available'}
              </div>
            </div>

            {/* Current Address */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                <MapPin size={18} />{' '}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Current Address
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
                {employee.current_address || 'Not provided'}
              </div>
            </div>

            {/* Emergency Contact */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                <Shield size={18} />{' '}
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Emergency Contact
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
                {employee.emergency_contact_name
                  ? `${employee.emergency_contact_name} (${employee.emergency_contact_number || '--'})`
                  : 'Not provided'}
              </div>
            </div>
          </div>
        ) : (
          /* Edit Form Mode */
          <form onSubmit={handleSubmit} style={{ padding: '2rem 2.5rem' }}>
            <h4
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '1.5rem',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '0.5rem',
              }}
            >
              Personal & Contact Information
            </h4>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '1.5rem',
              }}
            >
              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>

              {/* Phone Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  placeholder="e.g. 9876543210"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="name@company.com"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>

              {/* Gender */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <option value="">Select Gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Emergency Contact Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  name="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={handleInputChange}
                  placeholder="Relative / Spouse / Friend"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>

              {/* Emergency Contact Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Emergency Contact Number
                </label>
                <input
                  type="text"
                  name="emergency_contact_number"
                  value={formData.emergency_contact_number}
                  onChange={handleInputChange}
                  placeholder="Emergency Phone Number"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
            </div>

            {/* Addresses */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Current Address
                </label>
                <textarea
                  name="current_address"
                  rows={3}
                  value={formData.current_address}
                  onChange={handleInputChange}
                  placeholder="Your residential address"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Permanent Address
                </label>
                <textarea
                  name="permanent_address"
                  rows={3}
                  value={formData.permanent_address}
                  onChange={handleInputChange}
                  placeholder="Permanent / Home address"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelEdit}
                disabled={saving}
                style={{ padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{
                  padding: '0.65rem 1.75rem',
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                }}
              >
                {saving ? 'Saving...' : 'Save Profile Details'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Security Actions */}
      <div>
        <Link
          to="/profile/change-password"
          className="btn btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Key size={18} /> Change Password
        </Link>
      </div>
    </div>
  );
};

export default EmployeeProfile;
