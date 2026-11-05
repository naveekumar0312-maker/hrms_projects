import api from './api';

export interface Branch {
  id: number;
  branch_name: string;
  office_address: string;
  latitude: number;
  longitude: number;
  allowed_radius: number;
  status: boolean;
  attendance_policy?: {
    start_time: string;
    end_time: string;
    grace_period: number;
    allowed_radius: number;
  };
}

export const getBranches = async () => {
  const response = await api.get('/branches/');
  return response.data;
};

export const createBranch = async (data: Partial<Branch>) => {
  const response = await api.post('/branches/', data);
  return response.data;
};

export const updateBranch = async (id: number, data: Partial<Branch>) => {
  const response = await api.put(`/branches/${id}/`, data);
  return response.data;
};

export const deleteBranch = async (id: number) => {
  const response = await api.delete(`/branches/${id}/`);
  return response.data;
};

