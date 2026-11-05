import api from './index';

export interface LeaveRequest {
  id: number;
  employee?: number;
  employee_name?: string;
  employee_id?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: number | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateLeaveRequest {
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
}

export const getLeaves = async () => {
  const response = await api.get('/attendance/leaves/');
  return response.data;
};

export const createLeave = async (
  data: CreateLeaveRequest
) => {
  const response = await api.post(
    '/attendance/leaves/',
    data
  );
  return response.data;
};

export const approveLeave = async (id: number) => {
  const response = await api.patch(
    `/attendance/leaves/${id}/approve/`
  );
  return response.data;
};

export const rejectLeave = async (
  id: number,
  reason: string
) => {
  const response = await api.patch(
    `/attendance/leaves/${id}/reject/`,
    { reason }
  );
  return response.data;
};



export const undoLeave = async (id: number) => {
  const response = await api.patch(`/attendance/leaves/${id}/undo/`);
  return response.data;
};

export const updateLeave = async (
  id: number,
  data: CreateLeaveRequest
) => {
  const response = await api.patch(`/attendance/leaves/${id}/`, data);
  return response.data;
};

export const deleteLeave = async (id: number) => {
  return api.delete(`/attendance/leaves/${id}/`);
};
