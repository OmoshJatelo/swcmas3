import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || '/api/v1',
  timeout: 15000,
  withCredentials: true,
});

// Attach token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global response handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Optionally handle refresh token or logout on 401
    return Promise.reject(error);
  }
);

export default api;
