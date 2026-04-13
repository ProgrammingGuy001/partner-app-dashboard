import axios from "axios";
import axiosRetry from "axios-retry";
import Cookies from "js-cookie";
import { clearAdminTokens, getAdminAccessToken, getAdminRefreshToken, persistAdminTokens } from "./authStorage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";


const CSRF_COOKIE_NAMES = ["csrf_token", "csrftoken", "XSRF-TOKEN"];
const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

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
    const accessToken = getAdminAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (MUTATING_METHODS.has(config.method?.toLowerCase() ?? "")) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config: originalRequest } = error;

    // Attempt a silent token refresh on the first 401, except for auth endpoints
    if (
      response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh-token")
    ) {
      originalRequest._retry = true;
      try {
        const refreshToken = getAdminRefreshToken();
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          refreshToken ? { refresh_token: refreshToken } : {},
          { withCredentials: true },
        );
        persistAdminTokens(refreshResponse.data);
        // Retry the original request with the new cookie
        return axiosInstance(originalRequest);
      } catch {
        clearAdminTokens();
        // Refresh failed — reject so React Query / ProtectedRoute handles the redirect
        return Promise.reject(error);
      }
    }

    throw error;
  },
);

export default axiosInstance;
