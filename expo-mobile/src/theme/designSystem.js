export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "800" },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "800" },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "800" },
  title3: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 23, fontWeight: "500" },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: "700" },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: "500" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  captionStrong: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
};

export const palette = {
  light: {
    primary: "#6b4b41",
    primaryDark: "#513830",
    primaryLight: "#f3ece9",
    primaryMuted: "#faf7f5",
    accent: "#c4af9e",
    accentLight: "#f5efe8",
    text: "#1a1614",
    textSecondary: "#57504b",
    textMuted: "#857c75",
    border: "#e8e4e0",
    borderStrong: "#d6d0ca",
    background: "#ffffff",
    surface: "#f7f6f4",
    surfaceAlt: "#f1eeeb",
    surfaceElevated: "#ffffff",
    danger: "#c0392b",
    success: "#27864a",
    warning: "#b47407",
    info: "#2f6f9f",
    overlay: "rgba(26, 20, 18, 0.45)",
    brandGradient: ["#4a332c", "#6b4b41", "#8a6357"],
  },
  dark: {
    primary: "#af7c71",
    primaryDark: "#c48a7d",
    primaryLight: "#3a2a26",
    primaryMuted: "#1c1515",
    accent: "#d7c5aa",
    accentLight: "#2e2420",
    text: "#f1e6dd",
    textSecondary: "#d7c5aa",
    textMuted: "#b3a596",
    border: "#4f372f",
    borderStrong: "#6b4b41",
    background: "#1c1515",
    surface: "#2a2020",
    surfaceAlt: "#332626",
    surfaceElevated: "#332626",
    danger: "#ff7a8a",
    success: "#65d6a4",
    warning: "#f0b766",
    info: "#8ab4ff",
    overlay: "rgba(0, 0, 0, 0.72)",
    brandGradient: ["#1c1515", "#332626", "#6b4b41"],
  },
};

export const shadowTokens = {
  light: {
    // Quiet elevation: on a white canvas a heavy drop reads as dirt, not depth.
    sm: { boxShadow: "0 1px 2px rgba(26, 20, 18, 0.06)" },
    md: { boxShadow: "0 4px 12px rgba(26, 20, 18, 0.08)" },
    lg: { boxShadow: "0 12px 28px rgba(26, 20, 18, 0.10)" },
  },
  dark: {
    sm: {
      boxShadow:
        "0 1px 2px rgba(0, 0, 0, 0.42), 0 1px 8px rgba(175, 124, 113, 0.06)",
    },
    md: {
      boxShadow:
        "0 10px 28px rgba(0, 0, 0, 0.52), 0 2px 10px rgba(175, 124, 113, 0.07)",
    },
    lg: {
      boxShadow:
        "0 22px 48px rgba(0, 0, 0, 0.62), 0 8px 18px rgba(175, 124, 113, 0.09)",
    },
  },
};

export const hitSlop = { top: 8, right: 8, bottom: 8, left: 8 };
