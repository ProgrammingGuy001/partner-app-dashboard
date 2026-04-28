import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { getColors } from '../util/constants';

/**
 * Returns theme colors that automatically adapt to the system color scheme.
 * Re-computes only when the scheme changes (light ↔ dark).
 */
export const useTheme = () => {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = useMemo(() => getColors(colorScheme), [colorScheme]);
  return {
    colors,
    colorScheme,
    isDark: colorScheme === 'dark',
  };
};
