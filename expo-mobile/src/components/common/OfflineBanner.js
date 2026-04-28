import React from 'react';
import { View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Text } from '@/components/ui';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

const OfflineBanner = () => {
  const { isOnline, isChecking } = useNetworkStatus();

  if (isOnline || isChecking) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(300)}
      className="flex-row items-center justify-center gap-2 bg-warning px-4 py-2.5"
    >
      <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
      <Text className="text-[13px] font-semibold text-white">
        You're offline. Some features may be unavailable.
      </Text>
    </Animated.View>
  );
};

export default OfflineBanner;
