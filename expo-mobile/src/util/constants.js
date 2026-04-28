import { Platform } from 'react-native';

const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
if (__DEV__) console.info(`[Config] API Base URL: ${rawApiBaseUrl}`);
if (!rawApiBaseUrl) {
  throw new Error('[Config] EXPO_PUBLIC_API_BASE_URL environment variable is required');
}
const normalizedBaseUrl = rawApiBaseUrl.replace(/\/+$/, '');
if (__DEV__) console.info(`[Config] Normalized API Base URL: ${normalizedBaseUrl}`);

export const API_BASE_URL = normalizedBaseUrl.endsWith('/api/v1')
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/api/v1`;
export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'Modula Partner';

export const JOB_STATUS = {
  CREATED: 'created',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  PAUSED: 'paused',
};

export const JOB_STATUS_LABELS = {
  [JOB_STATUS.CREATED]: 'Created',
  [JOB_STATUS.IN_PROGRESS]: 'In Progress',
  [JOB_STATUS.COMPLETED]: 'Completed',
  [JOB_STATUS.PAUSED]: 'Paused',
};

// NativeWind classes (used where Tailwind is available)
export const JOB_STATUS_COLORS = {
  [JOB_STATUS.CREATED]: 'bg-stone-100 text-stone-700',
  [JOB_STATUS.IN_PROGRESS]: 'bg-amber-100 text-amber-800',
  [JOB_STATUS.COMPLETED]: 'bg-emerald-100 text-emerald-800',
  [JOB_STATUS.PAUSED]: 'bg-yellow-100 text-yellow-800',
};

// Raw style values for inline RN styles (used in JobCard left-border accent)
export const JOB_STATUS_ACCENT = {
  [JOB_STATUS.CREATED]:     { border: '#a8a29e', badge: '#f5f5f4', text: '#57534e', dot: '#a8a29e' },
  [JOB_STATUS.IN_PROGRESS]: { border: '#f59e0b', badge: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
  [JOB_STATUS.COMPLETED]:   { border: '#10b981', badge: '#ecfdf5', text: '#065f46', dot: '#10b981' },
  [JOB_STATUS.PAUSED]:      { border: '#eab308', badge: '#fefce8', text: '#713f12', dot: '#eab308' },
};

export const VERIFICATION_STEPS = {
  PAN: 'pan',
  BANK: 'bank',
  DOCUMENT: 'document',
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
];

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth-token',
  REFRESH_TOKEN: 'refresh-token',
};

export const ROUTES = {
  SPLASH: 'Splash',
  LOGIN: 'Login',
  REGISTER: 'Register',
  OTP: 'OTP',
  VERIFICATION: 'Verification',
  MAIN_TABS: 'MainTabs',
  DASHBOARD: 'Dashboard',
  SITE_REQUISITE: 'SiteRequisite',
  HISTORY: 'History',
  ACCOUNT: 'Account',
  JOB_DETAIL: 'JobDetail',
  CHECKLIST: 'Checklist',
  BUCKET: 'Bucket',
  SUBMIT: 'Submit',
  NOT_FOUND: 'NotFound',
};

// Placeholder text for form inputs
export const PLACEHOLDERS = {
  PHONE: '9876543210',
  FIRST_NAME: 'First name',
  LAST_NAME: 'Last name',
  CITY: 'City',
  PINCODE: 'Pincode',
  SALES_ORDER: 'SO-XXXXX',
  CABINET_POSITION: 'Cabinet position',
  SEARCH_HISTORY: 'SO-XXXXX or POC Name',
  ACCOUNT_NUMBER: '0000 0000 0000',
  IFSC: 'HDFC0001234',
  PAN: 'ABCDE1234F',
  OTP: 'Enter 6-digit OTP',
  COMMENTS: 'Add comments...',
};

export const THEME = {
  primary: '#5a3d35',
  primaryDark: '#45302a',
  primaryLight: '#f3ecea',
  primaryMuted: '#fcfaf9',
  text: '#1a0d0a',
  textSecondary: '#6e5a52',
  textMuted: '#9a8b84',
  border: '#e8e2de',
  borderStrong: '#d8cfca',
  background: '#fcfbf9',
  surface: '#ffffff',
  surfaceAlt: '#f7f3f1',
  danger: '#e11d48',
  success: '#059669',
  warning: '#d97706',
  info: '#2563eb',
  shadowColor: '#3a1a1a',
};

// Dark palette — mirrors the CSS variables in global.css `.dark` block
export const DARK_THEME = {
  primary: '#b8897f',      // --primary: 15 28% 62%
  primaryDark: '#9b7c73',  // gradient end
  primaryLight: '#33201d', // --primary-light: 15 26% 20%
  primaryMuted: '#2a1818', // --surface
  text: '#ede9de',         // --foreground: 42 22% 93%
  textSecondary: '#c4b0a8',
  textMuted: '#9e8f89',    // --muted-foreground: 30 20% 68%
  border: '#4a3530',       // --border: 14 26% 30%
  borderStrong: '#664040', // --border-strong: 14 26% 40%
  background: '#140b0a',   // --background: 0 30% 9%
  surface: '#231513',      // --card/surface: 0 26% 14%
  surfaceAlt: '#2e1b1b',   // --surface-alt: 14 22% 20%
  danger: '#f87171',
  success: '#4ade80',
  warning: '#fbbf24',
  info: '#60a5fa',
  shadowColor: '#000',
};

export const getColors = (colorScheme = 'light') => {
  const theme = colorScheme === 'dark' ? DARK_THEME : THEME;
  const isAndroid = Platform.OS === 'android';
  const shadowColor = isAndroid ? '#000' : theme.shadowColor;
  const isDark = colorScheme === 'dark';
  return {
    ...theme,
    shadowSm: {
      shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.3 : 0.04,
      shadowRadius: 2,
      elevation: 2,
    },
    shadowMd: {
      shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    shadowLg: {
      shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.5 : 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
  };
};

// Legacy support — light theme only
export const BRAND_COLORS = getColors('light');
