import api from './api';

export interface PersonalAlarmSettings {
  alarm_time: string;
  is_enabled: boolean;
  timezone?: string;
  updated_at?: string;
}

export const personalAlarmService = {
  getAlarm: async (): Promise<PersonalAlarmSettings> => {
    const res = await api.get('/attendance/personal-alarm/');
    return res.data;
  },

  updateAlarm: async (data: { alarm_time: string; is_enabled: boolean }): Promise<PersonalAlarmSettings> => {
    const res = await api.post('/attendance/personal-alarm/', data);
    return res.data;
  },
};

