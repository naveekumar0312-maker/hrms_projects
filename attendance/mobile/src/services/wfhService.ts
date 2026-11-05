import { api } from '../context/AuthContext';

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

export const getWFHRequests = async (): Promise<WFHRequest[] | { results: WFHRequest[] }> => {
  const response = await api.get('/attendance/wfh/');
  return response.data;
};

export const createWFHRequest = async (data: CreateWFHRequest) => {
  const response = await api.post('/attendance/wfh/', data);
  return response.data;
};
