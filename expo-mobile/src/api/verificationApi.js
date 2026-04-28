import apiClient from './axiosConfig';
import { toRNFile } from '../util/helpers';

export const verificationApi = {
  getVerificationStatus: async () => {
    const response = await apiClient.get('/verification/status');
    return response.data;
  },

  verifyPan: async (pan) => {
    const response = await apiClient.post('/verification/pan', {
      pan: pan.toUpperCase(),
    });
    return response.data;
  },

  verifyBank: async (accountNumber, ifsc) => {
    const response = await apiClient.post('/verification/bank', {
      account_number: accountNumber,
      ifsc: ifsc.toUpperCase(),
      fetch_ifsc: false,
    });
    return response.data;
  },

  uploadDocument: async (file) => {
    const formData = new FormData();
    const rnFile = toRNFile(file);
    if (!rnFile) {
      throw new Error('Invalid file selected');
    }
    formData.append('file', rnFile);

    const response = await apiClient.post('/verification/verify_document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getPanelAccess: async () => {
    const response = await apiClient.get('/verification/panel-access');
    return response.data;
  },
};
