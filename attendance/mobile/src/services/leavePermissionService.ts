import { api } from '../context/AuthContext';

export interface LeaveRequest {
  id?: number;
  employee?: number;
  employee_name?: string;
  employee_id?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string | null;
  created_at?: string;
}

export interface PermissionRequest {
  id?: number;
  employee?: number;
  employee_name?: string;
  employee_id?: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes: number;
  reason: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string | null;
  created_at?: string;
}

export const getLeaves = async (params?: any) => {
  console.log('LEAVES API URL:', api.defaults.baseURL + '/attendance/leaves/');
  const response = await api.get('/attendance/leaves/', {
    params: { scope: 'my', ...params },
  });
  return response.data;
};

export const createLeave = async (data: {
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
}) => {
  const response = await api.post('/attendance/leaves/', data);
  return response.data;
};

export const getPermissions = async (params?: any) => {
  console.log('PERMISSIONS API URL:', api.defaults.baseURL + '/attendance/permissions/');
  const response = await api.get('/attendance/permissions/', {
    params: { scope: 'my', ...params },
  });
  return response.data;
};

export const createPermission = async (data: {
  date: string;
  duration_minutes: number;
  reason: string;
  start_time?: string | null;
  end_time?: string | null;
}) => {
  const response = await api.post('/attendance/permissions/', data);
  return response.data;
};


export interface PermissionSummary {
  date: string;
  daily: {
    limit_minutes: number;
    used_minutes: number;
    remaining_minutes: number;
  };
  cycle: {
    start_date: string;
    end_date: string;
    limit_minutes: number;
    used_minutes: number;
    remaining_minutes: number;
  };
}

export const getPermissionSummary = async (date?: string): Promise<PermissionSummary> => {
  const response = await api.get('/attendance/permissions/summary/', {
    params: date ? { date } : undefined,
  });
  return response.data;
};

export interface LeaveSummary {
  date: string;
  cycle: {
    year: number;
    month: number;
    start_date: string;
    end_date: string;
    used_days: number;
    by_type: Record<string, number>;
  };
}

export const getLeaveSummary = async (date?: string): Promise<LeaveSummary> => {
  const response = await api.get('/attendance/leaves/summary/', {
    params: date ? { date } : undefined,
  });
  return response.data;
};
