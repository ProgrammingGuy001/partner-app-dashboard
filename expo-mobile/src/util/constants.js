import {
  palette,
  radii,
  shadowTokens,
  spacing,
  typography,
} from "../theme/designSystem";

const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
if (__DEV__) console.info(`[Config] API Base URL: ${rawApiBaseUrl}`);
if (!rawApiBaseUrl) {
  throw new Error(
    "[Config] EXPO_PUBLIC_API_BASE_URL environment variable is required",
  );
}
const normalizedBaseUrl = rawApiBaseUrl.replace(/\/+$/, "");
if (__DEV__)
  console.info(`[Config] Normalized API Base URL: ${normalizedBaseUrl}`);

export const API_BASE_URL = normalizedBaseUrl.endsWith("/api/v1")
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/api/v1`;
export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || "Modula Partner";

export const JOB_STATUS = {
  CREATED: "created",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  PAUSED: "paused",
};

export const JOB_STATUS_LABELS = {
  [JOB_STATUS.CREATED]: "Created",
  [JOB_STATUS.IN_PROGRESS]: "In Progress",
  [JOB_STATUS.COMPLETED]: "Completed",
  [JOB_STATUS.PAUSED]: "Paused",
};

// NativeWind classes (used where Tailwind is available)
export const JOB_STATUS_COLORS = {
  [JOB_STATUS.CREATED]: "bg-surface-alt text-muted-foreground",
  [JOB_STATUS.IN_PROGRESS]: "bg-warning-muted text-warning-muted-foreground",
  [JOB_STATUS.COMPLETED]: "bg-success-muted text-success-muted-foreground",
  [JOB_STATUS.PAUSED]: "bg-warning-muted text-warning-muted-foreground",
};

// Raw style values for inline RN styles (used in JobCard left-border accent)
export const JOB_STATUS_ACCENT = {
  [JOB_STATUS.CREATED]: {
    border: "#64748b",
    badge: "#18202a",
    text: "#cbd5e1",
    dot: "#94a3b8",
  },
  [JOB_STATUS.IN_PROGRESS]: {
    border: "#f0b766",
    badge: "#2a2114",
    text: "#f6d59b",
    dot: "#f0b766",
  },
  [JOB_STATUS.COMPLETED]: {
    border: "#65d6a4",
    badge: "#14251d",
    text: "#9ce8c4",
    dot: "#65d6a4",
  },
  [JOB_STATUS.PAUSED]: {
    border: "#d49a76",
    badge: "#2a1d18",
    text: "#f0c1a4",
    dot: "#d49a76",
  },
};

export const VERIFICATION_STEPS = {
  PAN: "pan",
  BANK: "bank",
  DOCUMENT: "document",
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
];

export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth-token",
  REFRESH_TOKEN: "refresh-token",
};

export const ROUTES = {
  SPLASH: "Splash",
  LOGIN: "Login",
  REGISTER: "Register",
  OTP: "OTP",
  VERIFICATION: "Verification",
  MAIN_TABS: "MainTabs",
  DASHBOARD: "Dashboard",
  SITE_REQUISITE: "SiteRequisite",
  HISTORY: "History",
  ACCOUNT: "Account",
  JOB_DETAIL: "JobDetail",
  CHECKLIST: "Checklist",
  BUCKET: "Bucket",
  SUBMIT: "Submit",
  NOT_FOUND: "NotFound",
  SITE_GRN: "SiteGRN",
  DAILY_REPORT: "DailyReport",
};

// Placeholder text for form inputs
export const PLACEHOLDERS = {
  PHONE: "9876543210",
  FIRST_NAME: "First name",
  LAST_NAME: "Last name",
  CITY: "City",
  PINCODE: "Pincode",
  SALES_ORDER: "SO-XXXXX",
  CABINET_POSITION: "Cabinet position",
  SEARCH_HISTORY: "SO-XXXXX or POC Name",
  ACCOUNT_NUMBER: "0000 0000 0000",
  IFSC: "HDFC0001234",
  PAN: "ABCDE1234F",
  OTP: "Enter 6-digit OTP",
  COMMENTS: "Add comments...",
};

export const THEME = palette.light;

export const DARK_THEME = palette.dark;

export const getColors = (colorScheme = "light") => {
  const theme = colorScheme === "dark" ? DARK_THEME : THEME;
  const shadows =
    colorScheme === "dark" ? shadowTokens.dark : shadowTokens.light;

  return {
    ...theme,
    accentForeground: theme.text,
    primaryForeground: theme.background,
    spacing,
    radii,
    typography,
    shadowSm: shadows.sm,
    shadowMd: shadows.md,
    shadowLg: shadows.lg,
  };
};

// Legacy support — light theme only
export const BRAND_COLORS = getColors("light");
