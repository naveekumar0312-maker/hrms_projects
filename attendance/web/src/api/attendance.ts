import api from './index';
import type { LocationData } from '../hooks/useLocation';

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return await response.blob();
};

const getApiErrorMessage = (error: any, fallback: string) => {
  const data = error?.response?.data;

  if (data?.errors) {
    const errors = data.errors;

    return Object.entries(errors)
      .map(([field, messages]) => {
        const message = Array.isArray(messages)
          ? messages.join(', ')
          : String(messages);

        return `${field}: ${message}`;
      })
      .join('\n');
  }

  return (
    data?.message ||
    data?.error ||
    error?.message ||
    fallback
  );
};

export const checkIn = async (
  location: LocationData,
  photoUri: string
) => {
  try {
    const latitude = Number(location.latitude.toFixed(6));
    const longitude = Number(location.longitude.toFixed(6));
    const accuracy = Number(location.accuracy?.toFixed(2) ?? 0);

    const formData = new FormData();

    formData.append('latitude', latitude.toString());
    formData.append('longitude', longitude.toString());
    formData.append('accuracy', accuracy.toString());

    const photoBlob = await dataUrlToBlob(photoUri);

    if (!photoBlob || photoBlob.size === 0) {
      throw new Error('Captured photo is empty.');
    }

    formData.append('photo', photoBlob, 'attendance-Punch In.jpg');

    const response = await api.post(
      '/attendance/check-in/',
      formData
    );

    return response.data;
  } catch (error: any) {
    console.error('Punch In API error:', error?.response?.data || error);

    throw new Error(
      getApiErrorMessage(error, 'Punch In failed.')
    );
  }
};

export const checkOut = async (
  location: LocationData,
  photoUri: string
) => {
  try {
    const latitude = Number(location.latitude.toFixed(6));
    const longitude = Number(location.longitude.toFixed(6));
    const accuracy = Number(location.accuracy?.toFixed(2) ?? 0);

    const formData = new FormData();

    formData.append('latitude', latitude.toString());
    formData.append('longitude', longitude.toString());
    formData.append('accuracy', accuracy.toString());

    const photoBlob = await dataUrlToBlob(photoUri);

    if (!photoBlob || photoBlob.size === 0) {
      throw new Error('Captured photo is empty.');
    }

    formData.append('photo', photoBlob, 'attendance-Punch Out.jpg');

    const response = await api.post(
      '/attendance/check-out/',
      formData
    );

    return response.data;
  } catch (error: any) {
    console.error('Punch Out API error:', error?.response?.data || error);

    throw new Error(
      getApiErrorMessage(error, 'Punch Out failed.')
    );
  }
};

export const getHistory = async (page = 1) => {
  const response = await api.get(
    `/attendance/history/?page=${page}`
  );

  return response.data;
};

export const getReports = async (
  month?: number,
  year?: number,
  startDate?: string,
  endDate?: string,
  period?: string,
  weekOffset?: number
) => {
  const params = new URLSearchParams();

  if (startDate && endDate) {
    params.set('start_date', startDate);
    params.set('end_date', endDate);
  } else {
    if (month) {
      params.set('month', month.toString());
    }

    if (year) {
      params.set('year', year.toString());
    }
  }

  if (period) {
    params.set('period', period);
  }

  if (
    typeof weekOffset === 'number'
  ) {
    params.set(
      'week_offset',
      weekOffset.toString()
    );
  }

  const query = params.toString();

  const response = await api.get(
    `/attendance/reports/${query ? `?${query}` : ''}`
  );

  return response.data;
};

