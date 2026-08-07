import axios from 'axios';

import { API_BASE_URL, STORAGE_KEYS } from '../util/constants';
import { logger } from '../util/helpers';
import * as SecureStore from '../util/secureStore';

const formatValidationErrors = (detail) => {
  if (!Array.isArray(detail)) return null;
  const lines = detail
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return null;
      const field = Array.isArray(item.loc) ? item.loc.slice(1).join('.') : '';
      const msg = item.msg || 'Invalid input';
      return field ? `${field}: ${msg}` : msg;
    })
    .filter(Boolean);
  return lines.length ? lines.join(', ') : null;
};

const getErrorMessage = (data, status) => {
  let msg = 'An unexpected error occurred. Please try again.';

  if (data) {
    if (typeof data === 'string') msg = data;
    else if (data.detail !== undefined) {
      if (typeof data.detail === 'string') msg = data.detail;
      else {
        const validation = formatValidationErrors(data.detail);
        if (validation) msg = validation;
        else if (data.detail && typeof data.detail === 'object' && typeof data.detail.msg === 'string') {
          msg = data.detail.msg;
        }
      }
    } else if (typeof data.message === 'string') {
      msg = data.message;
    } else if (typeof data.error === 'string') {
      msg = data.error;
    }
  }

  // Map common technical errors to user-friendly messages
  const friendlyMap = {
    'Network error': 'Looks like you are offline. Please check your connection.',
    'Internal Server Error': 'Our servers are taking a break. Please try again in a moment.',
    'Not authorized': 'You do not have permission for this action.',
    'Not Found': 'We could not find the information you requested.',
  };

  for (const [techMsg, friendlyMsg] of Object.entries(friendlyMap)) {
    if (msg.includes(techMsg) || msg === techMsg) return friendlyMsg;
  }

  if (status >= 500) return 'Our servers are taking a break. Please try again in a moment.';
  if (status === 404) return 'The requested information could not be found.';

  return msg;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  // withCredentials should be false for React Native to avoid CORS issues
  withCredentials: false,
});

let accessTokenCache;
let refreshTokenCache;

export const setTokenCache = ({ accessToken, refreshToken } = {}) => {
  if (accessToken !== undefined) accessTokenCache = accessToken || null;
  if (refreshToken !== undefined) refreshTokenCache = refreshToken || null;
};

export const clearTokenCache = () => {
  accessTokenCache = null;
  refreshTokenCache = null;
};

const getAccessToken = async () => {
  if (accessTokenCache !== undefined) return accessTokenCache;
  accessTokenCache = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  return accessTokenCache;
};

const getRefreshToken = async () => {
  if (refreshTokenCache !== undefined) return refreshTokenCache;
  refreshTokenCache = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
  return refreshTokenCache;
};

apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let refreshQueue = [];

const processRefreshQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response) {
      const { status, data } = error.response;
      const message = getErrorMessage(data, status);

      if (status === 401 && !originalRequest._retried) {
        const refreshToken = await getRefreshToken();

        if (refreshToken) {
          if (isRefreshing) {
            // Queue this request until the refresh completes
            return new Promise((resolve, reject) => {
              refreshQueue.push({ resolve, reject });
            }).then((newToken) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return apiClient(originalRequest);
            });
          }

          originalRequest._retried = true;
          isRefreshing = true;

          try {
            // Retry logic for token refresh - reduced retries for faster session invalidation
            let refreshResponse;
            const maxRefreshRetries = 1; // Reduced from 2 to 1 for faster logout
            
            for (let attempt = 0; attempt < maxRefreshRetries; attempt++) {
              try {
                refreshResponse = await axios.post(
                  `${API_BASE_URL}/auth/refresh-token`,
                  { refresh_token: refreshToken },
                  { headers: { 'Content-Type': 'application/json' }, timeout: 5000 } // Add timeout
                );
                break; // Success, exit retry loop
              } catch (attemptError) {
                // Only retry on network errors, not on 4xx/5xx
                const isNetworkError = !attemptError.response;
                if (!isNetworkError || attempt === maxRefreshRetries - 1) {
                  throw attemptError;
                }
                logger.warn('axiosConfig', `Token refresh attempt ${attempt + 1} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 1000ms
              }
            }

            const newAccessToken = refreshResponse.data?.access_token;
            const newRefreshToken = refreshResponse.data?.refresh_token;

            if (!newAccessToken || typeof newAccessToken !== 'string') {
              throw new Error('Invalid access token received from refresh endpoint');
            }

            await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, newAccessToken);
            accessTokenCache = newAccessToken;
            if (newRefreshToken && typeof newRefreshToken === 'string') {
              await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
              refreshTokenCache = newRefreshToken;
            }

            processRefreshQueue(null, newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return apiClient(originalRequest);
          } catch (refreshError) {
            processRefreshQueue(refreshError, null);
            // Only logout on actual auth errors (401/403), not network errors
            const isAuthError = refreshError.response?.status === 401 || refreshError.response?.status === 403;
            if (isAuthError) {
              logger.warn('axiosConfig', 'Refresh token invalid, logging out');
              await require('../store/authStore').useAuthStore.getState().clearAuth();
            }
            const sessionError = new Error('Session expired. Please log in again.');
            sessionError.status = 401;
            sessionError.isAuthError = isAuthError;
            throw sessionError;
          } finally {
            isRefreshing = false;
          }
        }

        // No refresh token available — force logout
        await require('../store/authStore').useAuthStore.getState().clearAuth();
      }

      const apiError = new Error(message);
      apiError.status = status;
      apiError.data = data;
      throw apiError;
    }
    

    if (error.request) {
      const networkError = new Error('Network error. Please check your connection.');
      networkError.isNetworkError = true;
      throw networkError;
    }

    const genericError = new Error(error.message || 'An unexpected error occurred');
    throw genericError;
  }
);

export default apiClient;
