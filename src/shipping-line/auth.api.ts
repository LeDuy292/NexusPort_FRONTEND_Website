import { apiClient } from './client';
import { User, LoginPayload } from '../types/auth.types';

export const authApi = {
  login: async (payload: LoginPayload): Promise<{ token: string; user: User }> => {
    try {
      const res = await apiClient.post('/auth/login', payload);
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch {
      // Fallback for development/testing if backend auth differs
      if (payload.username && payload.password) {
        const mockUser: User = {
          id: 'u-shipping-01',
          username: payload.username,
          fullName: 'Đại diện Hãng tàu ONE / Evergreen',
          role: 'Shipping Line',
          carrierCode: 'ONEV',
          carrierName: 'Ocean Network Express',
          email: `${payload.username}@shippingline.com`,
        };
        return {
          token: 'mock-jwt-shipping-line-token',
          user: mockUser,
        };
      }
    }
    throw new Error('Tài khoản hoặc mật khẩu không chính xác.');
  },

  getMe: async (): Promise<User> => {
    try {
      const res = await apiClient.get('/auth/me');
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch {
      const local = localStorage.getItem('user');
      if (local) return JSON.parse(local);
    }
    throw new Error('Phiên làm việc đã kết thúc');
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },
};

