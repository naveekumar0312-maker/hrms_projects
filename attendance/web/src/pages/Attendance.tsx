  const getOverallAttendanceStatus = (record: AttendanceRecord): string => {
    if (record.check_in_approval_status === 'REJECTED' || record.check_out_approval_status === 'REJECTED') return 'REJECTED';
    const recStatus = String(record.calculated_status || record.status || '').toUpperCase();
    if (recStatus === 'HOLIDAY') return 'HOLIDAY';
    if (recStatus === 'ON_LEAVE' || recStatus === 'ON LEAVE') return 'ON LEAVE';
    if (recStatus === 'HALF DAY' || recStatus === 'HALF_DAY') return 'HALF DAY';
    if (recStatus === 'ABSENT') return 'ABSENT';
    if (recStatus === 'LATE' || (record.late_minutes && record.late_minutes > 0)) return 'LATE';
    if (recStatus === 'PRESENT' || recStatus === 'ON_TIME' || recStatus === 'COMPLETED' || recStatus === 'WORKING') return 'PRESENT';
    if (record.check_in_time || record.check_out_time) {
      if (record.check_in_approval_status === 'PENDING' || record.check_out_approval_status === 'PENDING') return 'PENDING APPROVAL';
      return 'PRESENT';
    }
    return recStatus || 'PENDING';
  };

  const getAttendanceStatusBadgeClass = (statusText: string): string => {
    switch (statusText) {
      case 'PRESENT':
        return 'badge-success';
      case 'LATE':
      case 'ON LEAVE':
      case 'HALF DAY':
        return 'badge-warning';
      case 'ABSENT':
      case 'REJECTED':
        return 'badge-danger';
      case 'HOLIDAY':
      case 'PENDING APPROVAL':
      case 'PENDING':
      default:
        return 'badge-info';
    }
  };

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  MapPin,
  Search,
  Eye,
  X,
  Check,
  XCircle,
  Building2,
  RotateCcw,
} from 'lucide-react';
    
import { CustomSelect } from '../components/CustomSelect';
import { CustomDatePicker } from '../components/CustomDatePicker';
import api from '../services/api';
import { getPermissions, type PermissionRequest } from '../api/permissions';
import { type Company } from './Companies';
import { type Branch } from './Branches';

type RelatedValue =
  | string
  | number
  | null
  | undefined
  | {
      id?: number | string;
      name?: string;
      company_name?: string;
      branch_name?: string;
      full_name?: string;
      designation?: string;
      department?: string;
      work_type?: string;
      workType?: string;
      phone_number?: string;
      employee_id?: string;
    };

const formatPermissionTime = (value?: string | null): string => {
  if (!value) return "--";
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = match[2];
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${minute} ${period}`;
};
export interface AttendanceRecord {
  calculated_status?: string;
  approved_permissions?: Array<{
    id: number;
    date: string;
    status: string;
    start_time: string | null;
    end_time: string | null;
    duration_minutes: number;
    approved_at?: string | null;
  }>;
  permission_minutes?: number;
  id: number;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  late_minutes: number;
  grace_used?: boolean;
  late_display?: string;
  early_minutes?: number;
  overtime_minutes?: number;
  working_minutes?: number;
  working_hours: string | null;
  approval_status: string;
  rejection_reason?: string;

  check_in_approval_status?: string;
  check_in_rejection_reason?: string | null;
  check_out_approval_status?: string;
  check_out_rejection_reason?: string | null;

  check_in_photo?: string;
  check_out_photo?: string;

  check_in_latitude?: number;
  check_in_longitude?: number;
  check_in_accuracy?: number;
  check_out_latitude?: number;
  check_out_longitude?: number;
  check_out_accuracy?: number;

  check_in_location_name?: string | null;
  check_out_location_name?: string | null;

  work_type?: string | null;
  company?: RelatedValue;
  branch?: RelatedValue;
  company_name?: string | null;
  branch_name?: string | null;

  employee?: {
    id: number;
    full_name?: string;
    name?: string;
    employee_id?: string;
    department?: string;
    designation?: string;
    phone_number?: string;
    work_type?: string;
    workType?: string;
    branch?: RelatedValue;
    company?: RelatedValue;
    branch_name?: string;
    company_name?: string;
    shift?: RelatedValue;
  } | null;
}

const getTextValue = (value: RelatedValue, keys: string[] = ['name']): string => {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  for (const key of keys) {
    const item = value as Record<string, unknown>;
    const found = item[key];
    if (typeof found === 'string' && found.trim()) {
      return found.trim();
    }
  }

  return '';
};

const getCompanyName = (record: AttendanceRecord): string => {
  const employee = record.employee;

  return (
    getTextValue(employee?.company, ['name', 'company_name']) ||
    employee?.company_name ||
    getTextValue(record.company, ['name', 'company_name']) ||
    record.company_name ||
    '--'
  );
};

const getBranchName = (record: AttendanceRecord): string => {
  const employee = record.employee;

  return (
    getTextValue(employee?.branch, ['branch_name', 'name']) ||
    employee?.branch_name ||
    getTextValue(record.branch, ['branch_name', 'name']) ||
    record.branch_name ||
    '--'
  );
};

const getWorkType = (record: AttendanceRecord): string => {
  const employee = record.employee;

  return (
    employee?.work_type ||
    employee?.workType ||
    record.work_type ||
    '--'
  );
};

const getDepartment = (record: AttendanceRecord): string => {
  return record.employee?.department || '--';
};

const getDesignation = (record: AttendanceRecord): string => {
  return record.employee?.designation || '--';
};

const getPhoneNumber = (record: AttendanceRecord): string => {
  return record.employee?.phone_number || '--';
};

const getShiftName = (record: AttendanceRecord): string => {
  return getTextValue(record.employee?.shift, ['name', 'code']) || '--';
};

const normalizeDate = (value: string | null | undefined): string => {
  if (!value) return '';

  // Django DateField normally returns YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const formatTime = (isoString: string | null) => {
  if (!isoString) return '--';

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--';

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '--';

  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '--';

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDuration = (minutes: number | undefined) => {
  if (!minutes || minutes <= 0) return 'On time';

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;

  return `${h}h ${m}m`;
};

const formatLiveWorkingHours = (
  workingHours: string | null,
  checkInTime: string | null,
  checkOutTime: string | null
) => {
  if (checkOutTime) {
    return formatWorkingHours(workingHours);
  }

  if (!checkInTime) {
    return '--';
  }

  const checkIn = new Date(checkInTime);
  if (Number.isNaN(checkIn.getTime())) {
    return '--';
  }

  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - checkIn.getTime()) / 60000)
  );

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  if (hours === 0 && minutes === 0) return '0m';
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;

  return `${hours}h ${minutes}m`;
};

const formatWorkingHours = (wh: string | null) => {
  if (!wh || typeof wh !== 'string') return '--';

  const parts = wh.split(':');

  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);

    if (Number.isNaN(h) || Number.isNaN(m)) return wh;
    if (h === 0 && m === 0) return '--';
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;

    return `${h}h ${m}m`;
  }

  return wh;
};


const Attendance = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [attendancePage, setAttendancePage] = useState(1);

  const getDateForAttendancePage = (page: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() - (page - 1));

    return `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  useEffect(() => {
    setSelectedDate(getDateForAttendancePage(attendancePage));
  }, [attendancePage]);
  const [searchEmployee, setSearchEmployee] = useState('');


  const [viewRecord, setViewRecord] = useState<AttendanceRecord | null>(null);
  const [approveRecord, setApproveRecord] = useState<AttendanceRecord | null>(null);
  const [approveType, setApproveType] = useState<'check_in' | 'check_out' | null>(null);
  const [rejectRecord, setRejectRecord] = useState<AttendanceRecord | null>(null);
  const [rejectType, setRejectType] = useState<'check_in' | 'check_out' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (viewRecord || approveRecord || rejectRecord || previewImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [viewRecord, approveRecord, rejectRecord, previewImage]);

  useEffect(() => {
    Promise.all([
      api.get('/companies/'),
      api.get('/branches/'),
    ])
      .then(([companyResponse, branchResponse]) => {
        const companyData =
          companyResponse.data?.results || companyResponse.data || [];
        const branchData =
          branchResponse.data?.results || branchResponse.data || [];

        setCompanies(Array.isArray(companyData) ? companyData : []);
        setBranches(Array.isArray(branchData) ? branchData : []);
      })
      .catch((error) => {
        console.error('Failed to load companies/branches:', error);
      });
  }, []);

  const fetchAttendance = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (selectedCompany) {
        params.append('company', selectedCompany);
      }

      if (selectedBranch) {
        params.append('branch', selectedBranch);
      }

      // Send the selected date to the backend.
      // We also filter locally below, so the selected date always controls
      // what is shown even if the API returns a wider result set.
      if (selectedDate) {
        params.append('date', selectedDate);
      }

      const query = params.toString();
      const response = await api.get(`/attendance/${query ? `?${query}` : ''}`);

      const data = response.data?.results || response.data || [];

      // PERMISSION_LIST_ENRICHMENT
      const permissionResponse = await getPermissions();
      const permissionData: PermissionRequest[] = Array.isArray(permissionResponse)
        ? permissionResponse
        : permissionResponse?.results || [];

      const safeRecords = Array.isArray(data) ? data : [];
      const enrichedRecords = safeRecords.map((record: AttendanceRecord) => {
        const employeeId = String(
          record.employee?.employee_id ??
          
          
          ''
        ).trim().toUpperCase();

        const employeePk = String(
          record.employee?.id ?? record.employee ?? ''
        );

        const matchingPermissions = permissionData
          .filter((permission) => {
            const permissionEmployeeId = String(permission.employee_id ?? '')
              .trim()
              .toUpperCase();
            const sameEmployee =
              (employeeId && permissionEmployeeId && employeeId === permissionEmployeeId) ||
              (permission.employee != null && employeePk && String(permission.employee) === employeePk);

            return sameEmployee && permission.date === record.date;
          })
          .filter((permission) => permission.status === 'APPROVED')
          .map((permission) => ({
            id: permission.id,
            date: permission.date,
            status: permission.status,
            start_time: permission.start_time ?? null,
            end_time: permission.end_time ?? null,
            duration_minutes: permission.duration_minutes,
            approved_at: permission.approved_at ?? null,
          }));

        return {
          ...record,
          approved_permissions: matchingPermissions,
          permission_minutes: matchingPermissions.reduce(
            (total, permission) => total + Number(permission.duration_minutes || 0),
            0
          ),
        };
      });
      setRecords(enrichedRecords);
    } catch (error) {
      console.error('Failed to load attendance:', error);
      setRecords([]);
      showToast('Unable to load attendance details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, selectedBranch, selectedDate]);

  const filteredBranches = useMemo(() => {
    if (!selectedCompany) return branches;

    return branches.filter(
      (branch) =>
        String(branch.company) === String(selectedCompany)
    );
  }, [branches, selectedCompany]);

  const visibleRecords = useMemo(() => {
    let result = [...records];

    if (selectedDate) {
      result = result.filter(
        (record) => normalizeDate(record.date) === selectedDate
      );
    }

    const search = searchEmployee.trim().toLowerCase();

    if (search) {
      result = result.filter((record) => {
        const employeeName =
          record.employee?.full_name ||
          record.employee?.name ||
          '';

        const employeeId =
          record.employee?.employee_id || '';

        const phone =
          record.employee?.phone_number || '';

        return (
          employeeName.toLowerCase().includes(search) ||
          employeeId.toLowerCase().includes(search) ||
          phone.toLowerCase().includes(search)
        );
      });
    }

    // Safety against duplicate rows.
    return Array.from(
      new Map(result.map((record) => [record.id, record])).values()
    );
  }, [records, selectedDate, searchEmployee]);

  const pendingRecords = useMemo(
    () => visibleRecords.filter((record) => record.status === 'PENDING'),
    [visibleRecords]
  );

  const absentRecords = useMemo(
    () => visibleRecords.filter((record) => record.status === 'ABSENT'),
    [visibleRecords]
  );

  const normalRecords = useMemo(
    () =>
      visibleRecords.filter(
        (record) =>
          record.status !== 'PENDING' &&
          record.status !== 'ABSENT'
      ),
    [visibleRecords]
  );

  const selectedDateLabel = selectedDate
    ? formatDate(selectedDate)
    : 'All Dates';



  const handleResetFilters = () => {
    setSelectedCompany('');
    setSelectedBranch('');
    setSearchEmployee('');
    setAttendancePage(1);
    setSelectedDate(getDateForAttendancePage(1));
  };

  const handleApprove = async () => {
    if (!approveRecord) return;

    try {
      const response = await api.patch(
        approveType === 'check_in' ? `/attendance/${approveRecord.id}/check-in-approve/` : `/attendance/${approveRecord.id}/check-out-approve/`
      );

      setRecords((previous) =>
        previous.map((record) =>
          record.id === approveRecord.id ? response.data : record
        )
      );

      showToast('Attendance approved successfully.', 'success');
      setApproveRecord(null);

      if (viewRecord?.id === approveRecord.id) {
        setViewRecord(response.data);
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.error ||
          'Error approving attendance.',
        'error'
      );
    }
  };

  const handleReject = async () => {
    if (!rejectRecord) return;

    if (!rejectionReason.trim()) {
      showToast('Rejection reason is required.', 'error');
      return;
    }

    try {
      const response = await api.patch(
        rejectType === 'check_in' ? `/attendance/${rejectRecord.id}/check-in-reject/` : `/attendance/${rejectRecord.id}/check-out-reject/`,
        { reason: rejectionReason.trim() }
      );

      setRecords((previous) =>
        previous.map((record) =>
          record.id === rejectRecord.id ? response.data : record
        )
      );

      showToast('Attendance rejected successfully.', 'success');
      setRejectRecord(null);
      setRejectionReason('');

      if (viewRecord?.id === rejectRecord.id) {
        setViewRecord(response.data);
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.error ||
          'Error rejecting attendance.',
        'error'
      );
    }
  };

  return (
    <div>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '1rem',
            borderRadius: '8px',
            color: '#fff',
            backgroundColor:
              toast.type === 'success'
                ? '#E56108'
                : '#ef4444',
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
          }}
        >
          {toast.message}
        </div>
      )}

      <div className="flex-between page-header">
        <div>
          <h2>Attendance</h2>
          <div className="page-subtitle">
            Monitor employee attendance across companies and branches.
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="admin-filters"
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <CustomSelect
          options={[
            { value: '', label: 'All Companies' },
            ...companies.map((company) => ({
              value: company.id.toString(),
              label: company.name,
            })),
          ]}
          value={selectedCompany}
          onChange={(value) => {
            setSelectedCompany(value);
            setSelectedBranch('');
          }}
          placeholder="All Companies"
          icon={<Building2 size={18} />}
          searchPlaceholder="Search companies..."
        />

        <CustomSelect
          options={[
            { value: '', label: 'All Branches' },
            ...filteredBranches.map((branch) => ({
              value: branch.id.toString(),
              label:
                branch.branch_name ||
                `Branch ${branch.id}`,
            })),
          ]}
          value={selectedBranch}
          onChange={setSelectedBranch}
          placeholder="All Branches"
          icon={<MapPin size={18} />}
          searchPlaceholder="Search branches..."
        />

        {/* Standardized LiveLocations DatePicker */}
        <div style={{ minWidth: '220px' }}>
          <CustomDatePicker
            value={selectedDate}
            onChange={(val) => {
              if (!val) {
                setSelectedDate('');
                return;
              }
              const selected = new Date(`${val}T00:00:00`);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              selected.setHours(0, 0, 0, 0);
              const diffDays = Math.floor((today.getTime() - selected.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0) {
                setAttendancePage(diffDays + 1);
              } else {
                setSelectedDate(val);
              }
            }}
            placeholder="All Dates"
          />
        </div>

        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />

          <input
            type="text"
            className="form-control"
            placeholder="Search employee..."
            value={searchEmployee}
            onChange={(event) =>
              setSearchEmployee(event.target.value)
            }
            style={{
              paddingLeft: '2.5rem',
              width: '250px',
            }}
          />
        </div>

        {(selectedCompany ||
          selectedBranch ||
          selectedDate ||
          searchEmployee) && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '42px',
            }}
          >
            <RotateCcw size={16} />
            Clear
          </button>
        )}
      </div>

      {/* Selected date indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
          padding: '12px 16px',
          borderRadius: '10px',
          background: '#F8F9FC',
          border: '1px solid #bbf7d0',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginBottom: '3px',
            }}
          >
            ATTENDANCE DATE
          </div>
          <div
            style={{
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            {selectedDateLabel}
          </div>
        </div>

        <div
          style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
          }}
        >
          {visibleRecords.length}{' '}
          {visibleRecords.length === 1
            ? 'attendance'
            : 'attendances'}{' '}
          shown
        </div>
      </div>

      {/* Attendance list */}
      <div
        className="table-container"
        style={{ minHeight: '300px' }}
      >
        {loading ? (
          <div className="empty-state">
            Loading attendance records...
          </div>
        ) : visibleRecords.length === 0 ? (
          <div className="empty-state">
            <Calendar
              size={48}
              color="var(--border)"
              style={{ marginBottom: '1rem' }}
            />
            <h3>No attendance records found</h3>
            <p>
              {selectedDate
                ? `No attendance found for ${formatDate(
                    selectedDate
                  )}.`
                : 'No records match your current filters.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div
              className="admin-table-desktop"
              style={{ overflowX: 'auto' }}
            >
              <table style={{ minWidth: '1050px' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>
                      Employee
                    </th>
                    <th style={{ minWidth: '180px' }}>
                      Company
                    </th>
                    <th style={{ minWidth: '180px' }}>
                      Branch
                    </th>
                    <th style={{ minWidth: '120px' }}>
                      Punch In
                    </th>
                    <th style={{ minWidth: '110px' }}>
                      Late
                    </th>
                    <th style={{ minWidth: '120px' }}>
                      Punch Out
                    </th>
                    <th style={{ minWidth: '150px' }}>
                      Status
                    </th>
                    <th style={{ minWidth: '240px' }}>
                      Action
                    </th>

                    {/* PERMISSION_TABLE_COLUMN */}
                    <th style={{ minWidth: '210px' }}>Permission</th>
                  </tr>
                </thead>

                <tbody>
                  {normalRecords.map((record) => {
                    const empName =
                      record.employee?.full_name ||
                      record.employee?.name ||
                      'Unknown';

                    const empId =
                      record.employee?.employee_id ||
                      '--';

                    const companyName =
                      getCompanyName(record);

                    const branchName =
                      getBranchName(record);

                    return (
                      <tr key={record.id}>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                            }}
                          >
                            <div className="avatar">
                              {empName[0]?.toUpperCase() ||
                                '-'}
                            </div>

                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color:
                                    'var(--text-primary)',
                                }}
                              >
                                {empName}
                              </div>

                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color:
                                    'var(--text-muted)',
                                }}
                              >
                                {empId}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td
                          style={{
                            color:
                              'var(--text-secondary)',
                          }}
                        >
                          {companyName}
                        </td>

                        <td
                          style={{
                            color:
                              'var(--text-secondary)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <MapPin
                              size={14}
                              color="var(--text-muted)"
                            />
                            {branchName}
                          </div>
                        </td>

                        <td>
                          <div
                            style={{
                              fontWeight: 500,
                              color:
                                'var(--text-primary)',
                            }}
                          >
                            {formatTime(
                              record.check_in_time
                            )}
                          </div>
                        </td>

                        <td>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: '5px',
                            }}
                          >
                            <span
                              style={{
                                color:
                                  record.late_minutes > 0
                                    ? 'var(--warning)'
                                    : 'var(--text-muted)',
                                fontWeight:
                                  record.late_minutes > 0 ? 600 : 500,
                              }}
                            >
                              {record.late_display ||
                                formatDuration(record.late_minutes)}
                            </span>

                            {record.grace_used && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '3px 8px',
                                  borderRadius: '999px',
                                  background: '#EFF6FF',
                                  color: '#CC5200',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Grace Used
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection:
                                'column',
                              gap: '2px',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 500,
                                color:
                                  'var(--text-primary)',
                              }}
                            >
                              {formatTime(
                                record.check_out_time
                              )}
                            </span>

                            {record.early_minutes &&
                            record.early_minutes >
                              0 ? (
                              <span
                                style={{
                                  fontSize:
                                    '0.75rem',
                                  color:
                                    'var(--warning)',
                                }}
                              >
                                Early by{' '}
                                {formatDuration(
                                  record.early_minutes
                                )}
                              </span>
                            ) : null}

                            {record.overtime_minutes &&
                            record.overtime_minutes >
                              0 ? (
                              <span
                                style={{
                                  fontSize:
                                    '0.75rem',
                                  color:
                                    'var(--success)',
                                }}
                              >
                                Overtime{' '}
                                {formatDuration(
                                  record.overtime_minutes
                                )}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection:
                                'column',
                              gap: '4px',
                            }}
                          >
                            <span
                              className={`badge ${getAttendanceStatusBadgeClass(getOverallAttendanceStatus(record))}`}
                            >
                              {getOverallAttendanceStatus(record)}
                            </span>


                          </div>
                        </td>

                        <td style={{minWidth: '330px', whiteSpace: 'nowrap'}}><div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}><button style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', border: '1px solid #e2e8f0', background: '#fff', color: '#334155', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, width: 'fit-content'}} onClick={() => setViewRecord(record)} title='View Details'><Eye size={15} /> View Details</button><div style={{display: 'flex', alignItems: 'center', gap: '8px', minHeight: '30px'}}><span style={{width: '68px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b'}}>Punch In</span><span style={{width: '68px', fontSize: '0.72rem', fontWeight: 600, color: '#334155'}}>{formatTime(record.check_in_time)}</span>{record.check_in_time && record.check_in_approval_status === 'PENDING' ? <><button style={{display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1px solid #E56108', background: '#eff6ff', color: '#CC5200', borderRadius: '7px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600}} onClick={() => {setApproveRecord(record);setApproveType('check_in');}}><Check size={13} /> Approve</button><button style={{display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1px solid #ef4444', background: '#fef2f2', color: '#dc2626', borderRadius: '7px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600}} onClick={() => {setRejectRecord(record);setRejectType('check_in');}}><XCircle size={13} /> Reject</button></> : record.check_in_approval_status === 'APPROVED' ? <span className='badge badge-success'>Approved</span> : record.check_in_approval_status === 'REJECTED' ? <span className='badge badge-danger'>Rejected</span> : <span style={{fontSize: '0.72rem', color: '#94a3b8'}}>--</span>}</div><div style={{display: 'flex', alignItems: 'center', gap: '8px', minHeight: '30px'}}><span style={{width: '68px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b'}}>Punch Out</span><span style={{width: '68px', fontSize: '0.72rem', fontWeight: 600, color: '#334155'}}>{formatTime(record.check_out_time)}</span>{record.check_out_time && record.check_out_approval_status === 'PENDING' ? <><button style={{display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1px solid #E56108', background: '#eff6ff', color: '#CC5200', borderRadius: '7px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600}} onClick={() => {setApproveRecord(record);setApproveType('check_out');}}><Check size={13} /> Approve</button><button style={{display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1px solid #ef4444', background: '#fef2f2', color: '#dc2626', borderRadius: '7px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600}} onClick={() => {setRejectRecord(record);setRejectType('check_out');}}><XCircle size={13} /> Reject</button></> : record.check_out_approval_status === 'APPROVED' ? <span className='badge badge-success'>Approved</span> : record.check_out_approval_status === 'REJECTED' ? <span className='badge badge-danger'>Rejected</span> : <span style={{fontSize: '0.72rem', color: '#94a3b8'}}>--</span>}</div></div></td>
                                              <td style={{ minWidth: '210px', padding: '10px' }}>
                          {(() => {
                            const permissions = (record.approved_permissions || []).filter(
                              (permission) =>
                                permission.status === 'APPROVED' &&
                                permission.date === record.date
                            );

                            if (permissions.length === 0) {
                              return <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Permission Not Applied</span>;
                            }

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {permissions.map((permission) => (
                                  <div
                                    key={permission.id}
                                    style={{
                                      border: '1px solid #bfdbfe',
                                      background: '#F8F9FC',
                                      borderRadius: '8px',
                                      padding: '8px',
                                    }}
                                  >
                                    <div style={{ color: '#166534', fontWeight: 700, fontSize: '0.8rem' }}>
                                      {permission.duration_minutes >= 60 &&
                                      permission.duration_minutes % 60 === 0
                                        ? `${permission.duration_minutes / 60} ${permission.duration_minutes / 60 === 1 ? 'Hour' : 'Hours'}`
                                        : `${permission.duration_minutes} Minutes`}  APPROVED
                                    </div>
                                    <div style={{ color: '#475569', fontSize: '0.75rem', marginTop: '4px' }}>
                                      {formatPermissionTime(permission.start_time)}  {formatPermissionTime(permission.end_time)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </td></tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="admin-cards-mobile">
              {normalRecords.map((record) => {
                const empName =
                  record.employee?.full_name ||
                  record.employee?.name ||
                  'Unknown';

                const empId =
                  record.employee?.employee_id ||
                  '--';

                return (
                  <div
                    key={record.id}
                    className="admin-mobile-card"
                  >
                    <div className="admin-mobile-card-header">
                      <div className="avatar">
                        {empName[0]?.toUpperCase() ||
                          '-'}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div
                          style={{ fontWeight: 600 }}
                        >
                          {empName}
                        </div>

                        <div
                          style={{
                            fontSize: '0.75rem',
                            color:
                              'var(--text-muted)',
                          }}
                        >
                          {empId}
                        </div>
                      </div>

                      <span
                        className={`badge ${getAttendanceStatusBadgeClass(getOverallAttendanceStatus(record))}`}
                      >
                        {getOverallAttendanceStatus(record)}
                      </span>
                    </div>

                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">
                        Company
                      </span>
                      <span className="admin-mobile-card-value">
                        {getCompanyName(record)}
                      </span>
                    </div>

                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">
                        Branch
                      </span>
                      <span className="admin-mobile-card-value">
                        {getBranchName(record)}
                      </span>
                    </div>

                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">
                        Work Type
                      </span>
                      <span className="admin-mobile-card-value">
                        {getWorkType(record)}
                      </span>
                    </div>

                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">
                        Punch In
                      </span>
                      <span className="admin-mobile-card-value">
                        {formatTime(
                          record.check_in_time
                        )}
                      </span>
                    </div>

                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">
                        Punch Out
                      </span>
                      <span className="admin-mobile-card-value">
                        {formatTime(
                          record.check_out_time
                        )}
                      </span>
                    </div>

                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">
                        Working
                      </span>
                      <span className="admin-mobile-card-value">
                        {formatLiveWorkingHours(
  record.working_hours,
  record.check_in_time,
  record.check_out_time
)}
                      </span>
                    </div>

                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">
                        Late
                      </span>
                      <span
                        className="admin-mobile-card-value"
                        style={{
                          color:
                            record.late_minutes > 0
                              ? 'var(--warning)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {record.late_display ||
                          formatDuration(
                            record.late_minutes
                          )}
                      </span>
                    </div>

                    <div className="admin-mobile-card-row">
                      <span className="admin-mobile-card-label">
                        Status
                      </span>
                      <span className="admin-mobile-card-value">
                        {record.status}
                      </span>
                    </div>

                    <div className="admin-mobile-card-actions" style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
                      <button
                        style={{
                          width: '100%',
                          border: '1.5px solid #E56108',
                          background: '#EBF3FC',
                          color: '#E56108',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                        }}
                        onClick={() => setViewRecord(record)}
                      >
                        <Eye size={16} color="#E56108" />
                        View Attendance Details
                      </button>

                      {/* Punch In & Punch Out Approval Cards in Full Width Vertical Flow */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        {/* Punch In Box */}
                        <div
                          style={{
                            padding: '12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            background: '#f8fafc',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: record.check_in_time && record.check_in_approval_status === 'PENDING' ? '10px' : '0px',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Punch In
                              </div>
                              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                                {formatTime(record.check_in_time) || '--'}
                              </div>
                            </div>

                            {record.check_in_approval_status === 'APPROVED' && (
                              <span className="badge badge-success" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>Approved</span>
                            )}
                            {record.check_in_approval_status === 'REJECTED' && (
                              <span className="badge badge-danger" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>Rejected</span>
                            )}
                            {record.check_in_approval_status === 'PENDING' && (
                              <span className="badge badge-warning" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>Pending</span>
                            )}
                            {!record.check_in_time && (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>No Punch In</span>
                            )}
                          </div>

                          {record.check_in_time && record.check_in_approval_status === 'PENDING' && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <button
                                style={{
                                  flex: 1,
                                  border: '1px solid #E56108',
                                  background: '#eff6ff',
                                  color: '#CC5200',
                                  borderRadius: '8px',
                                  padding: '8px 12px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  setApproveRecord(record);
                                  setApproveType('check_in');
                                }}
                              >
                                <Check size={14} />
                                Approve
                              </button>

                              <button
                                style={{
                                  flex: 1,
                                  border: '1px solid #ef4444',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  borderRadius: '8px',
                                  padding: '8px 12px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  setRejectRecord(record);
                                  setRejectType('check_in');
                                }}
                              >
                                <XCircle size={14} />
                                Reject
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Punch Out Box */}
                        <div
                          style={{
                            padding: '12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            background: '#f8fafc',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: record.check_out_time && record.check_out_approval_status === 'PENDING' ? '10px' : '0px',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Punch Out
                              </div>
                              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                                {formatTime(record.check_out_time) || '--'}
                              </div>
                            </div>

                            {record.check_out_approval_status === 'APPROVED' && (
                              <span className="badge badge-success" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>Approved</span>
                            )}
                            {record.check_out_approval_status === 'REJECTED' && (
                              <span className="badge badge-danger" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>Rejected</span>
                            )}
                            {record.check_out_approval_status === 'PENDING' && (
                              <span className="badge badge-warning" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>Pending</span>
                            )}
                            {!record.check_out_time && (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>No Punch Out</span>
                            )}
                          </div>

                          {record.check_out_time && record.check_out_approval_status === 'PENDING' && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <button
                                style={{
                                  flex: 1,
                                  border: '1px solid #E56108',
                                  background: '#eff6ff',
                                  color: '#CC5200',
                                  borderRadius: '8px',
                                  padding: '8px 12px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  setApproveRecord(record);
                                  setApproveType('check_out');
                                }}
                              >
                                <Check size={14} />
                                Approve
                              </button>

                              <button
                                style={{
                                  flex: 1,
                                  border: '1px solid #ef4444',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  borderRadius: '8px',
                                  padding: '8px 12px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  setRejectRecord(record);
                                  setRejectType('check_out');
                                }}
                              >
                                <XCircle size={14} />
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          {/* Pending Attendance */}
          {pendingRecords.length > 0 && (
            <div
              style={{
                marginTop: '1.5rem',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                background: '#fffbeb',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#92400e',
                    }}
                  >
                    Pending Attendance
                  </h3>
                  <div
                    style={{
                      marginTop: '3px',
                      fontSize: '0.8rem',
                      color: '#a16207',
                    }}
                  >
                    Employees who have not punched yet and whose shift is still ongoing.
                  </div>
                </div>

                <span
                  style={{
                    minWidth: '30px',
                    height: '30px',
                    padding: '0 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '999px',
                    background: '#fef3c7',
                    color: '#92400e',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                  }}
                >
                  {pendingRecords.length}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                        Employee
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                        Employee ID
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                        Department
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                        Shift
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {pendingRecords.map((record) => (
                      <tr key={`pending-${record.id}`}>
                        <td style={{ padding: '12px 16px' }}>
                          <strong>
                            {record.employee?.full_name ||
                              record.employee?.name ||
                              '--'}
                          </strong>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {record.employee?.employee_id || '--'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {getDepartment(record)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {getShiftName(record)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              padding: '5px 10px',
                              borderRadius: '999px',
                              background: '#fef3c7',
                              color: '#92400e',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                            }}
                          >
                            Pending
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Absent Attendance */}
          {absentRecords.length > 0 && (
            <div
              style={{
                marginTop: '1.5rem',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                background: '#fff7f7',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#991b1b',
                    }}
                  >
                    Absent
                  </h3>
                  <div
                    style={{
                      marginTop: '3px',
                      fontSize: '0.8rem',
                      color: '#b91c1c',
                    }}
                  >
                    Employees whose shift has ended without attendance.
                  </div>
                </div>

                <span
                  style={{
                    minWidth: '30px',
                    height: '30px',
                    padding: '0 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '999px',
                    background: '#fee2e2',
                    color: '#991b1b',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                  }}
                >
                  {absentRecords.length}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                        Employee
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                        Employee ID
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                        Department
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                        Shift
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {absentRecords.map((record) => (
                      <tr key={`absent-${record.id}`}>
                        <td style={{ padding: '12px 16px' }}>
                          <strong>
                            {record.employee?.full_name ||
                              record.employee?.name ||
                              '--'}
                          </strong>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {record.employee?.employee_id || '--'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {getDepartment(record)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {getShiftName(record)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              padding: '5px 10px',
                              borderRadius: '999px',
                              background: '#fee2e2',
                              color: '#991b1b',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                            }}
                          >
                            Absent
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fragment remains open for pagination */}


          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '20px 0',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() =>
                setAttendancePage((page) => Math.max(1, page - 1))
              }
              disabled={attendancePage === 1}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background:
                  attendancePage === 1 ? '#f3f4f6' : 'white',
                color:
                  attendancePage === 1
                    ? 'var(--text-muted)'
                    : 'var(--text-primary)',
                cursor:
                  attendancePage === 1 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
               Previous
            </button>

            {Array.from({ length: 5 }, (_, index) => {
              const page = Math.max(
                1,
                attendancePage - 2
              ) + index;

              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => setAttendancePage(page)}
                  style={{
                    minWidth: '40px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border:
                      page === attendancePage
                        ? '1px solid var(--primary)'
                        : '1px solid var(--border)',
                    background:
                      page === attendancePage
                        ? 'var(--primary)'
                        : 'white',
                    color:
                      page === attendancePage
                        ? 'white'
                        : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {page}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() =>
                setAttendancePage((page) => page + 1)
              }
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'white',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Next
            </button>
          </div>
          </>
        )}
      </div>

      {/* Approve Modal */}
      {approveRecord && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor:
              'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px',
          }}
          onClick={() =>
            setApproveRecord(null)
          }
        >
          <div
            style={{
              maxWidth: '400px',
              width: '100%',
              borderRadius: '12px',
              backgroundColor: 'white',
              padding: '1.5rem',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                }}
              >
                Approve {approveType === 'check_in' ? 'Punch In' : 'Punch Out'}?
              </h3>

              <button
                onClick={() =>
                  setApproveRecord(null)
                }
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                fontSize: '0.95rem',
                color: 'var(--text-secondary)',
              }}
            >
              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>Employee:</strong>{' '}
                {approveRecord.employee?.full_name ||
                  approveRecord.employee?.name ||
                  '--'}
              </p>

              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>Date:</strong>{' '}
                {formatDate(approveRecord.date)}
              </p>

              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>Punch In:</strong>{' '}
                {formatTime(
                  approveRecord.check_in_time
                )}
              </p>

              <p style={{ margin: 0 }}>
                <strong>Punch Out:</strong>{' '}
                {formatTime(
                  approveRecord.check_out_time
                )}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                marginTop: '2rem',
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() =>
                  setApproveRecord(null)
                }
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                onClick={handleApprove}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectRecord && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor:
              'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px',
          }}
          onClick={() => {
            setRejectRecord(null);
            setRejectionReason('');
          }}
        >
          <div
            style={{
              maxWidth: '400px',
              width: '100%',
              borderRadius: '12px',
              backgroundColor: 'white',
              padding: '1.5rem',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                }}
              >
                Reject {rejectType === 'check_in' ? 'Punch In' : 'Punch Out'}?
              </h3>

              <button
                onClick={() => {
                  setRejectRecord(null);
                  setRejectionReason('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <p
                style={{
                  margin: '0 0 0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                }}
              >
                Reason:
              </p>

              <textarea
                className="form-control"
                rows={3}
                value={rejectionReason}
                onChange={(event) =>
                  setRejectionReason(
                    event.target.value
                  )
                }
                placeholder="Required rejection reason..."
                style={{
                  width: '100%',
                  resize: 'vertical',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border:
                    '1px solid var(--border)',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                marginTop: '2rem',
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setRejectRecord(null);
                  setRejectionReason('');
                }}
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                style={{
                  backgroundColor: '#ef4444',
                  borderColor: '#ef4444',
                  color: 'white',
                }}
                onClick={handleReject}
              >
                Reject {rejectType === 'check_in' ? 'Punch In' : 'Punch Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Details Modal */}
      {viewRecord && (
        <div
          className="attendance-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor:
              'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
          onClick={(event) => {
            if (
              event.target === event.currentTarget &&
              !previewImage &&
              !approveRecord &&
              !rejectRecord
            ) {
              setViewRecord(null);
            }
          }}
        >
          <div className="attendance-modal-content">
            <div className="attendance-modal-header">
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontWeight: 600,
                    color:
                      'var(--text-primary)',
                  }}
                >
                  Attendance Details
                </h3>

                <div
                  style={{
                    color: 'var(--text-muted)',
                    marginTop: '0.25rem',
                  }}
                >
                  Complete attendance information
                </div>
              </div>

              <button
                className="btn-icon"
                onClick={() =>
                  setViewRecord(null)
                }
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={24} />
              </button>
            </div>

            <div className="attendance-modal-body">
              {/* Employee Information */}
              <div>
                <h4
                  style={{
                    margin: '0 0 1rem',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color:
                      'var(--text-primary)',
                  }}
                >
                  Employee Information
                </h4>

                <div
                  style={{
                    display: 'flex',
                    gap: '1.5rem',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    className="avatar"
                    style={{
                      width: '80px',
                      height: '80px',
                      fontSize: '2rem',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        'var(--surface-50)',
                      color:
                        'var(--text-primary)',
                    }}
                  >
                    {(
                      viewRecord.employee
                        ?.full_name ||
                      viewRecord.employee?.name ||
                      '-'
                    )[0]?.toUpperCase() ||
                      '-'}
                  </div>

                  <div className="attendance-long-text">
                    <h3
                      style={{
                        margin:
                          '0 0 0.25rem',
                        fontSize: '1.2rem',
                      }}
                    >
                      {viewRecord.employee
                        ?.full_name ||
                        viewRecord.employee?.name ||
                        '--'}
                    </h3>

                    <div
                      style={{
                        color:
                          'var(--text-muted)',
                        fontWeight: 500,
                      }}
                    >
                      {viewRecord.employee
                        ?.employee_id ||
                        '--'}
                    </div>
                  </div>
                </div>

                <div className="attendance-grid-employee">
                  <div>
                    <div className="attendance-field-label">
                      Company
                    </div>
                    <div
                      className="attendance-long-text"
                      style={{ fontWeight: 500 }}
                    >
                      {getCompanyName(
                        viewRecord
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Branch
                    </div>
                    <div
                      className="attendance-long-text"
                      style={{ fontWeight: 500 }}
                    >
                      {getBranchName(
                        viewRecord
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Department
                    </div>
                    <div
                      className="attendance-long-text"
                      style={{ fontWeight: 500 }}
                    >
                      {getDepartment(
                        viewRecord
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Designation
                    </div>
                    <div
                      className="attendance-long-text"
                      style={{ fontWeight: 500 }}
                    >
                      {getDesignation(
                        viewRecord
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Work Type
                    </div>
                    <div
                      className="attendance-long-text"
                      style={{ fontWeight: 500 }}
                    >
                      {getWorkType(
                        viewRecord
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Phone Number
                    </div>
                    <div style={{ fontWeight: 500 }}>
                      {getPhoneNumber(
                        viewRecord
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Shift
                    </div>
                    <div style={{ fontWeight: 500 }}>
                      {getShiftName(
                        viewRecord
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance Summary */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border:
                    '1px solid #e2e8f0',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 1rem',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color:
                      'var(--text-primary)',
                  }}
                >
                  Attendance Summary
                </h4>

                <div className="attendance-grid-summary">
                  <div>
                    <div className="attendance-field-label">
                      Date
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {formatDate(
                        viewRecord.date
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Punch In
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {formatTime(
                        viewRecord.check_in_time
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Late
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        color:
                          viewRecord.late_minutes >
                          0
                            ? '#ef4444'
                            : 'inherit',
                      }}
                    >
                      {viewRecord.late_display ||
                        formatDuration(
                          viewRecord.late_minutes
                        )}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Punch Out
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {formatTime(
                        viewRecord.check_out_time
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Working Hours
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {formatLiveWorkingHours(viewRecord.working_hours, viewRecord.check_in_time, viewRecord.check_out_time)}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Status
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {viewRecord.status || '--'}
                    </div>
                  </div>

                  <div>
                    <div className="attendance-field-label">
                      Approval
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        color:
                          viewRecord.approval_status ===
                          'APPROVED'
                            ? '#E56108'
                            : viewRecord.approval_status ===
                                'REJECTED'
                              ? '#ef4444'
                              : '#f59e0b',
                      }}
                    >
                      {viewRecord.approval_status}
                    </div>
                  </div>
                </div>
              </div>

              {/* APPROVED PERMISSION DETAILS */}
              {(viewRecord.approved_permissions?.length ?? 0) > 0 && (
                <section
                  style={{
                    marginBottom: "1.25rem",
                    padding: "1.25rem",
                    border: "1px solid #bbf7d0",
                    borderRadius: "12px",
                    background: "#F8F9FC",
                  }}
                >
                  <h4 style={{ margin: "0 0 1rem", color: "#166534" }}>
                    Permission Used
                  </h4>
                  <div style={{ display: "grid", gap: "12px" }}>
                    {viewRecord.approved_permissions!.map((permission) => (
                      <div
                        key={permission.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "10px",
                          padding: "12px",
                          background: "#ffffff",
                          borderRadius: "8px",
                          border: "1px solid rgba(0, 86, 179, 0.12)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: "#166534" }}>
                            {permission.duration_minutes >= 60
                              ? `${Math.floor(permission.duration_minutes / 60)} ${Math.floor(permission.duration_minutes / 60) === 1 ? "Hour" : "Hours"}${permission.duration_minutes % 60 ? ` ${permission.duration_minutes % 60} Minutes` : ""}`
                              : `${permission.duration_minutes} Minutes`}
                          </div>
                          <div style={{ marginTop: "5px", fontSize: "0.875rem", color: "#475569" }}>
                            {formatPermissionTime(permission.start_time)}  {formatPermissionTime(permission.end_time)}
                          </div>
                        </div>
                        <span
                          style={{
                            padding: "5px 10px",
                            borderRadius: "20px",
                            background: "rgba(0, 86, 179, 0.12)",
                            color: "#166534",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                          }}
                        >
                          Approved
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
                            {/* APPROVED PERMISSION DETAILS */}
              {viewRecord.approved_permissions &&
                viewRecord.approved_permissions.length > 0 && (
                  <div
                    style={{
                      margin: "1rem 0",
                      padding: "1rem",
                      border: "1px solid #bfdbfe",
                      borderRadius: "12px",
                      background: "#F8F9FC",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 0.75rem",
                        color: "#166534",
                        fontSize: "1rem",
                        fontWeight: 700,
                      }}
                    >
                      Approved Permission Details
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "1rem",
                      }}
                    >
                      {viewRecord.approved_permissions.map((permission) => (
                        <div
                          key={permission.id}
                          style={{
                            padding: "0.75rem",
                            background: "#ffffff",
                            border: "1px solid rgba(0, 86, 179, 0.08)",
                            borderRadius: "8px",
                          }}
                        >
                          <div className="attendance-field-label">
                            Permission Duration
                          </div>
                          <div style={{ fontWeight: 700, color: "#166534" }}>
                            {permission.duration_minutes >= 60 &&
                            permission.duration_minutes % 60 === 0
                              ? `${permission.duration_minutes / 60} ${
                                  permission.duration_minutes / 60 === 1
                                    ? "Hour"
                                    : "Hours"
                                }`
                              : `${permission.duration_minutes} Minutes`}
                          </div>

                          <div
                            className="attendance-field-label"
                            style={{ marginTop: "0.75rem" }}
                          >
                            Permission Time
                          </div>
                          <div style={{ fontWeight: 600, color: "#334155" }}>
                            {formatPermissionTime(permission.start_time)} {" "}
                            {formatPermissionTime(permission.end_time)}
                          </div>

                          <div
                            className="attendance-field-label"
                            style={{ marginTop: "0.75rem" }}
                          >
                            Permission Status
                          </div>
                          <span
                            style={{
                              display: "inline-block",
                              marginTop: "0.25rem",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              background:
                                permission.status === "APPROVED"
                                  ? "rgba(0, 86, 179, 0.08)"
                                  : "#fef3c7",
                              color:
                                permission.status === "APPROVED"
                                  ? "#065f46"
                                  : "#92400e",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            {permission.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
{/* Punch In / Punch Out */}
              <div className="attendance-grid-details">
                {/* Punch In */}
                <div>
                  <h4
                    style={{
                      margin:
                        '0 0 1rem',
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      color:
                        'var(--text-primary)',
                      display: 'flex',
                      alignItems:
                        'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor:
                          '#E56108',
                      }}
                    />
                    Punch In Details
                  </h4>

                  {viewRecord.check_in_time ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection:
                          'column',
                        gap: '1rem',
                      }}
                    >
                      <div className="attendance-grid-stats">
                        <div>
                          <div className="attendance-field-label">
                            Time
                          </div>
                          <div
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {formatTime(
                              viewRecord.check_in_time
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="attendance-field-label">
                            Date
                          </div>
                          <div
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {formatDate(
                              viewRecord.date
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="attendance-field-label">
                            Latitude
                          </div>
                          <div
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {viewRecord.check_in_latitude ??
                              '--'}
                          </div>
                        </div>

                        <div>
                          <div className="attendance-field-label">
                            Longitude
                          </div>
                          <div
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {viewRecord.check_in_longitude ??
                              '--'}
                          </div>
                        </div>

                        <div
                          style={{
                            gridColumn:
                              '1 / -1',
                          }}
                        >
                          <div className="attendance-field-label">
                            GPS Accuracy
                          </div>
                          <div
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {viewRecord.check_in_accuracy !=
                            null
                              ? `${viewRecord.check_in_accuracy}m`
                              : '--'}
                          </div>
                        </div>

                        <div
                          style={{
                            gridColumn:
                              '1 / -1',
                          }}
                        >
                          <div
                            className="attendance-field-label"
                            style={{
                              display: 'flex',
                              alignItems:
                                'center',
                              gap: '5px',
                            }}
                          >
                            <MapPin size={14} />
                            Location
                          </div>
                          <div
                            className="attendance-long-text"
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {viewRecord.check_in_location_name ||
                              '--'}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            color:
                              'var(--text-muted)',
                            fontSize:
                              '0.85rem',
                            marginBottom:
                              '0.5rem',
                            fontWeight: 500,
                          }}
                        >
                          Punch In PHOTO
                        </div>

                        {viewRecord.check_in_photo ? (
                          <img
                            src={`${viewRecord.check_in_photo}?t=${Date.now()}`}
                            alt="Punch In"
                            className="attendance-img"
                            onClick={() =>
                              setPreviewImage(
                                viewRecord.check_in_photo ||
                                  null
                              )
                            }
                          />
                        ) : (
                          <div
                            className="attendance-img"
                            style={{
                              display: 'flex',
                              alignItems:
                                'center',
                              justifyContent:
                                'center',
                              backgroundColor:
                                '#f8fafc',
                              border:
                                '1px dashed #cbd5e1',
                              color:
                                'var(--text-muted)',
                            }}
                          >
                            No Punch In photo available
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '2rem',
                        textAlign: 'center',
                        backgroundColor:
                          '#f8fafc',
                        borderRadius: '8px',
                        color:
                          'var(--text-muted)',
                      }}
                    >
                      Not checked in
                    </div>
                  )}
                </div>

                {/* Punch Out */}
                <div>
                  <h4
                    style={{
                      margin:
                        '0 0 1rem',
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      color:
                        'var(--text-primary)',
                      display: 'flex',
                      alignItems:
                        'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor:
                          '#ef4444',
                      }}
                    />
                    Punch Out Details
                  </h4>

                  {viewRecord.check_out_time ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection:
                          'column',
                        gap: '1rem',
                      }}
                    >
                      <div className="attendance-grid-stats">
                        <div>
                          <div className="attendance-field-label">
                            Time
                          </div>
                          <div
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {formatTime(
                              viewRecord.check_out_time
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="attendance-field-label">
                            Date
                          </div>
                          <div
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {formatDate(
                              viewRecord.date
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="attendance-field-label">
                            Latitude
                          </div>
                          <div
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {viewRecord.check_out_latitude ??
                              '--'}
                          </div>
                        </div>

                        <div>
                          <div className="attendance-field-label">
                            Longitude
                          </div>
                          <div
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {viewRecord.check_out_longitude ??
                              '--'}
                          </div>
                        </div>

                        <div
                          style={{
                            gridColumn:
                              '1 / -1',
                          }}
                        >
                          <div className="attendance-field-label">
                            GPS Accuracy
                          </div>
                          <div
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {viewRecord.check_out_accuracy !=
                            null
                              ? `${viewRecord.check_out_accuracy}m`
                              : '--'}
                          </div>
                        </div>

                        <div
                          style={{
                            gridColumn:
                              '1 / -1',
                          }}
                        >
                          <div
                            className="attendance-field-label"
                            style={{
                              display: 'flex',
                              alignItems:
                                'center',
                              gap: '5px',
                            }}
                          >
                            <MapPin size={14} />
                            Location
                          </div>
                          <div
                            className="attendance-long-text"
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {viewRecord.check_out_location_name ||
                              '--'}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            color:
                              'var(--text-muted)',
                            fontSize:
                              '0.85rem',
                            marginBottom:
                              '0.5rem',
                            fontWeight: 500,
                          }}
                        >
                          Punch Out PHOTO
                        </div>

                        {viewRecord.check_out_photo ? (
                          <img
                            src={`${viewRecord.check_out_photo}?t=${Date.now()}`}
                            alt="Punch Out"
                            className="attendance-img"
                            onClick={() =>
                              setPreviewImage(
                                viewRecord.check_out_photo ||
                                  null
                              )
                            }
                          />
                        ) : (
                          <div
                            className="attendance-img"
                            style={{
                              display: 'flex',
                              alignItems:
                                'center',
                              justifyContent:
                                'center',
                              backgroundColor:
                                '#f8fafc',
                              border:
                                '1px dashed #cbd5e1',
                              color:
                                'var(--text-muted)',
                            }}
                          >
                            No Punch Out photo available
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '2rem',
                        textAlign: 'center',
                        backgroundColor:
                          '#f8fafc',
                        borderRadius: '8px',
                        color:
                          'var(--text-muted)',
                      }}
                    >
                      Employee has not checked out yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Approval */}
              <div
                style={{
                  borderTop:
                    '1px solid var(--border)',
                  paddingTop: '1.5rem',
                  marginTop: '1rem',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 1rem',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                  }}
                >
                  Approval Status
                </h4>

                <div
                  style={{
                    display: 'flex',
                    alignItems:
                      'flex-start',
                    justifyContent:
                      'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        backgroundColor:
                          viewRecord.approval_status ===
                          'APPROVED'
                            ? 'rgba(0, 86, 179, 0.08)'
                            : viewRecord.approval_status ===
                                'REJECTED'
                              ? '#fee2e2'
                              : '#fef3c7',
                        color:
                          viewRecord.approval_status ===
                          'APPROVED'
                            ? '#065f46'
                            : viewRecord.approval_status ===
                                'REJECTED'
                              ? '#991b1b'
                              : '#92400e',
                      }}
                    >
                      {viewRecord.approval_status}
                    </span>

                    {viewRecord.rejection_reason && (
                      <div
                        className="attendance-long-text"
                        style={{
                          marginTop: '0.75rem',
                          fontSize: '0.9rem',
                          color: '#7f1d1d',
                        }}
                      >
                        <strong>
                          Rejection Reason:
                        </strong>{' '}
                        {
                          viewRecord.rejection_reason
                        }
                      </div>
                    )}
                  </div>

                  <div className="attendance-modal-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        setViewRecord(null)
                      }
                    >
                      Close
                    </button>

                    {viewRecord.approval_status ===
                      'PENDING' && (
                      <>
                        <button
                          className="btn btn-secondary"
                          style={{
                            color: '#ef4444',
                            borderColor:
                              '#ef4444',
                            backgroundColor:
                              'transparent',
                          }}
                          onClick={() =>
                            setRejectRecord(
                              viewRecord
                            )
                          }
                        >
                          Reject
                        </button>

                        <button
                          className="btn btn-primary"
                          style={{
                            backgroundColor:
                              '#E56108',
                            borderColor:
                              '#E56108',
                            color: 'white',
                          }}
                          onClick={() =>
                            setApproveRecord(
                              viewRecord
                            )
                          }
                        >
                          Approve
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview */}
      {previewImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor:
              'rgba(0,0,0,0.8)',
            zIndex: 1200,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '2rem',
          }}
          onClick={() =>
            setPreviewImage(null)
          }
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <button
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                color: '#fff',
                backgroundColor:
                  'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'center',
              }}
              onClick={() =>
                setPreviewImage(null)
              }
            >
              <X size={24} />
            </button>

            <img
              src={previewImage}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
              onClick={(event) =>
                event.stopPropagation()
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;










































