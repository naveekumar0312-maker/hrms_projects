import { useEffect, useState } from 'react';
import { MapPin, Plus, XCircle, CheckCircle, Eye, Pencil, Trash2, MoreVertical, X, Building2 } from 'lucide-react';
import api from '../services/api';
import { CustomSelect } from '../components/CustomSelect';
import { type Company } from './Companies';

export interface Branch {
  id: number;
  company: number;
  company_name?: string;
  branch_name: string;
  office_address: string;
  latitude: number;
  longitude: number;
  allowed_radius: number;
  status: boolean;
  created_at?: string;
  updated_at?: string;
}

const Branches = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  // Add/Edit Form State
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    id: 0,
    company: '',
    branch_name: '',
    office_address: '',
    latitude: '',
    longitude: '',
    allowed_radius: 100,
    status: true
  });
  
  // Modals state
  const [viewBranch, setViewBranch] = useState<Branch | null>(null);
  const [activateBranch, setActivateBranch] = useState<Branch | null>(null);
  const [deactivateBranch, setDeactivateBranch] = useState<Branch | null>(null);
  const [deleteBranch, setDeleteBranch] = useState<Branch | null>(null);

  // Actions state
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/companies/')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setCompanies(list);
        if (list.length === 1) {
          setSelectedCompanyId(list[0].id.toString());
        }
      })
      .catch(console.error);
    
    // Click outside to close dropdown
    const handleClickOutside = (e: MouseEvent) => {
      if ((e.target as Element).closest('.dropdown-container') === null) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const url = selectedCompanyId ? `/branches/?company=${selectedCompanyId}` : '/branches/';
      const res = await api.get(url);
      const data = res.data;
      setBranches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [selectedCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company) {
      setError('Please select a company.');
      return;
    }
    
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setError('Longitude must be between -180 and 180.');
      return;
    }
    
    if (formData.allowed_radius <= 0) {
      setError('Allowed radius must be greater than 0.');
      return;
    }
    
    setError(null);
    setActionLoading(true);
    
    try {
      const payload = {
        company: parseInt(formData.company, 10),
        branch_name: formData.branch_name,
        office_address: formData.office_address,
        latitude: lat,
        longitude: lng,
        allowed_radius: formData.allowed_radius,
        status: formData.status
      };
      
      if (editMode && formData.id) {
        await api.patch(`/branches/${formData.id}/`, payload);
        // Note: Using a toast or simple alert for success notification.
        alert('Branch updated successfully.');
      } else {
        await api.post('/branches/', payload);
        alert('Branch created successfully.');
      }
      
      setShowForm(false);
      setEditMode(false);
      setFormData({ id: 0, company: '', branch_name: '', office_address: '', latitude: '', longitude: '', allowed_radius: 100, status: true });
      fetchBranches();
    } catch (err: any) {
      if (err.response?.data && typeof err.response.data === 'object' && !err.response.data.detail) {
        const errorMessages = Object.entries(err.response.data)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
          .join(' | ');
        setError(errorMessages);
      } else {
        setError(err.response?.data?.detail || `Failed to ${editMode ? 'update' : 'create'} branch.`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (branch: Branch, newStatus: boolean) => {
    setActionLoading(true);
    setError(null);
    try {
      await api.patch(`/branches/${branch.id}/`, { status: newStatus });
      setActivateBranch(null);
      setDeactivateBranch(null);
      alert(`Branch ${newStatus ? 'activated' : 'deactivated'} successfully.`);
      fetchBranches();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update branch status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (branch: Branch) => {
    setActionLoading(true);
    setError(null);
    try {
      await api.delete(`/branches/${branch.id}/`);
      setDeleteBranch(null);
      alert('Branch deleted successfully.');
      fetchBranches();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError(err.response.data?.detail || err.response.data?.message || 'This branch cannot be deleted because employees or attendance records are associated with it.');
      } else {
        setError(err.response?.data?.detail || 'Unable to delete branch.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (branch: Branch) => {
    setFormData({
      id: branch.id,
      company: branch.company.toString(),
      branch_name: branch.branch_name,
      office_address: branch.office_address,
      latitude: branch.latitude.toString(),
      longitude: branch.longitude.toString(),
      allowed_radius: branch.allowed_radius,
      status: branch.status
    });
    setEditMode(true);
    setShowForm(true);
    setError(null);
    setActiveDropdown(null);
  };
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <h2>Branches</h2>
          <div className="page-subtitle">Manage office locations and attendance zones.</div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={() => {
            const defaultCompany = selectedCompanyId || (companies.length === 1 ? companies[0].id.toString() : '');
            setEditMode(false);
            setFormData({ id: 0, company: defaultCompany, branch_name: '', office_address: '', latitude: '', longitude: '', allowed_radius: 100, status: true });
            setError(null);
            setShowForm(true);
          }}>
            <Plus size={18} /> Add Branch
          </button>
        </div>
      </div>

      <div className="admin-filters" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <CustomSelect
          options={[
            { value: "", label: "All Companies" },
            ...companies.filter(c => c.status).map(c => ({ value: c.id.toString(), label: c.name }))
          ]}
          value={selectedCompanyId}
          onChange={(val) => setSelectedCompanyId(val)}
          placeholder="All Companies"
          icon={<Building2 size={18} />}
          searchPlaceholder="Search companies..."
        />
      </div>

      <div className="table-container" style={{ minHeight: '300px' }}>
        {loading ? (
          <div className="empty-state">Loading branches...</div>
        ) : branches.length === 0 ? (
          <div className="empty-state">
            <MapPin size={48} color="var(--border)" style={{ marginBottom: '1rem' }} />
            <h3>No branches found</h3>
            <p>Add a branch to establish attendance zones for employees.</p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => { setEditMode(false); setShowForm(true); }}>
              <Plus size={18} /> Add Branch
            </button>
          </div>
        ) : (
          <>
          <div className="admin-table-desktop" style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Company</th>
                <th>Location / Radius</th>
                <th>Status</th>
                <th style={{ minWidth: '140px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map(branch => (
                <tr key={branch.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="avatar" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                        <MapPin size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{branch.branch_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{branch.office_address}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{branch.company_name || '--'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{branch.latitude?.toFixed(4) || '--'}, {branch.longitude?.toFixed(4) || '--'}</span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{branch.allowed_radius || '--'}m radius</span>
                    </div>
                  </td>
                  <td>
                    {branch.status ? (
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
                      <button className="btn-icon" onClick={() => setViewBranch(branch)} title="View">
                        <Eye size={16} />
                      </button>
                      <button className="btn-icon" onClick={() => openEdit(branch)} title="Edit">
                        <Pencil size={16} />
                      </button>
                      
                      <div style={{ position: 'relative' }} className="dropdown-container">
                        <button className="btn-icon" onClick={() => setActiveDropdown(activeDropdown === branch.id ? null : branch.id)}>
                          <MoreVertical size={16} />
                        </button>
                        
                        {activeDropdown === branch.id && (
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
                              onClick={() => { setViewBranch(branch); setActiveDropdown(null); }}
                            >
                              <Eye size={16} color="var(--text-muted)" /> View
                            </button>
                            <button 
                              style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                              onClick={() => openEdit(branch)}
                            >
                              <Pencil size={16} color="var(--text-muted)" /> Edit
                            </button>
                            {branch.status ? (
                              <button 
                                style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                                onClick={() => { setDeactivateBranch(branch); setActiveDropdown(null); }}
                              >
                                <XCircle size={16} color="var(--text-muted)" /> Deactivate
                              </button>
                            ) : (
                              <button 
                                style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                                onClick={() => { setActivateBranch(branch); setActiveDropdown(null); }}
                              >
                                <CheckCircle size={16} color="var(--text-muted)" /> Activate
                              </button>
                            )}
                            <div style={{ borderTop: '1px solid var(--border)', margin: '0.25rem 0' }}></div>
                            <button 
                              style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--danger)' }}
                              onClick={() => { setDeleteBranch(branch); setActiveDropdown(null); }}
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
            {branches.map(branch => (
              <div key={branch.id} className="admin-mobile-card">
                <div className="admin-mobile-card-header">
                  <div className="avatar" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                    <MapPin size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{branch.branch_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{branch.company_name || '--'}</div>
                  </div>
                  {branch.status ? (
                    <span className="badge badge-success"><CheckCircle size={12} style={{ marginRight: '4px' }} /> Active</span>
                  ) : (
                    <span className="badge badge-danger"><XCircle size={12} style={{ marginRight: '4px' }} /> Inactive</span>
                  )}
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Address</span>
                  <span className="admin-mobile-card-value">{branch.office_address || '--'}</span>
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Latitude</span>
                  <span className="admin-mobile-card-value">{branch.latitude?.toFixed(4) || '--'}</span>
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Longitude</span>
                  <span className="admin-mobile-card-value">{branch.longitude?.toFixed(4) || '--'}</span>
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Radius</span>
                  <span className="admin-mobile-card-value">{branch.allowed_radius || '--'}m</span>
                </div>
                <div className="admin-mobile-card-actions">
                  <button style={{ border: '1px solid var(--border)', background: 'white', color: 'var(--text-primary)' }} onClick={() => setViewBranch(branch)}>
                    <Eye size={16} /> View
                  </button>
                  <button style={{ border: '1px solid var(--border)', background: 'white', color: 'var(--text-primary)' }} onClick={() => openEdit(branch)}>
                    <Pencil size={16} /> Edit
                  </button>
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
          <div className="universal-modal-content" style={{ maxWidth: '700px' }}>
            <div className="universal-modal-header">
              <h2 style={{ margin: 0, fontWeight: 600 }}>{editMode ? 'Edit Branch' : 'Add Branch'}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}><X size={24} /></button>
            </div>
            
            <div className="universal-modal-body">
              {error && <div style={{ color: 'var(--danger)', padding: '0.75rem 1rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}
              
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="universal-grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>Company <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <CustomSelect
                      options={[
                        { value: "", label: "Select Company" },
                        ...companies.filter(c => c.status || c.id.toString() === formData.company).map(c => ({ value: c.id.toString(), label: c.name }))
                      ]}
                      value={formData.company}
                      onChange={(val) => setFormData({...formData, company: val})}
                      searchPlaceholder="Search companies..."
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>Branch Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input required type="text" className="form-control" placeholder="e.g., Coimbatore Branch" value={formData.branch_name} onChange={e => setFormData({...formData, branch_name: e.target.value})} />
                  </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 500 }}>Office Address <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <textarea required className="form-control" rows={3} placeholder="Enter full address..." value={formData.office_address} onChange={e => setFormData({...formData, office_address: e.target.value})} />
                </div>
                
                <div className="universal-grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>Latitude <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input required type="number" step="any" min="-90" max="90" className="form-control" placeholder="e.g., 11.0168" value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>Longitude <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input required type="number" step="any" min="-180" max="180" className="form-control" placeholder="e.g., 76.9558" value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} />
                  </div>
                </div>
                
                <div className="universal-grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>Allowed Radius (meters) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input required type="number" min="1" className="form-control" value={formData.allowed_radius} onChange={e => setFormData({...formData, allowed_radius: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500 }}>Status</label>
                    <CustomSelect
                      options={[
                        { value: "true", label: "Active" },
                        { value: "false", label: "Inactive" }
                      ]}
                      value={formData.status ? 'true' : 'false'}
                      onChange={(val) => setFormData({...formData, status: val === 'true'})}
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
      {viewBranch && (
        <div className="modal-overlay universal-modal-overlay">
          <div className="universal-modal-content" style={{ maxWidth: '650px' }}>
            <div className="universal-modal-header">
              <div>
                <h2 style={{ margin: 0, fontWeight: 600 }}>Branch Details</h2>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Complete branch information</div>
              </div>
              <button className="btn-icon" onClick={() => setViewBranch(null)}><X size={24} /></button>
            </div>
            
            <div className="universal-modal-body">
              <div className="card" style={{ padding: '1.25rem', boxShadow: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '1rem' }}>Branch Information</h3>
                <div className="universal-grid-2">
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Branch Name</div>
                    <div style={{ fontWeight: 500 }}>{viewBranch.branch_name || '--'}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company</div>
                    <div style={{ fontWeight: 500 }}>{viewBranch.company_name || '--'}</div>
                  </div>
                  <div className="universal-long-text" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Office Address</div>
                    <div style={{ fontWeight: 400, lineHeight: 1.5 }}>{viewBranch.office_address || '--'}</div>
                  </div>
                </div>
              </div>
              
              <div className="card" style={{ padding: '1.25rem', boxShadow: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={14} /> Location
                </h3>
                <div className="universal-grid-3">
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Latitude</div>
                    <div style={{ fontWeight: 500 }}>{viewBranch.latitude?.toString() || '--'}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Longitude</div>
                    <div style={{ fontWeight: 500 }}>{viewBranch.longitude?.toString() || '--'}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Allowed Radius</div>
                    <div style={{ fontWeight: 500 }}>{viewBranch.allowed_radius ? `${viewBranch.allowed_radius}m` : '--'}</div>
                  </div>
                </div>
              </div>
              
              <div className="universal-grid-2">
                <div className="card" style={{ padding: '1.25rem', boxShadow: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '1rem' }}>Status</h3>
                  <div>
                    {viewBranch.status ? (
                      <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}><CheckCircle size={14} style={{ marginRight: '6px' }} /> ACTIVE</span>
                    ) : (
                      <span className="badge badge-danger" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}><XCircle size={14} style={{ marginRight: '6px' }} /> INACTIVE</span>
                    )}
                  </div>
                </div>
                <div className="card" style={{ padding: '1.25rem', boxShadow: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '1rem' }}>Metadata</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="universal-long-text">
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Created</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(viewBranch.created_at)}</div>
                    </div>
                    <div className="universal-long-text">
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Updated</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(viewBranch.updated_at)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewBranch(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Activate Confirmation Modal */}
      {activateBranch && (
        <div className="modal-overlay universal-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="universal-modal-content" style={{ maxWidth: '400px' }}>
            <div className="universal-modal-body">
              <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Activate Branch?</h2>
              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Are you sure you want to activate this branch?
              </p>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Branch:</div>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{activateBranch.branch_name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company:</div>
                <div style={{ fontWeight: 500 }}>{activateBranch.company_name || '--'}</div>
              </div>
            </div>
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => { setActivateBranch(null); setError(null); }} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleStatusChange(activateBranch, true)} disabled={actionLoading}>{actionLoading ? 'Activating...' : 'Activate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivateBranch && (
        <div className="modal-overlay universal-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="universal-modal-content" style={{ maxWidth: '400px' }}>
            <div className="universal-modal-body">
              <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Deactivate Branch?</h2>
              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Are you sure you want to deactivate this branch?
              </p>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Branch:</div>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{deactivateBranch.branch_name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company:</div>
                <div style={{ fontWeight: 500 }}>{deactivateBranch.company_name || '--'}</div>
              </div>
            </div>
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => { setDeactivateBranch(null); setError(null); }} disabled={actionLoading}>Cancel</button>
              <button className="btn" style={{ backgroundColor: 'var(--warning)', color: 'white' }} onClick={() => handleStatusChange(deactivateBranch, false)} disabled={actionLoading}>{actionLoading ? 'Deactivating...' : 'Deactivate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteBranch && (
        <div className="modal-overlay universal-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="universal-modal-content" style={{ maxWidth: '400px' }}>
            <div className="universal-modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={20} />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Delete Branch?</h2>
              </div>
              
              {error && <div style={{ color: 'var(--danger)', marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.9rem', lineHeight: 1.4 }}>{error}</div>}
              
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete <strong>{deleteBranch.branch_name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => { setDeleteBranch(null); setError(null); }} disabled={actionLoading}>Cancel</button>
              <button className="btn" style={{ backgroundColor: 'var(--danger)', color: 'white' }} onClick={() => handleDelete(deleteBranch)} disabled={actionLoading}>{actionLoading ? 'Deleting...' : 'Delete Branch'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Branches;

