import React, { useState } from 'react';
import api from '../../api/index';
import { useNavigate } from 'react-router-dom';
import { Key } from 'lucide-react';

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/employees/change-password/', {
        current_password: currentPassword,
        new_password: newPassword
      });
      setSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => navigate('/profile'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h2>Change Password</h2>
        <p className="page-subtitle">Update your account password</p>
      </div>

      <div className="card" style={{ maxWidth: '500px' }}>
        {error && <div style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{error}</div>}
        {success && <div style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input 
              type="password" 
              className="form-control"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input 
              type="password" 
              className="form-control"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Confirm New Password</label>
            <input 
              type="password" 
              className="form-control"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            />
          </div>
          <div className="btn-group-mobile" style={{ display: 'flex', gap: '1rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => navigate('/profile')}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 1 }}
            >
              <Key size={18} style={{ marginRight: '0.5rem' }} />
              {loading ? 'Processing...' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;

