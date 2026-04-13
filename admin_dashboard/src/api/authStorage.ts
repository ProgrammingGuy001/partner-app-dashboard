const ADMIN_ACCESS_TOKEN_KEY = 'admin-auth-token';
const ADMIN_REFRESH_TOKEN_KEY = 'admin-refresh-token';

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
};

const isBrowser = () => typeof window !== 'undefined';

export const getAdminAccessToken = (): string | null => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
};

export const getAdminRefreshToken = (): string | null => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);
};

export const persistAdminTokens = (payload?: TokenPayload | null): void => {
  if (!isBrowser() || !payload) return;

  if (typeof payload.access_token === 'string' && payload.access_token.trim()) {
    window.localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, payload.access_token);
  }

  if (typeof payload.refresh_token === 'string' && payload.refresh_token.trim()) {
    window.localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, payload.refresh_token);
  }
};

export const clearAdminTokens = (): void => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
};
