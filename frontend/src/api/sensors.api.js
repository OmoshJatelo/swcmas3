import axiosInstance from './axios';

export const getLatestSensorReading = (apartmentId) =>
  axiosInstance.get(`/sensors/${apartmentId}`);

export const getSensorReadingHistory = (apartmentId, params) =>
  axiosInstance.get(`/sensors/${apartmentId}/history`, { params });

export const getSensorHealth = () =>
  axiosInstance.get('/sensors/health');
