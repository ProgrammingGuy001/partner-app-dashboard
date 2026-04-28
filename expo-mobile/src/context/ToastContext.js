import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

const ToastContext = createContext(null);

const LIGHT_VARIANTS = {
  success: {
    icon: 'checkmark-circle',
    iconColor: '#065f46',
    bg: '#d1fae5',
    border: '#6ee7b7',
    text: '#065f46',
  },
  error: {
    icon: 'close-circle',
    iconColor: '#991b1b',
    bg: '#fee2e2',
    border: '#fca5a5',
    text: '#991b1b',
  },
  warning: {
    icon: 'warning',
    iconColor: '#92400e',
    bg: '#fef3c7',
    border: '#fcd34d',
    text: '#92400e',
  },
  info: {
    icon: 'information-circle',
    iconColor: '#6b4b41',
    bg: '#f5ede9',
    border: '#d4b5aa',
    text: '#6b4b41',
  },
};

const DARK_VARIANTS = {
  success: {
    icon: 'checkmark-circle',
    iconColor: '#34d399',
    bg: '#052e16',
    border: '#065f46',
    text: '#6ee7b7',
  },
  error: {
    icon: 'close-circle',
    iconColor: '#fb7185',
    bg: '#350a0a',
    border: '#7f1d1d',
    text: '#fca5a5',
  },
  warning: {
    icon: 'warning',
    iconColor: '#fbbf24',
    bg: '#351c00',
    border: '#78350f',
    text: '#fcd34d',
  },
  info: {
    icon: 'information-circle',
    iconColor: '#b8897f',
    bg: '#231513',
    border: '#4a3530',
    text: '#d4b5aa',
  },
};

const DURATION = 3000;

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 120, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [translateY, opacity]);

  const show = useCallback(
    (type, message) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setToast({ type, message });
      translateY.setValue(120);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();

      timerRef.current = setTimeout(dismiss, DURATION);
    },
    [translateY, opacity, dismiss]
  );

  const variants = isDark ? DARK_VARIANTS : LIGHT_VARIANTS;
  const v = toast ? (variants[toast.type] ?? variants.info) : null;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && v ? (
        <Animated.View
          pointerEvents="none"
          className="absolute left-4 right-4 z-[9999] items-center"
          style={[
            { bottom: insets.bottom + 20 },
            { transform: [{ translateY }], opacity },
          ]}
        >
          <View 
            className="flex-row items-center gap-2 border rounded-full px-4 py-2.5 shadow-sm"
            style={{ backgroundColor: v.bg, borderColor: v.border, elevation: 5, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 2 } }}
          >
            <Ionicons name={v.icon} size={18} color={v.iconColor} />
            <Text 
              className="flex-1 text-[13px] font-semibold tracking-[0.1px]" 
              style={{ color: v.text }} 
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
