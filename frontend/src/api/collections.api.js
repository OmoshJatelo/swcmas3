import api from '@/api/axios.js';
import { addToQueue } from '@/utils/indexedDB.js';

export const listCollections = async (page = 1, limit = 20, filters = {}) => {
  const { data } = await api.get('/collections', {
    params: { page, limit, ...filters },
  });
  return data.data; // { collections, total, page, limit }
};

export const createCollection = async (payload) => {
  const { data } = await api.post('/collections', payload);
  return data.data;
};

export const startCollection = async (id, payload) => {
  try {
    const config = payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const { data } = await api.patch(`/collections/${id}/start`, payload, config);
    return data.data;
  } catch (error) {
    if (!navigator.onLine || error.message === 'Network Error') {
      await addToQueue(`/collections/${id}/start`, payload, true);
      throw new Error('You are offline. Collection start saved to sync queue.');
    }
    throw error;
  }
};

export const completeCollection = async (id, payload) => {
  try {
    const config = payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const { data } = await api.patch(`/collections/${id}/complete`, payload, config);
    return data.data;
  } catch (error) {
    if (!navigator.onLine || error.message === 'Network Error') {
      await addToQueue(`/collections/${id}/complete`, payload, true);
      throw new Error('You are offline. Collection complete saved to sync queue.');
    }
    throw error;
  }
};

export const verifyCollection = async (id, payload) => {
  const { data } = await api.patch(`/collections/${id}/verify`, payload);
  return data.data;
};

export const updateCollection = async (id, payload) => {
  const { data } = await api.patch(`/collections/${id}`, payload);
  return data.data;
};

export const deleteCollection = async (id) => {
  await api.delete(`/collections/${id}`);
};
