import apiClient from './axiosConfig';

export const authApi = {
  register: async (userData) => {
    const response = await apiClient.post('/auth/register', {
      phone_number: userData.phoneNumber,
      first_name: userData.firstName,
      last_name: userData.lastName,
      city: userData.city,
      pincode: userData.pincode,
      is_internal: userData.isInternal || false,
    });
    return response.data;
  },

  login: async (phoneNumber) => {
    const response = await apiClient.post('/auth/login', {
      phone_number: phoneNumber,
    });
    return response.data;
  },

  verifyOtp: async (phoneNumber, otp) => {
    const response = await apiClient.post('/auth/verify-otp', {
      phone_number: phoneNumber,
      otp,
    });
    return response.data;
  },

  resendOtp: async (phoneNumber) => {
    const response = await apiClient.post('/auth/resend-otp', {
      phone_number: phoneNumber,
    });
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  me: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  verifyToken: async () => {
    const response = await apiClient.get('/auth/verify-token');
    return response.data;
  },

  refreshToken: async () => {
    const response = await apiClient.post('/auth/refresh-token');
    return response.data;
  },
};
