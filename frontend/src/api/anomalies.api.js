import api from '@/api/axios.js';

export const listAnomalies = async (page = 1, limit = 20, filters = {}) => {
  const { data } = await api.get('/anomalies', { params: { page, limit, ...filters } });
  return data.data; // { alerts, total, page, limit }
};

export const resolveAnomaly = async (id, resolution) => {
  const { data } = await api.patch(`/anomalies/${id}/resolve`, { resolution });
  return data.data;
};

export const getAnomalyPlaybook = async (id) => {
  const { data } = await api.get(`/anomalies/${id}/playbook`);
  return data.data;
};