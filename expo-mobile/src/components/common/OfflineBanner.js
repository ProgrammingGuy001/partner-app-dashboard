import React from 'react';
import { View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Text } from '@/components/ui';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTheme } from '../../hooks/useTheme';
import { typography } from '../../theme/designSystem';

const OfflineBanner = () => {
  const { isOnline, isChecking } = useNetworkStatus();
  const { colors } = useTheme();

  if (isOnline || isChecking) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(300)}
      className="flex-row items-center justify-center gap-2 bg-warning px-4 py-2.5"
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.primaryForeground} />
      <Text className="font-semibold" style={{ fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, color: colors.primaryForeground }}>
        You're offline. Some features may be unavailable.
      </Text>
    </Animated.View>
  );
};

export default OfflineBanner;
