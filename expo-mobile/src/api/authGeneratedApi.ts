import {
  loginApiV1AuthLoginPost,
  logoutApiV1AuthLogoutPost,
  readUsersMeApiV1AuthMeGet,
  refreshTokenApiV1AuthRefreshTokenPost,
  registerUserApiV1AuthRegisterPost,
  resendOtpApiV1AuthResendOtpPost,
  verifyAccessTokenApiV1AuthVerifyTokenGet,
  verifyOtpApiV1AuthVerifyOtpPost,
  type UserRegistration,
} from './generatedClient';

export const registerUser = async (body: UserRegistration) => {
  const response = await registerUserApiV1AuthRegisterPost({ body, throwOnError: true });
  return response.data;
};

export const login = async (phoneNumber: string) => {
  const response = await loginApiV1AuthLoginPost({ body: { phone_number: phoneNumber }, throwOnError: true });
  return response.data;
};

export const verifyOtp = async (phoneNumber: string, otp: string) => {
  const response = await verifyOtpApiV1AuthVerifyOtpPost({ body: { phone_number: phoneNumber, otp }, throwOnError: true });
  return response.data;
};

export const resendOtp = async (phoneNumber: string) => {
  const response = await resendOtpApiV1AuthResendOtpPost({ body: { phone_number: phoneNumber }, throwOnError: true });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await readUsersMeApiV1AuthMeGet({ throwOnError: true });
  return response.data;
};

export const logout = async () => {
  const response = await logoutApiV1AuthLogoutPost({ throwOnError: true });
  return response.data;
};

export const verifyToken = async () => {
  const response = await verifyAccessTokenApiV1AuthVerifyTokenGet({ throwOnError: true });
  return response.data;
};

export const refreshToken = async () => {
  const response = await refreshTokenApiV1AuthRefreshTokenPost({ throwOnError: true });
  return response.data;
};
