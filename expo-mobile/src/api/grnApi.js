import apiClient from './axiosConfig';

export const grnApi = {
  getAssigned: async () => {
    const grns = [];
    const limit = 50;
    while (true) {
      const res = await apiClient.get('/dashboard/grn/assigned', {
        params: { offset: grns.length, limit },
      });
      grns.push(...res.data);
      if (res.data.length < limit) return grns;
    }
  },

  submit: async (grnId, packages) => {
    const res = await apiClient.post(`/dashboard/grn/${grnId}/submit`, { packages });
    return res.data;
  },
};
