import api from './index';

export interface PermissionRequest {
  id: number;
  employee?: number;
  employee_name?: string;
  employee_id?: string;
  profile_photo?: string | null;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: number | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePermissionRequest {
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
}

export const getPermissions = async (params?: { date?: string; search?: string; status?: string; scope?: string }) => {
  const response = await api.get('/attendance/permissions/', { params });
  return response.data;
};

export const createPermission = async (
  data: CreatePermissionRequest
) => {
  const response = await api.post('/attendance/permissions/', data);
  return response.data;
};

export const approvePermission = async (id: number) => {
  const response = await api.patch(
    `/attendance/permissions/${id}/approve/`
  );
  return response.data;
};

export const rejectPermission = async (
  id: number,
  reason: string
) => {
  const response = await api.patch(
    `/attendance/permissions/${id}/reject/`,
    { reason }
  );
  return response.data;
};



export const undoPermission = async (id: number) => {
  const response = await api.patch(`/attendance/permissions/${id}/undo/`);
  return response.data;
};

export const updatePermission = async (
  id: number,
  data: CreatePermissionRequest
) => {
  const response = await api.patch(`/attendance/permissions/${id}/`, data);
  return response.data;
};

export const deletePermission = async (id: number) => {
  return api.delete(`/attendance/permissions/${id}/`);
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


