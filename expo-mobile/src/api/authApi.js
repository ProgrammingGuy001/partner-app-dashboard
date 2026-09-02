import { getCurrentUser, login, logout, refreshToken, registerUser, resendOtp, verifyOtp, verifyToken } from './authGeneratedApi';

export const authApi = {
  register: (userData) => registerUser({
      phone_number: userData.phoneNumber,
      first_name: userData.firstName,
      last_name: userData.lastName,
      city: userData.city,
      pincode: userData.pincode,
      is_internal: userData.isInternal || false,
    }),

  login,

  verifyOtp,

  resendOtp,

  logout,

  me: getCurrentUser,

  verifyToken,

  refreshToken,
};
