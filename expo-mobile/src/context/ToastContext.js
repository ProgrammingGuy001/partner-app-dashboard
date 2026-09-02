import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { radii, typography } from '../theme/designSystem';

const ToastContext = createContext(null);

const DURATION = 3000;

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const translateY = useSharedValue(120);
  const opacity = useSharedValue(0);
  const timerRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const variants = useMemo(() => ({
    success: {
      icon: 'checkmark-circle',
      iconColor: colors.success,
      className: 'bg-success-muted border-success',
      text: colors.success,
    },
    error: {
      icon: 'close-circle',
      iconColor: colors.danger,
      className: 'bg-destructive-muted border-destructive',
      text: colors.danger,
    },
    warning: {
      icon: 'warning',
      iconColor: colors.warning,
      className: 'bg-warning-muted border-warning',
      text: colors.warning,
    },
    info: {
      icon: 'information-circle',
      iconColor: colors.info,
      className: 'bg-info-muted border-info',
      text: colors.info,
    },
  }), [colors]);

  const dismiss = useCallback(() => {
    translateY.value = withTiming(120, { duration: 220 });
    opacity.value = withTiming(0, { duration: 180 });
    setTimeout(() => setToast(null), 220);
  }, [translateY, opacity]);

  const show = useCallback(
    (type, message) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setToast({ type, message });
      translateY.value = 120;
      opacity.value = 0;
      translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
      opacity.value = withTiming(1, { duration: 160 });

      timerRef.current = setTimeout(dismiss, DURATION);
    },
    [translateY, opacity, dismiss]
  );

  const v = toast ? (variants[toast.type] ?? variants.info) : null;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && v ? (
        <Animated.View
          pointerEvents="none"
          className="absolute left-4 right-4 z-[9999] items-center"
          style={[
            { bottom: insets.bottom + radii.xl },
            animatedStyle,
          ]}
        >
          <View 
            className={`flex-row items-center gap-2 rounded-full border px-4 py-2.5 shadow-sm ${v.className}`}
            style={colors.shadowMd}
          >
            <Ionicons name={v.icon} size={18} color={v.iconColor} />
            <Text 
              className="flex-1 font-semibold"
              style={{ fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, color: v.text }}
              numberOfLines={2}
            >
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};

export const useToastContext = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastContext must be used within ToastProvider');
  return ctx;
};
