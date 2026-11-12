import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Building,
  Calendar,
  User,
  Shield,
  Loader2,
} from 'lucide-react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { CustomSelect } from '../components/CustomSelect';
import './ReportingManagers.css';

interface ReportingManager {
  id: number;
  employee_id: string;
  full_name: string;
  email?: string;
  user_id: number;
  username: string;
  phone_number?: string;
  branch?: number;
  branch_name?: string;
  company_id?: number;
  company_name?: string;
  is_active: boolean;
  account_status: string;
  status: boolean;
  created_at?: string;
}

interface BranchOption {
  id: number;
  branch_name: string;
  company_id?: number;
}

interface CompanyOption {
  id: number;
  name: string;
}

const ReportingManagers: React.FC = () => {
  const { user } = useContext(AuthContext);
  const [managers, setManagers] = useState<ReportingManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Companies & Branches list
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Selected manager for view/edit/delete
  const [selectedManager, setSelectedManager] = useState<ReportingManager | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    status: 'ACTIVE',
    companyId: 'ALL',
    branchId: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  // Status banners / error handling
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // FETCH MANAGERS
  // ---------------------------------------------------------------------------
  const fetchManagers = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (user?.role === 'SUPER_ADMIN' && user?.company_id) {
        params.company = user.company_id;
      }

      const res = await api.get('/employees/hr/managers/', { params });
      setManagers(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to fetch reporting managers:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, user]);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  // Fetch companies & branches
  const fetchCompaniesAndBranches = useCallback(async () => {
    try {
      setBranchesLoading(true);
      const [compRes, branchRes] = await Promise.all([
        api.get('/companies/'),
        api.get('/branches/'),
      ]);
      const compData = compRes.data?.results ?? compRes.data ?? [];
      const branchData = branchRes.data?.results ?? branchRes.data ?? [];
      setCompanies(Array.isArray(compData) ? compData : []);
      setBranches(Array.isArray(branchData) ? branchData : []);
    } catch (err: any) {
      console.error('Failed to load companies/branches:', err);
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompaniesAndBranches();
  }, [fetchCompaniesAndBranches]);

  // Flash success helper
  const notifySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 4000);
  };

  // ---------------------------------------------------------------------------
  // 1. ADD MANAGER
  // ---------------------------------------------------------------------------
  const handleOpenAdd = () => {
    const defaultCompany = user?.role === 'SUPER_ADMIN' ? 'ALL' : String(user?.company_id || 'ALL');
    setFormData({
      fullName: '',
      username: '',
      password: '',
      status: 'ACTIVE',
      companyId: defaultCompany,
      branchId: '',
    });
    setShowPassword(false);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.fullName.trim();
    const uname = formData.username.trim();
    const pwd = formData.password;

    if (!name) {
      setFormError('Manager Name is required.');
      return;
    }
    if (!uname) {
      setFormError('Username is required.');
      return;
    }
    if (!pwd || pwd.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setFormLoading(true);
      const payload: any = {
        full_name: name,
        username: uname,
        password: pwd,
        status: formData.status,
        company_id: formData.companyId,
      };
      if (formData.companyId !== 'ALL' && formData.branchId) {
        payload.branch_id = parseInt(formData.branchId, 10);
      }

      await api.post('/employees/hr/managers/', payload);

      setShowAddModal(false);
      notifySuccess(`Reporting Manager "${name}" created successfully.`);
      fetchManagers();
    } catch (err: any) {
      console.error('Add Manager error:', err);
      const data = err.response?.data;
      let msg = 'Failed to create manager. Please check your inputs.';
      if (typeof data === 'string') {
        msg = data;
      } else if (data?.username) {
        msg = Array.isArray(data.username) ? data.username[0] : data.username;
      } else if (data?.full_name) {
        msg = Array.isArray(data.full_name) ? data.full_name[0] : data.full_name;
      } else if (data?.password) {
        msg = Array.isArray(data.password) ? data.password[0] : data.password;
      } else if (data?.branch_id) {
        msg = Array.isArray(data.branch_id) ? data.branch_id[0] : data.branch_id;
      } else if (data?.detail) {
        msg = data.detail;
      }
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. VIEW MANAGER
  // ---------------------------------------------------------------------------
  const handleOpenView = (manager: ReportingManager) => {
    setSelectedManager(manager);
    setShowViewModal(true);
  };

  // ---------------------------------------------------------------------------
  // 3. EDIT MANAGER
  // ---------------------------------------------------------------------------
  const handleOpenEdit = (manager: ReportingManager) => {
    setSelectedManager(manager);
    const mgrCompany = manager.company_id ? String(manager.company_id) : 'ALL';
    setFormData({
      fullName: manager.full_name || '',
      username: manager.username || '',
      password: '',
      status: (manager.status && manager.is_active) ? 'ACTIVE' : 'INACTIVE',
      companyId: mgrCompany,
      branchId: manager.branch ? String(manager.branch) : '',
    });
    setShowPassword(false);
    setFormError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManager) return;
    setFormError(null);

    const name = formData.fullName.trim();
    const uname = formData.username.trim();
    const pwd = formData.password;

    if (!name) {
      setFormError('Manager Name is required.');
      return;
    }
    if (!uname) {
      setFormError('Username is required.');
      return;
    }
    if (pwd && pwd.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setFormLoading(true);
      const payload: any = {
        full_name: name,
        username: uname,
        status: formData.status,
        company_id: formData.companyId,
      };
      if (pwd) {
        payload.password = pwd;
      }
      if (formData.companyId === 'ALL') {
        payload.branch_id = 0; // Clear branch
      } else if (formData.branchId) {
        payload.branch_id = parseInt(formData.branchId, 10);
      }

      await api.patch(`/employees/hr/managers/${selectedManager.id}/`, payload);

      setShowEditModal(false);
      notifySuccess(`Reporting Manager "${name}" updated successfully.`);
      fetchManagers();
    } catch (err: any) {
      console.error('Edit Manager error:', err);
      const data = err.response?.data;
      let msg = 'Failed to update manager.';
      if (typeof data === 'string') {
        msg = data;
      } else if (data?.username) {
        msg = Array.isArray(data.username) ? data.username[0] : data.username;
      } else if (data?.branch_id) {
        msg = Array.isArray(data.branch_id) ? data.branch_id[0] : data.branch_id;
      } else if (data?.detail) {
        msg = data.detail;
      }
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. DELETE MANAGER
  // ---------------------------------------------------------------------------
  const handleOpenDelete = (manager: ReportingManager) => {
    setSelectedManager(manager);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedManager) return;
    try {
      setFormLoading(true);
      await api.delete(`/employees/hr/managers/${selectedManager.id}/`);
      setShowDeleteModal(false);
      notifySuccess(`Reporting Manager "${selectedManager.full_name}" removed successfully.`);
      fetchManagers();
    } catch (err: any) {
      console.error('Delete Manager error:', err);
      const msg = err.response?.data?.detail || 'Failed to remove manager.';
      alert(msg);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="reporting-managers-page">
      {/* HEADER */}
      <div className="rm-header">
        <div>
          <h1>Reporting Managers</h1>
          <p>Oversee company reporting managers, access status, and login accounts.</p>
        </div>
        <div className="rm-actions">
          <button className="rm-btn rm-btn-primary" onClick={handleOpenAdd}>
            <UserPlus size={16} />
            <span>+ Add Manager</span>
          </button>
        </div>
      </div>

      {/* NOTIFICATION BANNER */}
      {successMsg && (
        <div className="rm-alert-success" role="alert">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TOOLBAR: SEARCH & STATUS FILTER */}
      <div className="rm-toolbar">
        <div className="rm-search-box">
          <Search size={18} className="rm-search-icon" />
          <input
            type="text"
            className="rm-search-input"
            placeholder="Search by manager name or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="rm-filter-box" style={{ width: '170px' }}>
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active Only' },
              { value: 'inactive', label: 'Inactive Only' },
            ]}
            placeholder="Status"
          />
        </div>
      </div>

      {/* MANAGERS TABLE */}
      <div className="rm-table-card">
        {loading ? (
          <div className="rm-empty-state">
            <Loader2 size={32} className="rm-spinner-icon" />
            <p>Loading reporting managers...</p>
          </div>
        ) : managers.length === 0 ? (
          <div className="rm-empty-state">
            <Users size={48} style={{ color: '#cbd5e1', marginBottom: 12 }} />
            <h3>No Reporting Managers Found</h3>
            <p>There are no reporting managers created yet. Click "+ Add Manager" above to create one.</p>
          </div>
        ) : (
          <table className="rm-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Manager Name</th>
                <th style={{ width: '15%' }}>Employee ID</th>
                <th style={{ width: '16%' }}>Company</th>
                <th style={{ width: '16%' }}>Branch</th>
                <th style={{ width: '15%' }}>Username</th>
                <th style={{ width: '8%' }}>Status</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => {
                const isActive = m.status && m.is_active;
                return (
                  <tr key={m.id}>
                    {/* COLUMN 1: MANAGER NAME */}
                    <td>
                      <div className="rm-profile-cell">
                        <div className="rm-avatar">
                          {m.full_name ? m.full_name.charAt(0).toUpperCase() : 'M'}
                        </div>
                        <div className="rm-name">{m.full_name}</div>
                      </div>
                    </td>

                    {/* COLUMN 2: EMPLOYEE ID */}
                    <td>
                      <code>{m.employee_id || 'ID Pending'}</code>
                    </td>

                    {/* COLUMN 3: COMPANY */}
                    <td>
                      <span style={{ fontWeight: 500, color: '#334155' }}>
                        {m.company_name || user?.company_name || 'Standard'}
                      </span>
                    </td>

                    {/* COLUMN 4: BRANCH */}
                    <td>
                      <span style={{ fontWeight: 500, color: '#475569' }}>
                        {m.branch_name || '—'}
                      </span>
                    </td>

                    {/* COLUMN 5: USERNAME */}
                    <td>
                      <div style={{ fontWeight: 500, color: '#334155' }}>
                        {m.username || '—'}
                      </div>
                    </td>

                    {/* COLUMN 6: STATUS */}
                    <td>
                      <span className={`rm-badge ${isActive ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* COLUMN 7: ACTIONS (View, Edit, Delete) */}
                    <td style={{ textAlign: 'right' }}>
                      <div className="rm-action-btns" style={{ justifyContent: 'flex-end' }}>
                        {/* VIEW ACTION */}
                        <button
                          type="button"
                          className="rm-icon-btn"
                          title="View Manager"
                          onClick={() => handleOpenView(m)}
                        >
                          <Eye size={16} />
                        </button>

                        {/* EDIT ACTION */}
                        <button
                          type="button"
                          className="rm-icon-btn"
                          title="Edit Manager"
                          onClick={() => handleOpenEdit(m)}
                        >
                          <Pencil size={16} />
                        </button>

                        {/* DELETE ACTION */}
                        <button
                          type="button"
                          className="rm-icon-btn rm-btn-delete"
                          title="Delete Manager"
                          onClick={() => handleOpenDelete(m)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: ADD MANAGER                                                 */}
      {/* ==================================================================== */}
      {showAddModal && (
        <div className="rm-modal-backdrop" onClick={() => !formLoading && setShowAddModal(false)}>
          <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-header">
              <h2>Add Reporting Manager</h2>
              <button
                type="button"
                className="rm-close-btn"
                disabled={formLoading}
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="rm-modal-body">
                {formError && (
                  <div className="rm-modal-error">
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* COMPANY SELECTION (ALL COMPANIES OR SPECIFIC COMPANY) */}
                <div className="rm-form-group">
                  <label>Company *</label>
                  {user?.role === 'SUPER_ADMIN' ? (
                    <CustomSelect
                      value={formData.companyId}
                      onChange={(val) => {
                        setFormData({
                          ...formData,
                          companyId: val,
                          branchId: '', // Reset branch when company changes
                        });
                      }}
                      options={[
                        { value: 'ALL', label: 'All Companies (Global Access)' },
                        ...companies.map((c) => ({
                          value: String(c.id),
                          label: c.name,
                        })),
                      ]}
                      placeholder="Select company"
                    />
                  ) : (
                    <input
                      type="text"
                      className="rm-input"
                      value={user?.company_name || 'Yaazh 360'}
                      disabled
                      style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                    />
                  )}
                </div>

                {/* BRANCH SELECTION */}
                <div className="rm-form-group">
                  <label>
                    Branch {formData.companyId === 'ALL' ? '(All Branches Covered)' : '*'}
                  </label>
                  {formData.companyId === 'ALL' ? (
                    <input
                      type="text"
                      className="rm-input"
                      value="All Branches (Global Access Across All Companies)"
                      disabled
                      style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                    />
                  ) : (
                    <CustomSelect
                      value={formData.branchId}
                      onChange={(val) => setFormData({ ...formData, branchId: val })}
                      options={branches
                        .filter(
                          (b) =>
                            !b.company_id ||
                            String(b.company_id) === formData.companyId
                        )
                        .map((b) => ({
                          value: String(b.id),
                          label: b.branch_name,
                        }))}
                      placeholder={branchesLoading ? 'Loading branches...' : 'Select branch'}
                    />
                  )}
                </div>

                {/* MANAGER NAME */}
                <div className="rm-form-group">
                  <label htmlFor="add-manager-name">Manager Name *</label>
                  <input
                    id="add-manager-name"
                    type="text"
                    className="rm-input"
                    placeholder="e.g. Arun Kumar"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                {/* USERNAME */}
                <div className="rm-form-group">
                  <label htmlFor="add-manager-username">Username *</label>
                  <input
                    id="add-manager-username"
                    type="text"
                    className="rm-input"
                    placeholder="e.g. arun_manager"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>

                {/* PASSWORD */}
                <div className="rm-form-group">
                  <label htmlFor="add-manager-password">Password *</label>
                  <div className="rm-password-wrap">
                    <input
                      id="add-manager-password"
                      type={showPassword ? 'text' : 'password'}
                      className="rm-input"
                      placeholder="Minimum 6 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="rm-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* STATUS */}
                <div className="rm-form-group">
                  <label>Status</label>
                  <CustomSelect
                    value={formData.status}
                    onChange={(val) => setFormData({ ...formData, status: val })}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'INACTIVE', label: 'Inactive' },
                    ]}
                    placeholder="Select status"
                  />
                </div>
              </div>

              <div className="rm-modal-footer">
                <button
                  type="button"
                  className="rm-btn rm-btn-secondary"
                  disabled={formLoading}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rm-btn rm-btn-primary"
                  disabled={formLoading}
                >
                  {formLoading ? 'Creating Manager...' : 'Add Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: VIEW MANAGER                                                */}
      {/* ==================================================================== */}
      {showViewModal && selectedManager && (
        <div className="rm-modal-backdrop" onClick={() => setShowViewModal(false)}>
          <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-header">
              <h2>Reporting Manager Details</h2>
              <button
                type="button"
                className="rm-close-btn"
                onClick={() => setShowViewModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="rm-modal-body">
              <div className="rm-view-grid">
                <div className="rm-view-item">
                  <span className="rm-view-label">
                    <User size={14} /> Manager Name
                  </span>
                  <span className="rm-view-val">{selectedManager.full_name}</span>
                </div>

                <div className="rm-view-item">
                  <span className="rm-view-label">
                    <Shield size={14} /> Employee ID
                  </span>
                  <span className="rm-view-val">{selectedManager.employee_id || 'Not Assigned'}</span>
                </div>

                <div className="rm-view-item">
                  <span className="rm-view-label">
                    <User size={14} /> Login Username
                  </span>
                  <span className="rm-view-val">{selectedManager.username}</span>
                </div>

                <div className="rm-view-item">
                  <span className="rm-view-label">
                    <Building size={14} /> Company
                  </span>
                  <span className="rm-view-val">{selectedManager.company_name || 'Standard'}</span>
                </div>

                <div className="rm-view-item">
                  <span className="rm-view-label">
                    <Building size={14} /> Branch
                  </span>
                  <span className="rm-view-val">{selectedManager.branch_name || 'Main Branch'}</span>
                </div>

                <div className="rm-view-item">
                  <span className="rm-view-label">Account Status</span>
                  <span className="rm-view-val">
                    <span
                      className={`rm-badge ${
                        selectedManager.status && selectedManager.is_active
                          ? 'rm-badge-active'
                          : 'rm-badge-inactive'
                      }`}
                    >
                      {selectedManager.status && selectedManager.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </span>
                </div>

                <div className="rm-view-item">
                  <span className="rm-view-label">
                    <Calendar size={14} /> Created Date
                  </span>
                  <span className="rm-view-val">
                    {selectedManager.created_at
                      ? new Date(selectedManager.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rm-modal-footer">
              <button
                type="button"
                className="rm-btn rm-btn-secondary"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: EDIT MANAGER                                                */}
      {/* ==================================================================== */}
      {showEditModal && selectedManager && (
        <div className="rm-modal-backdrop" onClick={() => !formLoading && setShowEditModal(false)}>
          <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-header">
              <h2>Edit Reporting Manager</h2>
              <button
                type="button"
                className="rm-close-btn"
                disabled={formLoading}
                onClick={() => setShowEditModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="rm-modal-body">
                {formError && (
                  <div className="rm-modal-error">
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* COMPANY SELECTION (ALL COMPANIES OR SPECIFIC COMPANY) */}
                <div className="rm-form-group">
                  <label>Company *</label>
                  {user?.role === 'SUPER_ADMIN' ? (
                    <CustomSelect
                      value={formData.companyId}
                      onChange={(val) => {
                        setFormData({
                          ...formData,
                          companyId: val,
                          branchId: '', // Reset branch when company changes
                        });
                      }}
                      options={[
                        { value: 'ALL', label: 'All Companies (Global Access)' },
                        ...companies.map((c) => ({
                          value: String(c.id),
                          label: c.name,
                        })),
                      ]}
                      placeholder="Select company"
                    />
                  ) : (
                    <input
                      type="text"
                      className="rm-input"
                      value={user?.company_name || 'Yaazh 360'}
                      disabled
                      style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                    />
                  )}
                </div>

                {/* BRANCH SELECTION */}
                <div className="rm-form-group">
                  <label>
                    Branch {formData.companyId === 'ALL' ? '(All Branches Covered)' : '*'}
                  </label>
                  {formData.companyId === 'ALL' ? (
                    <input
                      type="text"
                      className="rm-input"
                      value="All Branches (Global Access Across All Companies)"
                      disabled
                      style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                    />
                  ) : (
                    <CustomSelect
                      value={formData.branchId}
                      onChange={(val) => setFormData({ ...formData, branchId: val })}
                      options={branches
                        .filter(
                          (b) =>
                            !b.company_id ||
                            String(b.company_id) === formData.companyId
                        )
                        .map((b) => ({
                          value: String(b.id),
                          label: b.branch_name,
                        }))}
                      placeholder={branchesLoading ? 'Loading branches...' : 'Select branch'}
                    />
                  )}
                </div>

                {/* MANAGER NAME */}
                <div className="rm-form-group">
                  <label htmlFor="edit-manager-name">Manager Name *</label>
                  <input
                    id="edit-manager-name"
                    type="text"
                    className="rm-input"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>

                {/* USERNAME */}
                <div className="rm-form-group">
                  <label htmlFor="edit-manager-username">Username *</label>
                  <input
                    id="edit-manager-username"
                    type="text"
                    className="rm-input"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>

                {/* PASSWORD (OPTIONAL) */}
                <div className="rm-form-group">
                  <label htmlFor="edit-manager-password">
                    Password <span style={{ color: '#64748b', fontWeight: 400 }}>(Leave blank to keep existing password)</span>
                  </label>
                  <div className="rm-password-wrap">
                    <input
                      id="edit-manager-password"
                      type={showPassword ? 'text' : 'password'}
                      className="rm-input"
                      placeholder="Enter new password if changing"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="rm-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* STATUS */}
                <div className="rm-form-group">
                  <label>Status</label>
                  <CustomSelect
                    value={formData.status}
                    onChange={(val) => setFormData({ ...formData, status: val })}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'INACTIVE', label: 'Inactive' },
                    ]}
                    placeholder="Select status"
                  />
                </div>
              </div>

              <div className="rm-modal-footer">
                <button
                  type="button"
                  className="rm-btn rm-btn-secondary"
                  disabled={formLoading}
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rm-btn rm-btn-primary"
                  disabled={formLoading}
                >
                  {formLoading ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: DELETE CONFIRMATION                                         */}
      {/* ==================================================================== */}
      {showDeleteModal && selectedManager && (
        <div className="rm-modal-backdrop" onClick={() => !formLoading && setShowDeleteModal(false)}>
          <div className="rm-modal rm-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-header">
              <h2>Confirm Deletion</h2>
              <button
                type="button"
                className="rm-close-btn"
                disabled={formLoading}
                onClick={() => setShowDeleteModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="rm-modal-body">
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={20} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 16, color: '#0f172a' }}>
                    Are you sure you want to delete this Reporting Manager?
                  </h4>
                  <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
                    Manager: <strong>{selectedManager.full_name}</strong> ({selectedManager.username})
                    <br />
                    This will remove their manager privileges and deactivate their manager login account.
                    Historical attendance and employee data will not be affected.
                  </p>
                </div>
              </div>
            </div>

            <div className="rm-modal-footer">
              <button
                type="button"
                className="rm-btn rm-btn-secondary"
                disabled={formLoading}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rm-btn rm-btn-danger"
                disabled={formLoading}
                onClick={handleDeleteConfirm}
              >
                {formLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportingManagers;
