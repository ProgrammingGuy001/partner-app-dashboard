import { useMemo } from "react";
import { getColors } from "../util/constants";

/**
 * Returns the dark theme used across the mobile app.
 */
export const useTheme = () => {
  const colorScheme = "dark";
  const colors = useMemo(() => getColors(colorScheme), []);
  return {
    colors,
    colorScheme,
    isDark: colorScheme === "dark",
  };
};
