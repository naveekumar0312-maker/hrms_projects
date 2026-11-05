import api from './index';

export type WFHStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WFHRequest {
  id: number;
  employee?: number;
  employee_name?: string;
  employee_id?: string;
  date: string;
  reason: string;
  status: WFHStatus;
  approved_by?: number | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateWFHRequest {
  date: string;
  reason: string;
}

export const getWFHRequests = async () => {
  const response = await api.get('/attendance/wfh/');
  return response.data;
};

export const createWFHRequest = async (data: CreateWFHRequest) => {
  const response = await api.post('/attendance/wfh/', data);
  return response.data;
};

// Admin / HR actions
export const approveWFHRequest = async (id: number) => {
  const response = await api.patch(
    `/attendance/wfh/${id}/approve/`
  );
  return response.data;
};

export const rejectWFHRequest = async (
  id: number,
  reason: string
) => {
  const response = await api.patch(
    `/attendance/wfh/${id}/reject/`,
    { reason }
  );
  return response.data;
};
