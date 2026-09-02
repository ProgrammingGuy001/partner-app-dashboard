import { useCallback } from 'react';
import { authApi } from '../api/authApi';
import { setTokenCache } from '../api/axiosConfig';
import { useAuthStore } from '../store/authStore';
import { STORAGE_KEYS } from '../util/constants';
import { logger } from '../util/helpers';
import * as SecureStore from '../util/secureStore';
import { useToast } from './useToast';
import { getApiErrorMessage, getApiFieldErrors } from '../api/apiErrors';

export const useAuth = () => {
  const toast = useToast();

  const { user, isAuthenticated, phoneNumber, setUser, setPhoneNumber } = useAuthStore();

  const register = useCallback(
    async (userData) => {
      try {
        await authApi.register(userData);
        setPhoneNumber(userData.phoneNumber);

        const loginResponse = await authApi.login(userData.phoneNumber);

        toast.success('OTP sent successfully!');
        return { success: true, data: loginResponse };
      } catch (error) {
        const message = getApiErrorMessage(error);
        const fields = getApiFieldErrors(error);
        toast.error(message);
        return { success: false, error: message, fieldErrors: fields };
      }
    },
    [setPhoneNumber, toast]
  );

  const login = useCallback(
    async (mobileNumber) => {
      try {
        const response = await authApi.login(mobileNumber);
        setPhoneNumber(mobileNumber);
        toast.success('OTP sent successfully!');
        return { success: true, data: response };
      } catch (error) {
        const message = getApiErrorMessage(error);
        const fields = getApiFieldErrors(error);
        toast.error(message);
        return { success: false, error: message, fieldErrors: fields };
      }
    },
    [setPhoneNumber, toast]
  );

  const verifyOtp = useCallback(
    async (otp) => {
      try {
        logger.info('useAuth', 'Starting OTP verification');
        const response = await authApi.verifyOtp(phoneNumber, otp);

        if (response?.access_token && typeof response.access_token === 'string') {
          await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, response.access_token);
          setTokenCache({ accessToken: response.access_token });
        } else {
          logger.warn('useAuth', 'No valid access_token in OTP response');
        }

        if (response?.refresh_token && typeof response.refresh_token === 'string') {
          await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token);
          setTokenCache({ refreshToken: response.refresh_token });
        } else {
          logger.warn('useAuth', 'No valid refresh_token in OTP response');
        }

        const verifiedUser = response?.user || response;
        setUser(verifiedUser);
        toast.success('Login successful!');

        return { success: true, data: response };
      } catch (error) {
        logger.error('useAuth', '❌ OTP verification failed:', error.message);
        const message = getApiErrorMessage(error);
        const fields = getApiFieldErrors(error);
        toast.error(message);
        return { success: false, error: message, fieldErrors: fields };
      }
    },
    [phoneNumber, setUser, toast]
  );

  const resendOtp = useCallback(
    async () => {
      try {
        const response = await authApi.resendOtp(phoneNumber);
        toast.success('OTP resent successfully!');
        return { success: true, data: response };
      } catch (error) {
        const message = getApiErrorMessage(error);
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [phoneNumber, toast]
  );

  return {
    user,
    isAuthenticated,
    phoneNumber,
    register,
    login,
    verifyOtp,
    resendOtp,
  };
};
