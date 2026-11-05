import api from './api';

export const employeeService = {
  getEmployees: (params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key]) searchParams.append(key, params[key]);
      });
    }
    return api.get(`/employees/?${searchParams.toString()}`);
  },
  getEmployee: (id: number) => api.get(`/employees/${id}/`),
  createEmployee: (data: any) => api.post('/employees/', data),
  updateEmployee: (id: number, data: any) => api.patch(`/employees/${id}/`, data),
  deleteEmployee: (id: number) => api.delete(`/employees/${id}/`),
  deactivateEmployee: (id: number) => api.patch(`/employees/${id}/`, { status: false }),
  activateEmployee: (id: number) => api.patch(`/employees/${id}/`, { status: true })
};

