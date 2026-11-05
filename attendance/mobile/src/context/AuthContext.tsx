import React, { createContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Alert } from 'react-native';
import { stopTrackingForLogout } from '../services/trackingLogoutCleanup';

// Ensure this matches your backend URL when running on Android emulator (10.0.2.2) or iOS (localhost/IP)
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.10:8000/api'; 

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  if (__DEV__) {
    const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
    console.log(`[API REQ] ${config.method?.toUpperCase()} -> ${fullUrl}`);
  }
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (__DEV__) {
      const fullUrl = `${error.config?.baseURL || ''}${error.config?.url || ''}`;
      console.warn(`[API ERR] ${error.config?.method?.toUpperCase()} ${fullUrl}:`, error.message, error.response?.status || 'No Response');
    }
    return Promise.reject(error);
  }
);

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  employee: any;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  employee: null,
  login: async () => {},
  logout: async () => {},
  refreshEmployee: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);

  const checkAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      
      // Attempt fetching User profile from /auth/me/
      let userData = null;
      try {
        const userRes = await api.get('/auth/me/');
        userData = userRes.data;
        setUser(userData);
      } catch (uErr: any) {
        console.log('Failed fetching user profile from /auth/me/:', uErr?.response?.status);
      }

      // If user has an employee profile, fetch it from /employees/me/
      try {
        const response = await api.get('/employees/me/');
        setEmployee(response.data);
        if (!userData) {
          setUser(response.data.user);
        }
      } catch (empErr: any) {
        setEmployee(null);
      }

      setIsAuthenticated(true);
    } catch (error: any) {
      console.log('Auth check failed:', error);
      if (error.response?.status === 401) {
        setIsAuthenticated(false);
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
      } else if (error.isAxiosError && (error.message === 'Network Error' || error.code === 'ECONNABORTED' || !error.response)) {
        // Network error - keep user authenticated but maybe show a warning
        setIsAuthenticated(true);
        Alert.alert("Offline", "You are currently offline. Some features may not be available.");
      } else {
        setIsAuthenticated(false);
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    try {
      const cleanIdent = (identifier || '').trim();
      const isDigitsOnly = /^\d+$/.test(cleanIdent);

      // Support email, username, and phone_number
      const payload = isDigitsOnly
        ? { phone_number: cleanIdent, password }
        : { username: cleanIdent, password };

      const response = await api.post('/auth/login/', payload);
      const { access, refresh, user: returnedUser } = response.data;
      
      await SecureStore.setItemAsync('access_token', access);
      await SecureStore.setItemAsync('refresh_token', refresh);
      
      // Update axios headers for the profile fetch
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      
      if (returnedUser) {
        setUser(returnedUser);
      }

      try {
        const profileResponse = await api.get('/employees/me/');
        setEmployee(profileResponse.data);
        if (!returnedUser && profileResponse.data?.user) {
          setUser(profileResponse.data.user);
        }
      } catch (empErr) {
        setEmployee(null);
        if (!returnedUser) {
          const authMe = await api.get('/auth/me/');
          setUser(authMe.data);
        }
      }

      setIsAuthenticated(true);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await stopTrackingForLogout();
    } finally {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      setIsAuthenticated(false);
      setUser(null);
      setEmployee(null);
      delete api.defaults.headers.common['Authorization'];
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, employee, login, logout, refreshEmployee: checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};




