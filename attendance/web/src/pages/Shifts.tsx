import { useEffect, useState } from 'react';
import { Clock, Plus, Search, Trash2, Eye, Pencil, MoreVertical, X, CheckCircle, XCircle } from 'lucide-react';
import { shiftService, type Shift } from '../services/shiftService';
import { formatTimeAMPM } from '../utils/timeUtils';
import { TimePickerAMPM } from '../components/TimePickerAMPM';
import { CustomSelect } from '../components/CustomSelect';

const Shifts = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    start_time: '',
    end_time: '',
    grace_period: 0,
    is_active: true
  });
  
  // Modals state
  const [viewShift, setViewShift] = useState<Shift | null>(null);
  const [activateShift, setActivateShift] = useState<Shift | null>(null);
  const [deactivateShift, setDeactivateShift] = useState<Shift | null>(null);
  const [deleteShift, setDeleteShift] = useState<Shift | null>(null);

  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const data = await shiftService.getShifts();
      setShifts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
    
    // Click outside to close dropdown
    const handleClickOutside = (e: MouseEvent) => {
      if ((e.target as Element).closest('.dropdown-container') === null) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Shift Name is required.');
      return;
    }
    if (!formData.code.trim()) {
      setError('Shift Code is required.');
      return;
    }
    
    setError(null);
    setActionLoading(true);
    
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        start_time: formData.start_time,
        end_time: formData.end_time,
        grace_period: formData.grace_period,
        is_active: formData.is_active
      };

      if (editingShift) {
        await shiftService.updateShift(editingShift.id, payload);
        alert('Shift updated successfully.');
      } else {
        await shiftService.createShift(payload);
        alert('Shift created successfully.');
      }
      setShowForm(false);
      setEditingShift(null);
      setFormData({ name: '', code: '', start_time: '', end_time: '', grace_period: 0, is_active: true });
      fetchShifts();
    } catch (err: any) {
      if (err.response?.data && typeof err.response.data === 'object' && !err.response.data.detail) {
        const errorMessages = Object.entries(err.response.data)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
          .join(' | ');
        setError(errorMessages);
      } else {
        setError(err.response?.data?.detail || 'Failed to save shift.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      code: shift.code,
      start_time: shift.start_time.substring(0, 5), // HH:MM
      end_time: shift.end_time.substring(0, 5),
      grace_period: shift.grace_period,
      is_active: shift.is_active
    });
    setShowForm(true);
    setActiveDropdown(null);
  };


  const handleToggleStatus = async (shift: Shift, newStatus: boolean) => {
    setActionLoading(true);
    setError(null);
    try {
      if (newStatus) {
        await shiftService.activateShift(shift.id);
        alert('Shift activated successfully.');
      } else {
        await shiftService.deactivateShift(shift.id);
        alert('Shift deactivated successfully.');
      }
      setActivateShift(null);
      setDeactivateShift(null);
      fetchShifts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update shift status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (shift: Shift) => {
    setActionLoading(true);
    setError(null);
    try {
      await shiftService.deleteShift(shift.id);
      setDeleteShift(null);
      alert('Shift deleted successfully.');
      fetchShifts();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError(err.response.data?.detail || err.response.data?.message || 'This shift cannot be deleted because employees are assigned to it.');
      } else {
        setError(err.response?.data?.detail || 'Failed to delete shift.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };



  const filteredShifts = shifts.filter(shift => {
    const matchesSearch = shift.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          shift.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || 
                          (statusFilter === 'ACTIVE' ? shift.is_active : !shift.is_active);
    return matchesSearch && matchesStatus;
  });

  const activeCount = shifts.filter(s => s.is_active).length;
  const inactiveCount = shifts.filter(s => !s.is_active).length;

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <h2>Shifts</h2>
          <div className="page-subtitle">Manage employee shift timings and attendance grace periods.</div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={() => {
            setEditingShift(null);
            setFormData({ name: '', code: '', start_time: '', end_time: '', grace_period: 0, is_active: true });
            setError(null);
            setShowForm(true);
          }}>
            <Plus size={18} /> Add Shift
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card stat-card" style={{ padding: '1rem 1.5rem' }}>
          <div className="stat-label">Total Shifts</div>
          <div className="stat-value">{shifts.length}</div>
        </div>
        <div className="card stat-card" style={{ padding: '1rem 1.5rem' }}>
          <div className="stat-label">Active Shifts</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{activeCount}</div>
        </div>
        <div className="card stat-card" style={{ padding: '1rem 1.5rem' }}>
          <div className="stat-label">Inactive Shifts</div>
          <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{inactiveCount}</div>
        </div>
      </div>

      <div className="admin-filters" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flexGrow: 1, maxWidth: '300px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search by name or code..." 
            style={{ paddingLeft: '2.5rem' }} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <CustomSelect
          options={[
            { value: "ALL", label: "All Status" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" }
          ]}
          value={statusFilter}
          onChange={(val) => setStatusFilter(val)}
        />
      </div>

      <div className="table-container" style={{ minHeight: '300px' }}>
        {loading ? (
          <div className="empty-state">Loading shifts...</div>
        ) : filteredShifts.length === 0 ? (
          <div className="empty-state">
            <Clock size={48} color="var(--border)" style={{ marginBottom: '1rem' }} />
            <h3>No shifts found</h3>
            <p>Create shift timings for employees.</p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowForm(true)}>
              <Plus size={18} /> Add Shift
            </button>
          </div>
        ) : (
          <>
          <div className="admin-table-desktop" style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Shift Name</th>
                <th>Code</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Grace Period</th>
                <th>Employees</th>
                <th>Status</th>
                <th style={{ minWidth: '140px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShifts.map((shift, idx) => (
                <tr key={shift.id}>
                  <td>{idx + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shift.name}</td>
                  <td><span className="badge badge-neutral" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{shift.code}</span></td>
                  <td>{formatTimeAMPM(shift.start_time)}</td>
                  <td>{formatTimeAMPM(shift.end_time)}</td>
                  <td>{shift.grace_period} min</td>
                  <td style={{ color: 'var(--primary)', fontWeight: 500 }}>{shift.employee_count || 0} Employees</td>

                  <td>
                    {shift.is_active ? (
                      <span className="badge badge-success">
                        <CheckCircle size={12} style={{ marginRight: '4px' }} /> Active
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        <XCircle size={12} style={{ marginRight: '4px' }} /> Inactive
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <button className="btn-icon" onClick={() => setViewShift(shift)} title="View">
                        <Eye size={16} />
                      </button>
                      <button className="btn-icon" onClick={() => handleEdit(shift)} title="Edit">
                        <Pencil size={16} />
                      </button>
                      
                      <div style={{ position: 'relative' }} className="dropdown-container">
                        <button className="btn-icon" onClick={() => setActiveDropdown(activeDropdown === shift.id ? null : shift.id)}>
                          <MoreVertical size={16} />
                        </button>
                        
                        {activeDropdown === shift.id && (
                          <div style={{ 
                            position: 'absolute', 
                            top: '100%', 
                            right: 0, 
                            backgroundColor: 'white', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                            zIndex: 1000,
                            minWidth: '150px',
                            padding: '0.5rem 0'
                          }}>
                            <button 
                              style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                              onClick={() => { setViewShift(shift); setActiveDropdown(null); }}
                            >
                              <Eye size={16} color="var(--text-muted)" /> View
                            </button>
                            <button 
                              style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                              onClick={() => handleEdit(shift)}
                            >
                              <Pencil size={16} color="var(--text-muted)" /> Edit
                            </button>
                            {shift.is_active ? (
                              <button 
                                style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                                onClick={() => { setDeactivateShift(shift); setActiveDropdown(null); }}
                              >
                                <XCircle size={16} color="var(--text-muted)" /> Deactivate
                              </button>
                            ) : (
                              <button 
                                style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                                onClick={() => { setActivateShift(shift); setActiveDropdown(null); }}
                              >
                                <CheckCircle size={16} color="var(--text-muted)" /> Activate
                              </button>
                            )}
                            <div style={{ borderTop: '1px solid var(--border)', margin: '0.25rem 0' }}></div>
                            <button 
                              style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--danger)' }}
                              onClick={() => { setDeleteShift(shift); setActiveDropdown(null); }}
                            >
                              <Trash2 size={16} color="var(--danger)" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Mobile Cards */}
          <div className="admin-cards-mobile">
            {filteredShifts.map(shift => (
              <div key={shift.id} className="admin-mobile-card">
                <div className="admin-mobile-card-header">
                  <div className="avatar" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                    <Clock size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{shift.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{shift.code}</div>
                  </div>
                  {shift.is_active ? (
                    <span className="badge badge-success"><CheckCircle size={12} style={{ marginRight: '4px' }} /> Active</span>
                  ) : (
                    <span className="badge badge-danger"><XCircle size={12} style={{ marginRight: '4px' }} /> Inactive</span>
                  )}
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Timing</span>
                  <span className="admin-mobile-card-value">{formatTimeAMPM(shift.start_time)} → {formatTimeAMPM(shift.end_time)}</span>
                </div>

                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Grace</span>
                  <span className="admin-mobile-card-value">{shift.grace_period} min</span>
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Employees</span>
                  <span className="admin-mobile-card-value" style={{ color: 'var(--primary)', fontWeight: 600 }}>{shift.employee_count || 0}</span>
                </div>
                <div className="admin-mobile-card-actions">
                  <button style={{ border: '1px solid var(--border)', background: 'white', color: 'var(--text-primary)' }} onClick={() => setViewShift(shift)}>
                    <Eye size={16} /> View
                  </button>
                  <button style={{ border: '1px solid var(--border)', background: 'white', color: 'var(--text-primary)' }} onClick={() => handleEdit(shift)}>
                    <Pencil size={16} /> Edit
                  </button>
                  {shift.is_active ? (
                    <button style={{ border: '1px solid var(--danger)', background: '#fef2f2', color: 'var(--danger)' }} onClick={() => setDeactivateShift(shift)}>
                      <XCircle size={16} /> Deactivate
                    </button>
                  ) : (
                    <button style={{ border: '1px solid #E56108', background: '#eff6ff', color: '#CC5200' }} onClick={() => setActivateShift(shift)}>
                      <CheckCircle size={16} /> Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay universal-modal-overlay">
          <div className="universal-modal-content" style={{ maxWidth: '600px' }}>
            <div className="universal-modal-header">
              <h2 style={{ margin: 0, fontWeight: 600 }}>{editingShift ? 'Edit Shift' : 'Add Shift'}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)} disabled={actionLoading}><X size={24} /></button>
            </div>
            
            <div className="universal-modal-body">
              {editingShift && editingShift.employee_count && editingShift.employee_count > 0 ? (
                <div style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)', padding: '1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                  This shift is currently assigned to employees. Changing the shift timing may affect future attendance calculations.
                </div>
              ) : null}

              {error && <div style={{ color: 'var(--danger)', padding: '0.75rem 1rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}
              
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="universal-grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>Shift Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input required type="text" className="form-control" placeholder="e.g., Day" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>Shift Code <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input required type="text" className="form-control" placeholder="e.g., MORNING" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} />
                  </div>
                </div>

                <div className="universal-grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>Start Time <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <TimePickerAMPM value={formData.start_time} onChange={val => setFormData({...formData, start_time: val})} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>End Time <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <TimePickerAMPM value={formData.end_time} onChange={val => setFormData({...formData, end_time: val})} required />
                  </div>
                </div>

                <div className="universal-grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>Grace Period (minutes) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input required type="number" min="0" max="120" className="form-control" value={formData.grace_period} onChange={e => setFormData({...formData, grace_period: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>Status</label>
                    <CustomSelect
                      options={[
                        { value: "true", label: "Active" },
                        { value: "false", label: "Inactive" }
                      ]}
                      value={formData.is_active ? 'true' : 'false'}
                      onChange={(val) => setFormData({...formData, is_active: val === 'true'})}
                    />
                  </div>
                </div>
              </form>
            </div>
            
            <div className="universal-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={actionLoading}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewShift && (
        <div className="modal-overlay universal-modal-overlay">
          <div className="universal-modal-content" style={{ maxWidth: '650px' }}>
            <div className="universal-modal-header">
              <div>
                <h2 style={{ margin: 0, fontWeight: 600 }}>Shift Details</h2>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Complete shift information</div>
              </div>
              <button className="btn-icon" onClick={() => setViewShift(null)}><X size={24} /></button>
            </div>
            
            <div className="universal-modal-body">
              <div className="card" style={{ padding: '1.25rem', boxShadow: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '1rem' }}>Shift Information</h3>
                <div className="universal-grid-2">
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Shift Name</div>
                    <div style={{ fontWeight: 500 }}>{viewShift.name || '--'}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Shift Code</div>
                    <div style={{ fontWeight: 500, fontFamily: 'monospace' }}>{viewShift.code || '--'}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Start Time</div>
                    <div style={{ fontWeight: 500 }}>{formatTimeAMPM(viewShift.start_time)}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>End Time</div>
                    <div style={{ fontWeight: 500 }}>{formatTimeAMPM(viewShift.end_time)}</div>
                  </div>
                </div>
              </div>
              
              <div className="card" style={{ padding: '1.25rem', boxShadow: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '1rem' }}>Rules & Details</h3>
                <div className="universal-grid-3">
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Grace Period</div>
                    <div style={{ fontWeight: 500 }}>{viewShift.grace_period != null ? `${viewShift.grace_period} minutes` : '--'}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Employees</div>
                    <div style={{ fontWeight: 500, color: 'var(--primary)' }}>{viewShift.employee_count ?? 0} Employees</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Status</div>
                    <div style={{ fontWeight: 500 }}>
                      {viewShift.is_active ? (
                        <span style={{ color: 'var(--success)' }}>ACTIVE</span>
                      ) : (
                        <span style={{ color: 'var(--danger)' }}>INACTIVE</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="card" style={{ padding: '1.25rem', boxShadow: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '1rem' }}>Metadata</h3>
                <div className="universal-grid-2">
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Created</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(viewShift.created_at)}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Updated</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(viewShift.updated_at)}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewShift(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Activate Confirmation Modal */}
      {activateShift && (
        <div className="modal-overlay universal-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="universal-modal-content" style={{ maxWidth: '400px' }}>
            <div className="universal-modal-body">
              <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Activate Shift?</h2>
              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Are you sure you want to activate this shift?
              </p>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Shift Name:</div>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{activateShift.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Shift Code:</div>
                <div style={{ fontWeight: 500, fontFamily: 'monospace' }}>{activateShift.code || '--'}</div>
              </div>
            </div>
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => { setActivateShift(null); setError(null); }} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleToggleStatus(activateShift, true)} disabled={actionLoading}>{actionLoading ? 'Activating...' : 'Activate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivateShift && (
        <div className="modal-overlay universal-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="universal-modal-content" style={{ maxWidth: '400px' }}>
            <div className="universal-modal-body">
              <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Deactivate Shift?</h2>
              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Are you sure you want to deactivate this shift?
              </p>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Shift Name:</div>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{deactivateShift.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Shift Code:</div>
                <div style={{ fontWeight: 500, fontFamily: 'monospace' }}>{deactivateShift.code || '--'}</div>
              </div>
            </div>
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => { setDeactivateShift(null); setError(null); }} disabled={actionLoading}>Cancel</button>
              <button className="btn" style={{ backgroundColor: 'var(--warning)', color: 'white' }} onClick={() => handleToggleStatus(deactivateShift, false)} disabled={actionLoading}>{actionLoading ? 'Deactivating...' : 'Deactivate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteShift && (
        <div className="modal-overlay universal-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="universal-modal-content" style={{ maxWidth: '400px' }}>
            <div className="universal-modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={20} />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Delete Shift?</h2>
              </div>
              
              {error && <div style={{ color: 'var(--danger)', marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.9rem', lineHeight: 1.4 }}>{error}</div>}
              
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete <strong>{deleteShift.name}</strong>? This action cannot be undone.
              </p>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Shift:</div>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{deleteShift.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Code:</div>
                <div style={{ fontWeight: 500, fontFamily: 'monospace' }}>{deleteShift.code || '--'}</div>
              </div>
            </div>
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => { setDeleteShift(null); setError(null); }} disabled={actionLoading}>Cancel</button>
              <button className="btn" style={{ backgroundColor: 'var(--danger)', color: 'white' }} onClick={() => handleDelete(deleteShift)} disabled={actionLoading}>{actionLoading ? 'Deleting...' : 'Delete Shift'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Shifts;


