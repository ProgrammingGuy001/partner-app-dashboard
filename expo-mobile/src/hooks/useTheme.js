import { useMemo } from "react";
import { getColors } from "../util/constants";

/**
 * Returns the light theme used across the mobile app. NativeWind reads the same
 * values from global.css `:root`, so both sides stay in step.
 */
export const useTheme = () => {
  const colorScheme = "light";
  const colors = useMemo(() => getColors(colorScheme), []);
  return {
    colors,
    colorScheme,
    isDark: colorScheme === "dark",
  };
};
