import api from './index';

export const employeeLogin = async (phone_number: string, password: string) => {
  const response = await api.post('/auth/login/', { phone_number, password });
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get('/employees/me/');
  return response.data;
};

