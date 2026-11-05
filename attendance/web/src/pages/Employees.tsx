import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Users,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Eye,
  Pencil,
  MoreVertical,
  Building2,
  MapPin,
  CalendarDays,
} from 'lucide-react';

import { CustomSelect } from '../components/CustomSelect';

import { type Company } from './Companies';
import { type Branch } from './Branches';

import api from '../services/api';
import { employeeService } from '../services/employeeService';
import EmployeeMonthlyAttendanceModal from '../components/employee/EmployeeMonthlyAttendanceModal';

export interface Employee {
  id: number;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  work_type: 'OFFICE' | 'FIELD';
  status: boolean;
  branch: number;
  phone_number?: string;
  email?: string | null;
  company?: number | { id: number; name?: string };
  company_name?: string;
  branch_name?: string;
  profile_photo?: string | null;
  shift?: any;
  role?: string;
  created_at?: string;
  updated_at?: string;
}

const Employees = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
// Confirmation modals
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    employeeId?: number;
    employeeName?: string;
    employeeCode?: string;
    phone?: string;
  }>({
    isOpen: false,
  });

  const [activateModalState, setActivateModalState] = useState<{
    isOpen: boolean;
    employeeId?: number;
    employeeName?: string;
    employeeCode?: string;
  }>({
    isOpen: false,
  });

  const [deactivateModalState, setDeactivateModalState] = useState<{
    isOpen: boolean;
    employeeId?: number;
    employeeName?: string;
    employeeCode?: string;
  }>({
    isOpen: false,
  });

  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [monthlyAttendanceEmployee, setMonthlyAttendanceEmployee] = useState<Employee | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ============================================================
  // INITIAL DATA
  // ============================================================

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [companiesResponse, branchesResponse] = await Promise.all([
          api.get('/companies/'),
          api.get('/branches/'),
        ]);

        const companyData =
          companiesResponse.data?.results ?? companiesResponse.data ?? [];

        const branchData =
          branchesResponse.data?.results ?? branchesResponse.data ?? [];

        setCompanies(Array.isArray(companyData) ? companyData : []);
        setBranches(Array.isArray(branchData) ? branchData : []);
      } catch (error) {
        console.error('Failed to load companies/branches:', error);
      }
    };

    loadInitialData();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      if (!target.closest('.dropdown-container')) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ============================================================
  // FETCH EMPLOYEES
  // ============================================================

  const fetchEmployees = async () => {
    try {
      setLoading(true);

      const params: Record<string, string> = {};

      if (selectedCompany) {
        params.company = selectedCompany;
      }

      if (selectedBranch) {
        params.branch = selectedBranch;
      }

      const response = await employeeService.getEmployees(params);

      const data =
        response.data?.results ??
        response.data ??
        [];

      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [selectedCompany, selectedBranch]);

  // ============================================================
  // FILTERS
  // ============================================================

  const handleCompanyChange = (value: string) => {
    setSelectedCompany(value);

    // Company changes should reset branch filter.
    setSelectedBranch('');
  };

  const filteredBranches = branches.filter((branch: any) => {
    if (!branch.status) {
      return false;
    }

    if (!selectedCompany) {
      return true;
    }

    return Number(branch.company) === Number(selectedCompany);
  });

  const filteredEmployees = employees.filter((employee) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      employee.full_name?.toLowerCase().includes(query) ||
      employee.employee_id?.toLowerCase().includes(query) ||
      employee.phone_number?.toLowerCase().includes(query) ||
      employee.email?.toLowerCase().includes(query) ||
      employee.department?.toLowerCase().includes(query) ||
      employee.designation?.toLowerCase().includes(query)
    );
  });

  // ============================================================
  // VIEW EMPLOYEE
  // ============================================================

  const handleView = (employeeId: number) => {
    setActiveDropdown(null);
    navigate(`/admin/employees/${employeeId}`);
  };

  // ============================================================
  // EDIT EMPLOYEE
  // ============================================================

  const handleEdit = (employeeId: number) => {
    setActiveDropdown(null);
    navigate(`/admin/employees/${employeeId}/edit`);
  };

  // ============================================================
  // DELETE
  // ============================================================

  const handleDeleteRequest = (employee: Employee) => {
    setDeleteModalState({
      isOpen: true,
      employeeId: employee.id,
      employeeName: employee.full_name,
      employeeCode: employee.employee_id,
      phone: employee.phone_number,
    });

    setActiveDropdown(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalState.employeeId) {
      return;
    }

    setActionLoading(true);

    try {
      await employeeService.deleteEmployee(
        deleteModalState.employeeId
      );

      alert('Employee deleted successfully.');

      setDeleteModalState({ isOpen: false });

      await fetchEmployees();
    } catch (error: any) {
      const status = error.response?.status;
      const code = error.response?.data?.code;

      if (
        status === 409 ||
        code === 'EMPLOYEE_HAS_ATTENDANCE' ||
        code === 'EMPLOYEE_HAS_HISTORY'
      ) {
        alert(
          error.response?.data?.message ||
            error.response?.data?.detail ||
            'This employee cannot be permanently deleted because attendance history exists. Deactivate the employee instead.'
        );
      } else {
        alert(
          error.response?.data?.detail ||
            error.response?.data?.message ||
            'Failed to delete employee.'
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // ACTIVATE
  // ============================================================

  const handleActivateRequest = (employee: Employee) => {
    setActivateModalState({
      isOpen: true,
      employeeId: employee.id,
      employeeName: employee.full_name,
      employeeCode: employee.employee_id,
    });

    setActiveDropdown(null);
  };

  const handleConfirmActivate = async () => {
    if (!activateModalState.employeeId) {
      return;
    }

    setActionLoading(true);

    try {
      await employeeService.activateEmployee(
        activateModalState.employeeId
      );

      alert('Employee activated successfully.');

      setActivateModalState({ isOpen: false });

      await fetchEmployees();
    } catch (error: any) {
      alert(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          'Failed to activate employee.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // DEACTIVATE
  // ============================================================

  const handleDeactivateRequest = (employee: Employee) => {
    setDeactivateModalState({
      isOpen: true,
      employeeId: employee.id,
      employeeName: employee.full_name,
      employeeCode: employee.employee_id,
    });

    setActiveDropdown(null);
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateModalState.employeeId) {
      return;
    }

    setActionLoading(true);

    try {
      await employeeService.deactivateEmployee(
        deactivateModalState.employeeId
      );

      alert('Employee deactivated successfully.');

      setDeactivateModalState({ isOpen: false });

      await fetchEmployees();
    } catch (error: any) {
      alert(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          'Failed to deactivate employee.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // HELPERS
  // ============================================================


  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div>
      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

      <div className="flex-between page-header">
        <div>
          <h2>Employees</h2>

          <div className="page-subtitle">
            Manage employees and their attendance assignments.
          </div>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/admin/employees/add')}
          >
            <Plus size={18} />
            Add Employee
          </button>
        </div>
      </div>

      {/* ======================================================
          STAT CARDS
          ====================================================== */}

      <div
        className="stat-card-grid"
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          className="card stat-card"
          style={{ padding: '1rem 1.5rem' }}
        >
          <div className="stat-label">
            Total Employees
          </div>

          <div className="stat-value">
            {employees.length}
          </div>
        </div>

        <div
          className="card stat-card"
          style={{ padding: '1rem 1.5rem' }}
        >
          <div className="stat-label">
            Active
          </div>

          <div
            className="stat-value"
            style={{ color: 'var(--success)' }}
          >
            {employees.filter(
              (employee) => employee.status
            ).length}
          </div>
        </div>

        <div
          className="card stat-card"
          style={{ padding: '1rem 1.5rem' }}
        >
          <div className="stat-label">
            Inactive
          </div>

          <div
            className="stat-value"
            style={{ color: 'var(--danger)' }}
          >
            {employees.filter(
              (employee) => !employee.status
            ).length}
          </div>
        </div>

        <div
          className="card stat-card"
          style={{ padding: '1rem 1.5rem' }}
        >
          <div className="stat-label">
            Field Staff
          </div>

          <div
            className="stat-value"
            style={{ color: 'var(--info)' }}
          >
            {employees.filter(
              (employee) => employee.work_type === 'FIELD'
            ).length}
          </div>
        </div>
      </div>

      {/* ======================================================
          FILTERS
          ====================================================== */}

      <div
        className="admin-filters"
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div
          style={{
            position: 'relative',
            flexGrow: 1,
            maxWidth: '300px',
          }}
        >
          <Search
            size={16}
            color="var(--text-muted)"
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />

          <input
            type="text"
            className="form-control"
            placeholder="Search employees..."
            style={{ paddingLeft: '2.5rem' }}
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
          />
        </div>

        {/* Company */}
        <CustomSelect
          options={[
            {
              value: '',
              label: 'All Companies',
            },
            ...companies
              .filter((company) => company.status)
              .map((company) => ({
                value: company.id.toString(),
                label: company.name,
              })),
          ]}
          value={selectedCompany}
          onChange={handleCompanyChange}
          placeholder="All Companies"
          icon={<Building2 size={18} />}
          searchPlaceholder="Search companies..."
        />

        {/* Branch */}
        <CustomSelect
          options={[
            {
              value: '',
              label: 'All Branches',
            },
            ...filteredBranches.map((branch: any) => ({
              value: branch.id.toString(),
              label:
                branch.branch_name ||
                `Branch ${branch.id}`,
            })),
          ]}
          value={selectedBranch}
          onChange={(value) =>
            setSelectedBranch(value)
          }
          placeholder="All Branches"
          icon={<MapPin size={18} />}
          searchPlaceholder="Search branches..."
        />
      </div>

      {/* ======================================================
          EMPLOYEE CONTENT
          ====================================================== */}

      <div
        className="table-container"
        style={{ minHeight: '300px' }}
      >
        {loading ? (
          <div className="empty-state">
            Loading employees...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="empty-state">
            <Users
              size={48}
              color="var(--border)"
              style={{ marginBottom: '1rem' }}
            />

            <h3>No employees found</h3>

            <p>
              Add your first employee to start managing
              attendance.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => navigate('/admin/employees/add')}
            >
              <Plus size={18} />
              Add Employee
            </button>
          </div>
        ) : (
          <>
            {/* ==================================================
                DESKTOP TABLE
                ================================================== */}

            <div
              className="admin-table-desktop"
              style={{ overflowX: 'auto' }}
            >
              <table style={{ minWidth: '950px' }}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Work Type</th>
                    <th>Status</th>
                    <th style={{ minWidth: '140px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id}>
                      {/* Employee */}
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                          }}
                        >
                          <div className="avatar">
                            {employee.full_name
                              ?.charAt(0)
                              .toUpperCase() || '?'}
                          </div>

                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                color:
                                  'var(--text-primary)',
                              }}
                            >
                              {employee.full_name}
                            </div>

                            <div
                              style={{
                                fontSize: '0.75rem',
                                color:
                                  'var(--text-muted)',
                              }}
                            >
                              {employee.employee_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td>
                        {employee.department || '--'}
                      </td>

                      {/* Designation */}
                      <td>
                        {employee.designation || '--'}
                      </td>

                      {/* Work Type */}
                      <td>
                        <span
                          className={`badge ${
                            employee.work_type === 'OFFICE'
                              ? 'badge-info'
                              : 'badge-warning'
                          }`}
                        >
                          {employee.work_type === 'OFFICE'
                            ? 'Office'
                            : 'Field / Marketing'}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        {employee.status ? (
                          <span className="badge badge-success">
                            <CheckCircle
                              size={12}
                              style={{
                                marginRight: '4px',
                              }}
                            />
                            Active
                          </span>
                        ) : (
                          <span className="badge badge-danger">
                            <XCircle
                              size={12}
                              style={{
                                marginRight: '4px',
                              }}
                            />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          {/* View */}
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() =>
                              handleView(employee.id)
                            }
                            title="View"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Monthly Attendance */}
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => {
                              setMonthlyAttendanceEmployee(employee);
                              setActiveDropdown(null);
                            }}
                            title="Monthly Attendance"
                          >
                            <CalendarDays size={16} />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() =>
                              handleEdit(employee.id)
                            }
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>

                          {/* More */}
                          <div
                            style={{
                              position: 'relative',
                            }}
                            className="dropdown-container"
                          >
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() =>
                                setActiveDropdown(
                                  activeDropdown ===
                                    employee.id
                                    ? null
                                    : employee.id
                                )
                              }
                              title="More actions"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {activeDropdown ===
                              employee.id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  backgroundColor: 'white',
                                  boxShadow:
                                    '0 8px 24px rgba(15,23,42,0.14)',
                                  borderRadius:
                                    'var(--radius-sm)',
                                  border:
                                    '1px solid var(--border)',
                                  zIndex: 1000,
                                  minWidth: '160px',
                                  padding: '0.5rem 0',
                                }}
                              >
                                {/* View */}
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    padding:
                                      '0.5rem 1rem',
                                    textAlign: 'left',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem',
                                    color:
                                      'var(--text-primary)',
                                  }}
                                  onClick={() =>
                                    handleView(
                                      employee.id
                                    )
                                  }
                                >
                                  <Eye
                                    size={16}
                                    color="var(--text-muted)"
                                  />
                                  View
                                </button>

                                {/* Edit */}
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    padding:
                                      '0.5rem 1rem',
                                    textAlign: 'left',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem',
                                    color:
                                      'var(--text-primary)',
                                  }}
                                  onClick={() =>
                                    handleEdit(
                                      employee.id
                                    )
                                  }
                                >
                                  <Pencil
                                    size={16}
                                    color="var(--text-muted)"
                                  />
                                  Edit
                                </button>

                                {/* Activate / Deactivate */}
                                {employee.status ? (
                                  <button
                                    type="button"
                                    style={{
                                      width: '100%',
                                      padding:
                                        '0.5rem 1rem',
                                      textAlign: 'left',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems:
                                        'center',
                                      gap: '0.5rem',
                                      fontSize: '0.875rem',
                                      color:
                                        'var(--text-primary)',
                                    }}
                                    onClick={() =>
                                      handleDeactivateRequest(
                                        employee
                                      )
                                    }
                                  >
                                    <XCircle
                                      size={16}
                                      color="var(--text-muted)"
                                    />
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    style={{
                                      width: '100%',
                                      padding:
                                        '0.5rem 1rem',
                                      textAlign: 'left',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems:
                                        'center',
                                      gap: '0.5rem',
                                      fontSize: '0.875rem',
                                      color:
                                        'var(--text-primary)',
                                    }}
                                    onClick={() =>
                                      handleActivateRequest(
                                        employee
                                      )
                                    }
                                  >
                                    <CheckCircle
                                      size={16}
                                      color="var(--text-muted)"
                                    />
                                    Activate
                                  </button>
                                )}

                                <div
                                  style={{
                                    borderTop:
                                      '1px solid var(--border)',
                                    margin:
                                      '0.25rem 0',
                                  }}
                                />

                                {/* Delete */}
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    padding:
                                      '0.5rem 1rem',
                                    textAlign: 'left',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem',
                                    color:
                                      'var(--danger)',
                                  }}
                                  onClick={() =>
                                    handleDeleteRequest(
                                      employee
                                    )
                                  }
                                >
                                  <Trash2
                                    size={16}
                                    color="var(--danger)"
                                  />
                                  Delete
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

            {/* ==================================================
                MOBILE CARDS
                ================================================== */}

            <div className="admin-cards-mobile">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="admin-mobile-card"
                >
                  <div className="admin-mobile-card-header">
                    <div className="avatar">
                      {employee.full_name
                        ?.charAt(0)
                        .toUpperCase() || '-'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {employee.full_name}
                      </div>

                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {employee.employee_id}
                      </div>
                    </div>

                    {employee.status ? (
                      <span className="badge badge-success">
                        <CheckCircle
                          size={12}
                          style={{
                            marginRight: '4px',
                          }}
                        />
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        <XCircle
                          size={12}
                          style={{
                            marginRight: '4px',
                          }}
                        />
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="admin-mobile-card-row">
                    <span className="admin-mobile-card-label">
                      Department
                    </span>

                    <span className="admin-mobile-card-value">
                      {employee.department || '--'}
                    </span>
                  </div>

                  <div className="admin-mobile-card-row">
                    <span className="admin-mobile-card-label">
                      Designation
                    </span>

                    <span className="admin-mobile-card-value">
                      {employee.designation || '--'}
                    </span>
                  </div>

                  <div className="admin-mobile-card-row">
                    <span className="admin-mobile-card-label">
                      Work Type
                    </span>

                    <span className="admin-mobile-card-value">
                      {employee.work_type === 'FIELD'
                        ? 'Field / Marketing'
                        : 'Office'}
                    </span>
                  </div>

                  {employee.phone_number && (
                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">
                        Phone
                      </span>

                      <span className="admin-mobile-card-value">
                        {employee.phone_number}
                      </span>
                    </div>
                  )}

                  {employee.email && (
                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">
                        Email
                      </span>

                      <span className="admin-mobile-card-value">
                        {employee.email}
                      </span>
                    </div>
                  )}

                  <div className="admin-mobile-card-actions">
  <button
    type="button"
    className="btn-icon"
    title="View"
    aria-label="View"
    onClick={() => handleView(employee.id)}
  >
    <Eye size={16} />
  </button>

  <button
    type="button"
    className="btn-icon"
    title="Monthly Attendance"
    aria-label="Monthly Attendance"
    onClick={() => setMonthlyAttendanceEmployee(employee)}
  >
    <CalendarDays size={16} />
  </button>

  <button
    type="button"
    className="btn-icon"
    title="Edit"
    aria-label="Edit"
    onClick={() => handleEdit(employee.id)}
  >
    <Pencil size={16} />
  </button>

  <button
    type="button"
    className="btn-icon"
    title="Delete"
    aria-label="Delete"
    onClick={() => handleDeleteRequest(employee)}
  >
    <Trash2 size={16} color="var(--danger)" />
  </button>
</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ======================================================
          DELETE CONFIRMATION
          ====================================================== */}

      {deleteModalState.isOpen && (
        <div
          className="modal-overlay"
          style={{
            backgroundColor:
              'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '400px',
              width: '100%',
              borderRadius: '16px',
              boxShadow:
                '0 10px 25px rgba(0,0,0,0.1)',
              padding: '2rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor:
                    'var(--danger-bg)',
                  color: 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={20} />
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                }}
              >
                Delete Employee?
              </h2>
            </div>

            <p
              style={{
                color: 'var(--text-secondary)',
                marginBottom: '1.5rem',
                lineHeight: 1.5,
              }}
            >
              Are you sure you want to permanently
              delete this employee?
            </p>

            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--bg-page)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '2rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.25rem',
                }}
              >
                Employee:
              </div>

              <div
                style={{
                  fontWeight: 600,
                  marginBottom: '0.75rem',
                }}
              >
                {deleteModalState.employeeName}
              </div>

              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.25rem',
                }}
              >
                Employee ID:
              </div>

              <div style={{ fontWeight: 500 }}>
                {deleteModalState.employeeCode ||
                  '--'}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setDeleteModalState({
                    isOpen: false,
                  })
                }
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn"
                style={{
                  backgroundColor:
                    'var(--danger)',
                  color: 'white',
                }}
                onClick={handleConfirmDelete}
                disabled={actionLoading}
              >
                {actionLoading
                  ? 'Deleting...'
                  : 'Delete Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          DEACTIVATE CONFIRMATION
          ====================================================== */}

      {deactivateModalState.isOpen && (
        <div
          className="modal-overlay"
          style={{
            backgroundColor:
              'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '400px',
              width: '100%',
              borderRadius: '16px',
              boxShadow:
                '0 10px 25px rgba(0,0,0,0.1)',
              padding: '2rem',
            }}
          >
            <h2
              style={{
                margin: '0 0 1rem 0',
                fontSize: '1.25rem',
                fontWeight: 600,
              }}
            >
              Deactivate Employee?
            </h2>

            <p
              style={{
                color: 'var(--text-secondary)',
                marginBottom: '1.5rem',
                lineHeight: 1.5,
              }}
            >
              Are you sure you want to deactivate
              this employee?
            </p>

            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--bg-page)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '2rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.25rem',
                }}
              >
                Employee Name:
              </div>

              <div
                style={{
                  fontWeight: 600,
                  marginBottom: '0.75rem',
                }}
              >
                {deactivateModalState.employeeName}
              </div>

              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.25rem',
                }}
              >
                Employee ID:
              </div>

              <div style={{ fontWeight: 500 }}>
                {deactivateModalState.employeeCode ||
                  '--'}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setDeactivateModalState({
                    isOpen: false,
                  })
                }
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn"
                style={{
                  backgroundColor:
                    'var(--warning)',
                  color: 'white',
                }}
                onClick={handleConfirmDeactivate}
                disabled={actionLoading}
              >
                {actionLoading
                  ? 'Deactivating...'
                  : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          ACTIVATE CONFIRMATION
          ====================================================== */}

      {activateModalState.isOpen && (
        <div
          className="modal-overlay"
          style={{
            backgroundColor:
              'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '400px',
              width: '100%',
              borderRadius: '16px',
              boxShadow:
                '0 10px 25px rgba(0,0,0,0.1)',
              padding: '2rem',
            }}
          >
            <h2
              style={{
                margin: '0 0 1rem 0',
                fontSize: '1.25rem',
                fontWeight: 600,
              }}
            >
              Activate Employee?
            </h2>

            <p
              style={{
                color: 'var(--text-secondary)',
                marginBottom: '1.5rem',
                lineHeight: 1.5,
              }}
            >
              Are you sure you want to activate
              this employee?
            </p>

            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--bg-page)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '2rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.25rem',
                }}
              >
                Employee Name:
              </div>

              <div
                style={{
                  fontWeight: 600,
                  marginBottom: '0.75rem',
                }}
              >
                {activateModalState.employeeName}
              </div>

              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.25rem',
                }}
              >
                Employee ID:
              </div>

              <div style={{ fontWeight: 500 }}>
                {activateModalState.employeeCode ||
                  '--'}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setActivateModalState({
                    isOpen: false,
                  })
                }
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmActivate}
                disabled={actionLoading}
              >
                {actionLoading
                  ? 'Activating...'
                  : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ======================================================
          MONTHLY ATTENDANCE CALENDAR
          ====================================================== */}

      {monthlyAttendanceEmployee && (
        <EmployeeMonthlyAttendanceModal
          employee={monthlyAttendanceEmployee}
          isOpen={true}
          onClose={() => setMonthlyAttendanceEmployee(null)}
        />
      )}
    </div>
  );
};

export default Employees;















