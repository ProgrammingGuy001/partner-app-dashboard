import axios from "axios";
import axiosRetry from "axios-retry";
import Cookies from "js-cookie";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://adminapi.modula.in';

const CSRF_COOKIE_NAMES = ['csrf_token', 'csrftoken', 'XSRF-TOKEN'];
const MUTATING_METHODS = ['post', 'put', 'patch', 'delete'];

const getCsrfToken = (): string | undefined => {
  for (const name of CSRF_COOKIE_NAMES) {
    const token = Cookies.get(name);
    if (token) return token;
  }
  return undefined;
};

// Add request timeout
const REQUEST_TIMEOUT = 30000;

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  withCredentials: true, // Send cookies with requests
  headers: {
    "Content-Type": "application/json",
  },
});

// Configure retry logic
axiosRetry(axiosInstance, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx status codes
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response?.status ? error.response.status >= 500 : false)
    );
  },
});

// Request interceptor - Attach CSRF token to state-changing requests
axiosInstance.interceptors.request.use(
  (config) => {
    if (MUTATING_METHODS.includes(config.method?.toLowerCase() ?? '')) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config: originalRequest } = error;

    // Handle 401 Unauthorized
    if (response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login') && !originalRequest.url?.includes('/auth/refresh-token')) {
      originalRequest._retry = true;
      try {
        await axios.post(`${API_BASE_URL}/auth/refresh-token`, {}, { withCredentials: true });
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        try {
          if (!globalThis.location.pathname.includes("/login")) {
            globalThis.location.assign("/login");
          }
        } catch (e) {
          console.error("Error during logout:", e);
        }
        return Promise.reject(refreshError);
      }
    } else if (response?.status === 401) {
      try {
        // Redirect to login if unauthorized
        if (!globalThis.location.pathname.includes("/login")) {
          globalThis.location.assign("/login");
        }
      } catch (e) {
        console.error("Error during logout:", e);
      }
    }

    // Handle network errors
    if (!response) {
      console.error("Network error:", error.message);
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
