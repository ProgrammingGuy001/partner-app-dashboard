import apiClient from './axiosConfig';

export const grnApi = {
  getAssigned: async () => {
    const res = await apiClient.get('/api/v1/dashboard/grn/assigned');
    return res.data;
  },

  submit: async (grnId, packages) => {
    const res = await apiClient.post(`/api/v1/dashboard/grn/${grnId}/submit`, { packages });
    return res.data;
  },
};
