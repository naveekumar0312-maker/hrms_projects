import { api } from '../context/AuthContext';
import { Platform } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const checkIn = async (location: LocationData, photoUri: string, lateReason?: string) => {
  const latitude = Number(location.latitude.toFixed(6));
  const longitude = Number(location.longitude.toFixed(6));
  const accuracy = Number(location.accuracy?.toFixed(2) ?? 0);

  console.log("[CHECK-IN] raw latitude:", location.latitude);
  console.log("[CHECK-IN] raw longitude:", location.longitude);
  console.log("[CHECK-IN] normalized latitude:", latitude);
  console.log("[CHECK-IN] normalized longitude:", longitude);
  console.log("[CHECK-IN] accuracy:", accuracy);

  const formData = new FormData();
  formData.append('latitude', latitude.toString());
  formData.append('longitude', longitude.toString());
  formData.append('accuracy', accuracy.toString());
  if (lateReason && lateReason.trim()) {
    formData.append('late_reason', lateReason.trim());
  }

  // Handle file properly for React Native FormData
  const filename = photoUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;

  formData.append('photo', {
    uri: Platform.OS === 'ios' ? photoUri.replace('file://', '') : photoUri,
    name: filename,
    type,
  } as any);

  try {
    const response = await api.post('/attendance/check-in/', formData, {
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
      }
    });
    return response.data;
  } catch (error: any) {
    console.log("[CHECK-IN] status:", error.response?.status);
    console.log("[CHECK-IN] data:", error.response?.data);

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error('Unable to verify attendance. Please try again.');
    }
    if (error.isAxiosError && error.message === 'Network Error') {
      throw new Error('Unable to connect to the server. Please check your connection.');
    }
    
    if (error.response?.status && error.response?.data) {
      const data = error.response.data;
      if (data.code === 'GPS_ACCURACY_TOO_LOW') {
        throw new Error("GPS accuracy is too low. Please move to an open area, turn on GPS, and try again.");
      }
      if (data.error) {
        throw new Error(data.error);
      } else if (data.message) {
        throw new Error(data.message);
      } else if (data.detail) {
        throw new Error(data.detail);
      } else if (data.errors) {
        const firstError = Object.values(data.errors)[0] as any;
        throw new Error(Array.isArray(firstError) ? firstError[0] : firstError);
      }
    }
    throw new Error(error.response?.data?.error || error.message || 'Unable to verify attendance. Please try again.');
  }
};

export const checkOut = async (location: LocationData, photoUri: string) => {
  const latitude = Number(location.latitude.toFixed(6));
  const longitude = Number(location.longitude.toFixed(6));
  const accuracy = Number(location.accuracy?.toFixed(2) ?? 0);

  console.log("[CHECK-OUT] raw latitude:", location.latitude);
  console.log("[CHECK-OUT] raw longitude:", location.longitude);
  console.log("[CHECK-OUT] normalized latitude:", latitude);
  console.log("[CHECK-OUT] normalized longitude:", longitude);
  console.log("[CHECK-OUT] accuracy:", accuracy);

  const formData = new FormData();
  formData.append('latitude', latitude.toString());
  formData.append('longitude', longitude.toString());
  formData.append('accuracy', accuracy.toString());

  const filename = photoUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;

  formData.append('photo', {
    uri: Platform.OS === 'ios' ? photoUri.replace('file://', '') : photoUri,
    name: filename,
    type,
  } as any);

  try {
    const response = await api.post('/attendance/check-out/', formData, {
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
      }
    });
    return response.data;
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error('Unable to verify attendance. Please try again.');
    }
    if (error.isAxiosError && error.message === 'Network Error') {
      throw new Error('Unable to connect to the server. Please check your connection.');
    }
    if (error.response?.status && error.response?.data) {
      const data = error.response.data;
      if (data.code === 'GPS_ACCURACY_TOO_LOW') {
        throw new Error("GPS accuracy is too low. Please move to an open area, turn on GPS, and try again.");
      }
      if (data.error) {
        throw new Error(data.error);
      } else if (data.message) {
        throw new Error(data.message);
      } else if (data.detail) {
        throw new Error(data.detail);
      } else if (data.errors) {
        const firstError = Object.values(data.errors)[0] as any;
        throw new Error(Array.isArray(firstError) ? firstError[0] : firstError);
      }
    }
    throw new Error(error.response?.data?.error || error.message || 'Unable to verify attendance. Please try again.');
  }
};

export const getHistory = async (page = 1) => {
  const response = await api.get(`/attendance/history/?page=${page}`);
  return response.data;
};

export const getReports = async (month?: number, year?: number, startDate?: string, endDate?: string) => {
  let url = '/attendance/reports/?';
  if (startDate && endDate) {
    url += `start_date=${startDate}&end_date=${endDate}`;
  } else if (month && year) {
    url += `month=${month}&year=${year}`;
  }
  const response = await api.get(url);
  return response.data;
};

export const getTodayAttendance = async () => {
  const response = await api.get('/attendance/today/');
  return response.data;
};

export const getAdminAttendanceList = async (dateStr?: string, companyId?: number): Promise<any> => {
  const params: any = {};
  if (dateStr) params.date = dateStr;
  if (companyId) params.company = companyId;
  const response = await api.get('/attendance/', { params });
  return response.data;
};

export const updateAttendanceRecord = async (id: number, data: any): Promise<any> => {
  const response = await api.patch(`/attendance/${id}/`, data);
  return response.data;
};

export const deleteAttendanceRecord = async (id: number): Promise<any> => {
  const response = await api.delete(`/attendance/${id}/`);
  return response.data;
};

export const approveAttendanceRecord = async (id: number, type?: 'check_in' | 'check_out'): Promise<any> => {
  const response = await api.post(`/attendance/${id}/approve/`, { type });
  return response.data;
};

export const rejectAttendanceRecord = async (id: number, reason: string, type?: 'check_in' | 'check_out'): Promise<any> => {
  const response = await api.post(`/attendance/${id}/reject/`, { reason, rejection_reason: reason, type });
  return response.data;
};
