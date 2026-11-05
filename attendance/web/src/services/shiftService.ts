import api from './api';

export interface Shift {
    id: number;
    name: string;
    code: string;
    start_time: string;
    end_time: string;
    grace_period: number;
    is_active: boolean;
    reminders_enabled?: boolean;
    employee_count?: number;
    created_at?: string;
    updated_at?: string;
}

export const shiftService = {
    getShifts: async () => {
        const response = await api.get('/shifts/');
        return response.data;
    },

    getActiveShifts: async () => {
        const response = await api.get('/shifts/active/');
        return response.data;
    },

    getShift: async (id: number) => {
        const response = await api.get(`/shifts/${id}/`);
        return response.data;
    },

    createShift: async (data: Partial<Shift>) => {
        const response = await api.post('/shifts/', data);
        return response.data;
    },

    updateShift: async (id: number, data: Partial<Shift>) => {
        const response = await api.patch(`/shifts/${id}/`, data);
        return response.data;
    },

    deleteShift: async (id: number) => {
        const response = await api.delete(`/shifts/${id}/`);
        return response.data;
    },

    activateShift: async (id: number) => {
        const response = await api.patch(`/shifts/${id}/`, { is_active: true });
        return response.data;
    },

    deactivateShift: async (id: number) => {
        const response = await api.patch(`/shifts/${id}/`, { is_active: false });
        return response.data;
    }
};


