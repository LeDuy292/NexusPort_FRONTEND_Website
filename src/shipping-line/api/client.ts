import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api/shipping',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If backend returns 401 or error, do not aggressively wipe local auth and redirect
    const message =
      error.response?.data?.message ||
      error.message ||
      'Lỗi kết nối máy chủ';
    return Promise.reject(new Error(message));
  }
);
