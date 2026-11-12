import { api } from '../context/AuthContext';

export interface ManagerSummary {
  date: string;
  manager_name: string;
  company_name: string;
  designation: string;
  total_employees: number;
  total_team_leaders: number;
  direct_employees: number;
  present_today: number;
  late_today: number;
  absent_today: number;
  on_leave_today: number;
  holiday_today: number;
  pending_approvals: number;
}

export interface ManagerTeamEmployee {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  designation: string;
  profile_photo: string | null;
  branch_name: string;
  company_name?: string;
  company_id?: number | null;
  status: boolean;
  account_status: string;
  employment_status: string;
  work_type: string;
  role?: string;
}

export interface ManagerAttendanceRow {
  employee_id: number;
  employee_code: string;
  full_name: string;
  department: string;
  designation: string;
  profile_photo: string | null;
  branch_name?: string;
  company_name?: string;
  calculated_status: string;
  status_reason: string;
  check_in: string | null;
  check_out: string | null;
  late_minutes: number;
  attendance_id: number | null;
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string | null;
  check_in_approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  check_in_rejection_reason?: string | null;
  check_out_approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  check_out_rejection_reason?: string | null;
}

export interface ManagerAttendanceResponse {
  date: string;
  team_attendance: ManagerAttendanceRow[];
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    holiday: number;
    on_leave: number;
    half_day: number;
    weekly_off: number;
    pending: number;
  };
}

export const getManagerDashboardSummary = async (): Promise<ManagerSummary> => {
  const response = await api.get('/employees/manager/dashboard-summary/');
  return response.data;
};

export const getManagerTeam = async (search?: string): Promise<ManagerTeamEmployee[]> => {
  const params = search ? { search } : {};
  const response = await api.get('/employees/manager/team/', { params });
  return Array.isArray(response.data) ? response.data : [];
};

export const getManagerTeamEmployeeDetail = async (id: number): Promise<any> => {
  const response = await api.get(`/employees/manager/team/${id}/`);
  return response.data;
};

export const getManagerTeamAttendance = async (dateStr: string): Promise<ManagerAttendanceResponse> => {
  const response = await api.get('/employees/manager/team-attendance/', { params: { date: dateStr } });
  return response.data;
};

export const promoteEmployeeToTeamLeader = async (employeeId: number, data: { username: string; password?: string }) => {
  const response = await api.post(`/employees/manager/employees/${employeeId}/promote-team-leader/`, data);
  return response.data;
};

export const assignTeamToLeader = async (leaderId: number, employeeIds: number[], action: 'assign' | 'unassign' = 'assign') => {
  const response = await api.post(`/employees/manager/team-leaders/${leaderId}/assign-team/`, {
    employee_ids: employeeIds,
    action,
  });
  return response.data;
};

export const getManagerProfile = async () => {
  const response = await api.get('/employees/manager/profile/');
  return response.data;
};

export const getManagerTasks = async () => {
  const response = await api.get('/tasks-module/tasks/');
  return Array.isArray(response.data) ? response.data : [];
};

export const getAssignableMembers = async () => {
  const response = await api.get('/tasks-module/tasks/assignable_members/');
  return Array.isArray(response.data) ? response.data : [];
};

export const createManagerTask = async (taskData: {
  title: string;
  description: string;
  assigned_to: number;
  start_date: string;
  due_date: string;
  priority: string;
  category?: string;
  status?: string;
}) => {
  const response = await api.post('/tasks-module/tasks/', taskData);
  return response.data;
};

