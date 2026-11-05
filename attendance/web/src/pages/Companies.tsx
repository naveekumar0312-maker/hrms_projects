import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, XCircle, Building2, Search, Eye, Pencil, MoreVertical, X } from 'lucide-react';
import api from '../services/api';
import { CustomSelect } from '../components/CustomSelect';

export interface Company {
  id: number;
  name: string;
  code: string;
  address: string;
  status: boolean;
  branch_count?: number;
  employee_count?: number;
  created_at?: string;
  updated_at?: string;
}

const Companies = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    id: 0,
    name: '',
    code: '',
    address: '',
    status: true
  });
  
  // Modals state
  const [viewCompany, setViewCompany] = useState<Company | null>(null);
  const [activateCompany, setActivateCompany] = useState<Company | null>(null);
  const [deactivateCompany, setDeactivateCompany] = useState<Company | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<Company | null>(null);

  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get('/companies/');
      const data = res.data;
      setCompanies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    
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
      setError('Company Name is required.');
      return;
    }
    if (!formData.code.trim()) {
      setError('Company Code is required.');
      return;
    }
    
    setError(null);
    setActionLoading(true);
    
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        address: formData.address,
        status: formData.status
      };
      
      if (editMode && formData.id) {
        await api.patch(`/companies/${formData.id}/`, payload);
        alert('Company updated successfully.');
      } else {
        await api.post('/companies/', payload);
        alert('Company created successfully.');
      }
      
      setShowForm(false);
      setEditMode(false);
      setFormData({ id: 0, name: '', code: '', address: '', status: true });
      fetchCompanies();
    } catch (err: any) {
      if (err.response?.data && typeof err.response.data === 'object' && !err.response.data.detail) {
        const errorMessages = Object.entries(err.response.data)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
          .join(' | ');
        setError(errorMessages);
      } else {
        setError(err.response?.data?.detail || `Failed to ${editMode ? 'update' : 'create'} company.`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (company: Company, newStatus: boolean) => {
    setActionLoading(true);
    setError(null);
    try {
      await api.patch(`/companies/${company.id}/`, { status: newStatus });
      setActivateCompany(null);
      setDeactivateCompany(null);
      alert(`Company ${newStatus ? 'activated' : 'deactivated'} successfully.`);
      fetchCompanies();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update company status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (company: Company) => {
    setActionLoading(true);
    setError(null);
    try {
      await api.delete(`/companies/${company.id}/`);
      setDeleteCompany(null);
      alert('Company deleted successfully.');
      fetchCompanies();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError(err.response.data?.detail || err.response.data?.message || 'This company cannot be deleted because it has associated branches, employees, or attendance records.');
      } else {
        setError(err.response?.data?.detail || 'Unable to delete company.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (company: Company) => {
    setFormData({
      id: company.id,
      name: company.name,
      code: company.code,
      address: company.address,
      status: company.status
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
          <h2>Companies</h2>
          <div className="page-subtitle">Manage organizations and their branch structure.</div>
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => { setEditMode(false); setFormData({ id: 0, name: '', code: '', address: '', status: true }); setError(null); setShowForm(true); }}>
            <Plus size={18} /> Add Company
          </button>
        </div>
      </div>

      <div className="admin-filters" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" className="form-control" placeholder="Search companies..." style={{ paddingLeft: '2.5rem' }} />
        </div>
      </div>

      <div className="table-container" style={{ minHeight: '300px' }}>
        {loading ? (
          <div className="empty-state">Loading companies...</div>
        ) : companies.length === 0 ? (
          <div className="empty-state">
            <Building2 size={48} color="var(--border)" style={{ marginBottom: '1rem' }} />
            <h3>No companies found</h3>
            <p>Add your first company to start organizing your attendance zones.</p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowForm(true)}>
              <Plus size={18} /> Add Company
            </button>
          </div>
        ) : (
          <>
          {/* Desktop Table */}
          <div className="admin-table-desktop" style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Code</th>
                <th>Branches</th>
                <th>Employees</th>
                <th>Status</th>
                <th style={{ minWidth: '140px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(company => (
                <tr key={company.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="avatar" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                        <Building2 size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{company.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{company.address}</div>
                      </div>
                    </div>
                  </td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{company.code}</span></td>
                  <td>{company.branch_count ?? '--'}</td>
                  <td>{company.employee_count ?? '--'}</td>
                  <td>
                    {company.status ? (
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
                      <button className="btn-icon" onClick={() => setViewCompany(company)} title="View">
                        <Eye size={16} />
                      </button>
                      <button className="btn-icon" onClick={() => openEdit(company)} title="Edit">
                        <Pencil size={16} />
                      </button>
                      
                      <div style={{ position: 'relative' }} className="dropdown-container">
                        <button className="btn-icon" onClick={() => setActiveDropdown(activeDropdown === company.id ? null : company.id)}>
                          <MoreVertical size={16} />
                        </button>
                        
                        {activeDropdown === company.id && (
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
                              onClick={() => { setViewCompany(company); setActiveDropdown(null); }}
                            >
                              <Eye size={16} color="var(--text-muted)" /> View
                            </button>
                            <button 
                              style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                              onClick={() => openEdit(company)}
                            >
                              <Pencil size={16} color="var(--text-muted)" /> Edit
                            </button>
                            {company.status ? (
                              <button 
                                style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                                onClick={() => { setDeactivateCompany(company); setActiveDropdown(null); }}
                              >
                                <XCircle size={16} color="var(--text-muted)" /> Deactivate
                              </button>
                            ) : (
                              <button 
                                style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                                onClick={() => { setActivateCompany(company); setActiveDropdown(null); }}
                              >
                                <CheckCircle size={16} color="var(--text-muted)" /> Activate
                              </button>
                            )}
                            <div style={{ borderTop: '1px solid var(--border)', margin: '0.25rem 0' }}></div>
                            <button 
                              style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--danger)' }}
                              onClick={() => { setDeleteCompany(company); setActiveDropdown(null); }}
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
            {companies.map(company => (
              <div key={company.id} className="admin-mobile-card">
                <div className="admin-mobile-card-header">
                  <div className="avatar" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                    <Building2 size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{company.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{company.code}</div>
                  </div>
                  {company.status ? (
                    <span className="badge badge-success"><CheckCircle size={12} style={{ marginRight: '4px' }} /> Active</span>
                  ) : (
                    <span className="badge badge-danger"><XCircle size={12} style={{ marginRight: '4px' }} /> Inactive</span>
                  )}
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Address</span>
                  <span className="admin-mobile-card-value">{company.address || '--'}</span>
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Branches</span>
                  <span className="admin-mobile-card-value">{company.branch_count ?? '--'}</span>
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Employees</span>
                  <span className="admin-mobile-card-value">{company.employee_count ?? '--'}</span>
                </div>
                <div className="admin-mobile-card-actions">
                  <button style={{ border: '1px solid var(--border)', background: 'white', color: 'var(--text-primary)' }} onClick={() => setViewCompany(company)}>
                    <Eye size={16} /> View
                  </button>
                  <button style={{ border: '1px solid var(--border)', background: 'white', color: 'var(--text-primary)' }} onClick={() => openEdit(company)}>
                    <Pencil size={16} /> Edit
                  </button>
                  {company.status ? (
                    <button style={{ border: '1px solid var(--danger)', background: '#fef2f2', color: 'var(--danger)' }} onClick={() => setDeactivateCompany(company)}>
                      <XCircle size={16} /> Deactivate
                    </button>
                  ) : (
                    <button style={{ border: '1px solid var(--success)', background: '#ecfdf5', color: 'var(--success)' }} onClick={() => setActivateCompany(company)}>
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
              <h2 style={{ margin: 0, fontWeight: 600 }}>{editMode ? 'Edit Company' : 'Add Company'}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}><X size={24} /></button>
            </div>
            
            <div className="universal-modal-body">
              {error && <div style={{ color: 'var(--danger)', padding: '0.75rem 1rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}
              
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 500 }}>Company Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input required type="text" className="form-control" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Attendance Management" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 500 }}>Company Code <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input required type="text" className="form-control" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="e.g., ASP" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 500 }}>Address</label>
                  <textarea className="form-control" rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Enter full address..." />
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
      {viewCompany && (
        <div className="modal-overlay universal-modal-overlay">
          <div className="universal-modal-content" style={{ maxWidth: '700px' }}>
            <div className="universal-modal-header">
              <div>
                <h2 style={{ margin: 0, fontWeight: 600 }}>Company Details</h2>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Complete company information</div>
              </div>
              <button className="btn-icon" onClick={() => setViewCompany(null)}><X size={24} /></button>
            </div>
            
            <div className="universal-modal-body">
              <div className="card" style={{ padding: '1.25rem', boxShadow: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '1rem' }}>Company Information</h3>
                <div className="universal-grid-2">
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company Name</div>
                    <div style={{ fontWeight: 500 }}>{viewCompany.name || '--'}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company Code</div>
                    <div style={{ fontWeight: 500 }}>{viewCompany.code || '--'}</div>
                  </div>
                  <div className="universal-long-text" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Address</div>
                    <div style={{ fontWeight: 400, lineHeight: 1.5 }}>{viewCompany.address || '--'}</div>
                  </div>
                </div>
              </div>
              
              <div className="card" style={{ padding: '1.25rem', boxShadow: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '1rem' }}>Statistics & Status</h3>
                <div className="universal-grid-3">
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Branches</div>
                    <div style={{ fontWeight: 500 }}>{viewCompany.branch_count ?? '--'}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Employees</div>
                    <div style={{ fontWeight: 500 }}>{viewCompany.employee_count ?? '--'}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Status</div>
                    <div style={{ fontWeight: 500 }}>
                      {viewCompany.status ? (
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
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(viewCompany.created_at)}</div>
                  </div>
                  <div className="universal-long-text">
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Updated</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(viewCompany.updated_at)}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewCompany(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Activate Confirmation Modal */}
      {activateCompany && (
        <div className="modal-overlay universal-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="universal-modal-content" style={{ maxWidth: '400px' }}>
            <div className="universal-modal-body">
              <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Activate Company?</h2>
              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Are you sure you want to activate this company?
              </p>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company Name:</div>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{activateCompany.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company Code:</div>
                <div style={{ fontWeight: 500 }}>{activateCompany.code || '--'}</div>
              </div>
            </div>
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => { setActivateCompany(null); setError(null); }} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleStatusChange(activateCompany, true)} disabled={actionLoading}>{actionLoading ? 'Activating...' : 'Activate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivateCompany && (
        <div className="modal-overlay universal-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="universal-modal-content" style={{ maxWidth: '400px' }}>
            <div className="universal-modal-body">
              <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Deactivate Company?</h2>
              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Are you sure you want to deactivate this company?
              </p>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company Name:</div>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{deactivateCompany.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company Code:</div>
                <div style={{ fontWeight: 500 }}>{deactivateCompany.code || '--'}</div>
              </div>
            </div>
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => { setDeactivateCompany(null); setError(null); }} disabled={actionLoading}>Cancel</button>
              <button className="btn" style={{ backgroundColor: 'var(--warning)', color: 'white' }} onClick={() => handleStatusChange(deactivateCompany, false)} disabled={actionLoading}>{actionLoading ? 'Deactivating...' : 'Deactivate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCompany && (
        <div className="modal-overlay universal-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="universal-modal-content" style={{ maxWidth: '400px' }}>
            <div className="universal-modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={20} />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Delete Company?</h2>
              </div>
              
              {error && <div style={{ color: 'var(--danger)', marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.9rem', lineHeight: 1.4 }}>{error}</div>}
              
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete <strong>{deleteCompany.name}</strong>? This action cannot be undone.
              </p>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company Name:</div>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{deleteCompany.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company Code:</div>
                <div style={{ fontWeight: 500 }}>{deleteCompany.code || '--'}</div>
              </div>
            </div>
            <div className="universal-modal-footer">
              <button className="btn btn-secondary" onClick={() => { setDeleteCompany(null); setError(null); }} disabled={actionLoading}>Cancel</button>
              <button className="btn" style={{ backgroundColor: 'var(--danger)', color: 'white' }} onClick={() => handleDelete(deleteCompany)} disabled={actionLoading}>{actionLoading ? 'Deleting...' : 'Delete Company'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Companies;

