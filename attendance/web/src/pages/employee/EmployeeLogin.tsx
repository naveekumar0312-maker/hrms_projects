import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { employeeLogin } from '../../api/auth';

const EmployeeLogin = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await employeeLogin(phone, password);
      
      if (data.user.role !== 'EMPLOYEE') {
        setError('You are not authorized as an employee.');
        setLoading(false);
        return;
      }

      login(data);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F8FAFC' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '3rem 2.5rem', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16A34A', letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>Attendance</div>
          <div style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 500 }}>Employee Portal</div>
        </div>
        
        {error && (
          <div style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.5rem' }}>Phone Number</label>
            <input 
              type="tel" 
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none', transition: 'border-color 0.2s' }}
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              required
              placeholder="Enter your phone number"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.5rem' }}>Password</label>
            <input 
              type="password" 
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none', transition: 'border-color 0.2s' }}
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', height: '48px', fontSize: '1rem', fontWeight: 600, backgroundColor: '#16A34A', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmployeeLogin;

