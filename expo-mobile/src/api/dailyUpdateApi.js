import apiClient from './axiosConfig';
import { STORAGE_KEYS } from '../util/constants';
import * as SecureStore from '../util/secureStore';

const assertPositiveId = (value, label) => {
  const numericId = Number(value);
  if (!Number.isInteger(numericId) || numericId <= 0) throw new Error(`Invalid ${label}`);
  return numericId;
};

export const dailyUpdateApi = {
  submit: async ({ jobId, notes, updateDate, photoUris }) => {
    const id = assertPositiveId(jobId, 'job id');
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) throw new Error('Authentication required');

    const formData = new FormData();
    if (notes?.trim()) formData.append('notes', notes.trim());
    if (updateDate) formData.append('update_date', updateDate);

    photoUris.forEach((uri) => {
      const filename = uri.split('/').pop();
      const ext = filename?.split('.').pop()?.toLowerCase() ?? 'jpg';
      formData.append('photos', { uri, name: filename || 'photo.jpg', type: ext === 'png' ? 'image/png' : 'image/jpeg' });
    });

    const response = await apiClient.post(`/dashboard/jobs/${id}/daily-updates`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getUpdates: async (jobId, { skip = 0, limit = 50 } = {}) => {
    const id = assertPositiveId(jobId, 'job id');
    const response = await apiClient.get(`/dashboard/jobs/${id}/daily-updates`, {
      params: { skip, limit },
    });
    return response.data;
  },
};
