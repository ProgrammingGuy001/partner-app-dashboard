import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

const TABLET_BREAKPOINT = 768;

/**
 * Returns responsive layout helpers based on current screen width.
 * Use this instead of NativeWind md: breakpoints for reliable RN tablet support.
 */
export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isTablet = width >= TABLET_BREAKPOINT;
    const isLandscape = width > height;

    return {
      /** true when screen width ≥ 768 px */
      isTablet,
      isLandscape,
      width,
      height,

      /** Pick a value based on device type */
      select: (phone, tablet) => (isTablet ? tablet : phone),

      /** Horizontal page padding: 16 phone / 32 tablet */
      px: isTablet ? 32 : 16,

      /** Gap between grid cells */
      gap: isTablet ? 16 : 10,

      /** Number of columns for a grid */
      numColumns: (phone, tablet) => (isTablet ? tablet : phone),

      /** Max width for centered auth / form cards on tablet */
      maxCardWidth: isTablet ? 480 : undefined,

      /** Max width for content area on tablet */
      maxContentWidth: isTablet ? 900 : undefined,
    };
  }, [width, height]);
};
