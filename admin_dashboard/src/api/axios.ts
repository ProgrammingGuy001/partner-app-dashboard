import axios from 'axios';
import axiosRetry from 'axios-retry';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://adminapi.modula.in';


// Add request timeout
const REQUEST_TIMEOUT = 30000;

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Configure retry logic
axiosRetry(axiosInstance, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx status codes
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status ? error.response.status >= 500 : false);
  },
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;

    // Handle 401 Unauthorized
    if (response?.status === 401) {
      try {
        // Redirect to login if unauthorized
        if (!globalThis.location.pathname.includes('/login')) {
          globalThis.location.assign('/login');
        }
      } catch (e) {
        console.error('Error during logout:', e);
      }
    }

    // Handle network errors
    if (!response) {
      console.error('Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;