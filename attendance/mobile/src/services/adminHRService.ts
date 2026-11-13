import { api } from '../context/AuthContext';

export interface CompanySummary {
  id: number;
  name: string;
  slug: string;
  code?: string;
  address?: string;
  branch_count?: number;
  employee_count?: number;
  status: boolean;
  logo?: string | null;
  primary_color?: string;
}

export interface DashboardStats {
  date: string;
  total_staff: number;
  present_today: number;
  late_today: number;
  absent_today: number;
  on_leave_today: number;
  pending_leave_requests: number;
  pending_permission_requests: number;
  pending_wfh_requests: number;
  present_percentage: number;
  trend?: any[];
  status_distribution?: any;
}

export interface EmployeeItem {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  department?: string;
  designation?: string;
  branch?: number;
  branch_name?: string;
  company?: number;
  company_name?: string;
  status: boolean;
  account_status?: string;
  work_type?: string;
  profile_photo?: string | null;
  date_of_joining?: string;
}

export interface BranchItem {
  id: number;
  name: string;
  code?: string;
  company: number;
  company_name?: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius: number;
  is_active: boolean;
}

export interface ShiftItem {
  id: number;
  name: string;
  company: number;
  company_name?: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  is_active: boolean;
}

export interface LeaveRequestItem {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_display: string;
  company: number;
  company_name?: string;
  branch_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  number_of_days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejection_reason?: string;
  applied_at: string;
}

export interface PermissionRequestItem {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_display: string;
  company: number;
  company_name?: string;
  branch_name?: string;
  date: string;
  permission_type: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejection_reason?: string;
  applied_at: string;
}

export interface WFHRequestItem {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_display: string;
  company: number;
  company_name?: string;
  branch_name?: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  applied_at: string;
}

export interface HolidayItem {
  id: number;
  name: string;
  date: string;
  company: number;
  company_name?: string;
  description?: string;
  is_recurring?: boolean;
}

export interface ManagerAccountItem {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  department?: string;
  designation?: string;
  company_name?: string;
  assigned_employees_count?: number;
  status: boolean;
}

export interface HRAccountItem {
  id: number;
  username: string;
  phone_number?: string;
  role: string;
  company_id: number;
  company_name: string;
  is_active: boolean;
  date_joined?: string;
}

export interface LiveLocationItem {
  employee_id: number;
  employee_code: string;
  name: string;
  phone_number?: string;
  department?: string;
  branch_name?: string;
  latitude: number;
  longitude: number;
  battery_level?: number;
  is_mock?: boolean;
  updated_at: string;
  status: string;
}

// ---------------- API FUNCTIONS ---------------- //

export const fetchAdminDashboardStats = async (companyId?: number): Promise<DashboardStats> => {
  const params: any = {};
  if (companyId) {
    params.company = companyId;
    params.company_id = companyId;
  }
  const response = await api.get('/attendance/dashboard/', { params });
  const data = response.data;
  const summary = data?.summary || {};
  const total = summary.total_staff || summary.total_employees || 0;
  const present = summary.present_today || summary.present || 0;
  const calcPercentage = total > 0 ? Math.round((present / total) * 100) : 0;

  return {
    date: summary.date || new Date().toISOString().split('T')[0],
    total_staff: total,
    present_today: present,
    late_today: summary.late_today || summary.late || 0,
    absent_today: summary.absent_today || summary.absent || 0,
    on_leave_today: summary.on_leave_today || summary.on_leave || 0,
    pending_leave_requests: data?.pending_leaves_count ?? summary.pending_leaves_count ?? 0,
    pending_permission_requests: data?.pending_permissions_count ?? summary.pending_permissions_count ?? 0,
    pending_wfh_requests: data?.pending_wfh_count ?? summary.pending_wfh_count ?? 0,
    present_percentage: summary.present_percentage ?? calcPercentage,
    trend: data?.trend || [],
    status_distribution: data?.status_distribution || {},
  };
};

export const fetchCompanies = async (): Promise<CompanySummary[]> => {
  const response = await api.get('/companies/');
  return Array.isArray(response.data) ? response.data : [];
};

export const createCompany = async (formData: any): Promise<any> => {
  const response = await api.post('/companies/', formData);
  return response.data;
};

export const updateCompany = async (id: number, formData: any): Promise<any> => {
  const response = await api.patch(`/companies/${id}/`, formData);
  return response.data;
};

export const fetchEmployees = async (companyId?: number, search?: string): Promise<EmployeeItem[]> => {
  const params: any = {};
  if (companyId) params.company = companyId;
  if (search) params.search = search;
  const response = await api.get('/employees/', { params });
  return Array.isArray(response.data) ? response.data : [];
};

export const fetchEmployeeDetail = async (id: number): Promise<any> => {
  const response = await api.get(`/employees/${id}/`);
  return response.data;
};

export const createEmployee = async (data: any): Promise<any> => {
  const response = await api.post('/employees/', data);
  return response.data;
};

export const updateEmployee = async (id: number, data: any): Promise<any> => {
  const response = await api.patch(`/employees/${id}/`, data);
  return response.data;
};

export const fetchBranches = async (companyId?: number): Promise<BranchItem[]> => {
  const params = companyId ? { company: companyId } : {};
  const response = await api.get('/branches/', { params });
  return Array.isArray(response.data) ? response.data : [];
};

export const createBranch = async (data: any): Promise<any> => {
  const response = await api.post('/branches/', data);
  return response.data;
};

export const updateBranch = async (id: number, data: any): Promise<any> => {
  const response = await api.patch(`/branches/${id}/`, data);
  return response.data;
};

export const fetchShifts = async (companyId?: number): Promise<ShiftItem[]> => {
  const params = companyId ? { company: companyId } : {};
  const response = await api.get('/shifts/', { params });
  return Array.isArray(response.data) ? response.data : [];
};

export const createShift = async (data: any): Promise<any> => {
  const response = await api.post('/shifts/', data);
  return response.data;
};

export const updateShift = async (id: number, data: any): Promise<any> => {
  const response = await api.patch(`/shifts/${id}/`, data);
  return response.data;
};

export const fetchLeaves = async (companyId?: number, status?: string): Promise<LeaveRequestItem[]> => {
  const params: any = {};
  if (companyId) params.company = companyId;
  if (status && status !== 'ALL') params.status = status;
  const response = await api.get('/attendance/leaves/', { params });
  return Array.isArray(response.data) ? response.data : [];
};

export const updateLeaveStatus = async (id: number, status: 'APPROVED' | 'REJECTED', rejectionReason?: string): Promise<any> => {
  const response = await api.patch(`/attendance/leaves/${id}/`, {
    status,
    rejection_reason: rejectionReason || '',
  });
  return response.data;
};

export const fetchPermissions = async (companyId?: number, status?: string): Promise<PermissionRequestItem[]> => {
  const params: any = {};
  if (companyId) params.company = companyId;
  if (status && status !== 'ALL') params.status = status;
  const response = await api.get('/attendance/permissions/', { params });
  return Array.isArray(response.data) ? response.data : [];
};

export const updatePermissionStatus = async (id: number, status: 'APPROVED' | 'REJECTED', rejectionReason?: string): Promise<any> => {
  const response = await api.patch(`/attendance/permissions/${id}/`, {
    status,
    rejection_reason: rejectionReason || '',
  });
  return response.data;
};

export const fetchWFHRequests = async (companyId?: number, status?: string): Promise<WFHRequestItem[]> => {
  const params: any = {};
  if (companyId) params.company = companyId;
  if (status && status !== 'ALL') params.status = status;
  const response = await api.get('/attendance/wfh/', { params });
  return Array.isArray(response.data) ? response.data : [];
};

export const updateWFHStatus = async (id: number, status: 'APPROVED' | 'REJECTED', rejectionReason?: string): Promise<any> => {
  const response = await api.patch(`/attendance/wfh/${id}/`, {
    status,
    rejection_reason: rejectionReason || '',
  });
  return response.data;
};

export const fetchHolidays = async (companyId?: number): Promise<HolidayItem[]> => {
  const params = companyId ? { company: companyId } : {};
  const response = await api.get('/attendance/holidays/', { params });
  return Array.isArray(response.data) ? response.data : [];
};

export const createHoliday = async (data: any): Promise<any> => {
  const response = await api.post('/attendance/holidays/', data);
  return response.data;
};

export const deleteHoliday = async (id: number): Promise<any> => {
  const response = await api.delete(`/attendance/holidays/${id}/`);
  return response.data;
};

export const createReportingManager = async (data: {
  full_name: string;
  username: string;
  password: string;
  status?: string;
  phone_number?: string;
  department?: string;
  designation?: string;
}): Promise<any> => {
  const response = await api.post('/employees/hr/managers/', data);
  return response.data;
};

export const fetchReportingManagers = async (companyId?: number): Promise<ManagerAccountItem[]> => {
  const params = companyId ? { company: companyId } : {};
  const response = await api.get('/employees/hr/managers/', { params });
  return Array.isArray(response.data) ? response.data : [];
};

export const fetchHRAccounts = async (): Promise<HRAccountItem[]> => {
  const response = await api.get('/auth/hr-accounts/');
  return Array.isArray(response.data) ? response.data : [];
};

export const createHRAccount = async (data: { username: string; phone_number?: string; password: string; company_id: number }): Promise<any> => {
  const response = await api.post('/auth/hr-accounts/', data);
  return response.data;
};

export const fetchLiveLocations = async (companyId?: number): Promise<LiveLocationItem[]> => {
  const params = companyId ? { company: companyId } : {};
  const response = await api.get('/tracking/live/', { params });
  return Array.isArray(response.data) ? response.data : [];
};


export const updateHRAccount = async (id: number, data: Partial<HRAccountItem> & { password?: string }): Promise<any> => {
  const response = await api.patch(`/auth/hr-accounts/${id}/`, data);
  return response.data;
};

export const deleteHRAccount = async (id: number): Promise<any> => {
  const response = await api.delete(`/auth/hr-accounts/${id}/`);
  return response.data;
};
export const assignTeamToManager = async (managerId: number, employeeIds: number[]): Promise<any> => {
  const response = await api.post(`/employees/hr/managers/${managerId}/assign-team/`, {
    assigned_employee_ids: employeeIds,
  });
  return response.data;
};
export const deleteCompany = async (id: number): Promise<any> => {
  const response = await api.delete(`/companies/${id}/`);
  return response.data;
};
export const updateReportingManager = async (id: number, data: any): Promise<any> => {
  const response = await api.patch(`/employees/hr/managers/${id}/`, data);
  return response.data;
};

export const deleteReportingManager = async (id: number): Promise<any> => {
  const response = await api.delete(`/employees/hr/managers/${id}/`);
  return response.data;
};
export const deleteBranch = async (id: number): Promise<any> => {
  const response = await api.delete(`/branches/${id}/`);
  return response.data;
};

export const deleteShift = async (id: number): Promise<any> => {
  const response = await api.delete(`/shifts/${id}/`);
  return response.data;
};

export const updateHoliday = async (id: number, data: any): Promise<any> => {
  const response = await api.patch(`/attendance/holidays/${id}/`, data);
  return response.data;
};

export const fetchPendingActionsReminder = async (): Promise<any> => {
  const response = await api.get('/attendance/pending-actions-reminder/');
  return response.data;
};
