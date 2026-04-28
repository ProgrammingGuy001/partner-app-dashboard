import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui';
import { useTheme } from '../../hooks/useTheme';

/**
 * Reusable empty state component.
 */
const EmptyState = ({ icon = 'folder-open-outline', title = 'Nothing here', subtitle, style }) => {
  return (
    <View
      className="items-center justify-center rounded-2xl border border-border bg-card p-10 gap-3"
      style={style}
    >
      <View className="w-[72px] h-[72px] rounded-full bg-primary-light items-center justify-center">
        <Ionicons name={icon} size={36} className="text-muted-foreground" color="#9a8b84" />
      </View>
      <Text className="text-base font-bold text-foreground text-center">{title}</Text>
      {subtitle ? (
        <Text className="text-[13px] text-muted-foreground text-center leading-[18px]">{subtitle}</Text>
      ) : null}
    </View>
  );
};

/**
 * Animated pulsing skeleton block — use for loading placeholders.
 */
export const SkeletonBlock = ({ width = '100%', height = 16, borderRadius = 8, style }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      className="bg-border"
      style={[{ width, height, borderRadius, opacity }, style]}
    />
  );
};

/**
 * Full-screen skeleton loader for list-based screens.
 */
export const SkeletonList = ({ rows = 4, px = 16 }) => {
  return (
    <View className="flex-1 bg-background pt-5 gap-3" style={{ padding: px }}>
      <SkeletonBlock height={28} width="55%" borderRadius={8} />
      <SkeletonBlock height={16} width="35%" borderRadius={6} style={{ marginBottom: 8 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          className="rounded-2xl border border-border bg-card p-4 gap-2.5"
        >
          <View className="flex-row justify-between items-center">
            <SkeletonBlock height={16} width="60%" />
            <SkeletonBlock height={22} width={72} borderRadius={20} />
          </View>
          <SkeletonBlock height={13} width="40%" />
          <SkeletonBlock height={13} width="30%" />
        </View>
      ))}
    </View>
  );
};

export default EmptyState;
