import api from '@/api/axios.js';

export const getAdminStats = async () => {
  const { data } = await api.get('/dashboard/admin');
  return data.data;
};

export const getOfficerStats = async () => {
  const { data } = await api.get('/dashboard/officer');
  return data.data;
};

export const getLandlordStats = async () => {
  const { data } = await api.get('/dashboard/landlord');
  return data.data;
};

export const getCollectorStats = async () => {
  const { data } = await api.get('/dashboard/collector');
  return data.data;
};

export const getResidentStats = async () => {
  const { data } = await api.get('/dashboard/resident');
  return data.data;
};

export const getCollectorCoachTips = async () => {
  const { data } = await api.get('/dashboard/collector/coach-tips');
  return data.data;
};
