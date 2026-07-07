import React from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui';
import { hitSlop } from '../../theme/designSystem';
import { useTheme } from '../../hooks/useTheme';

export const Card = ({ children, elevated = false, padded = true, className = '', style, ...props }) => {
  const { colors } = useTheme();

  return (
    <View
      className={`rounded-2xl border border-border bg-card ${padded ? 'p-5' : ''} ${className}`}
      style={[elevated ? colors.shadowMd : colors.shadowSm, style]}
      {...props}
    >
      {children}
    </View>
  );
};

export const IconButton = ({
  icon,
  label,
  onPress,
  tone = 'neutral',
  disabled = false,
  size = 44,
  className = '',
  style,
  iconSize = 20,
}) => {
  const { colors, isDark } = useTheme();
  const toneStyles = {
    neutral: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      color: colors.text,
    },
    primary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      color: colors.primaryForeground,
    },
    subtle: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primaryLight,
      color: colors.primary,
    },
    danger: {
      backgroundColor: colors.danger + (isDark ? '24' : '12'),
      borderColor: colors.danger + '30',
      color: colors.danger,
    },
  };
  const toneStyle = toneStyles[tone] || toneStyles.neutral;

  const handlePress = (event) => {
    Haptics.selectionAsync().catch(() => {});
    onPress?.(event);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={hitSlop}
      className={`items-center justify-center border ${className}`}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: 14,
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
          opacity: disabled ? 0.45 : pressed ? 0.76 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
        colors.shadowSm,
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={toneStyle.color} />
    </Pressable>
  );
};

export const FieldLabel = ({ children, required = false, className = '' }) => (
  <Text className={`text-xs font-bold text-muted-foreground uppercase mb-2 ${className}`}>
    {children}
    {required ? <Text className="text-destructive"> *</Text> : null}
  </Text>
);

export const SectionTitle = ({ title, subtitle, right, className = '' }) => (
  <View className={`flex-row items-end justify-between gap-3 ${className}`}>
    <View className="flex-1">
      <Text className="text-lg font-extrabold text-foreground">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-[13px] text-muted-foreground mt-1">
          {subtitle}
        </Text>
      ) : null}
    </View>
    {right ? <View>{right}</View> : null}
  </View>
);

export const StatusBadge = ({ label, tone = 'neutral', icon, className = '' }) => {
  const { colors, isDark } = useTheme();
  const tones = {
    neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary, border: colors.border },
    primary: { bg: colors.primaryLight, fg: colors.primary, border: colors.primary + '28' },
    success: { bg: colors.success + (isDark ? '22' : '14'), fg: colors.success, border: colors.success + '30' },
    warning: { bg: colors.warning + (isDark ? '24' : '14'), fg: colors.warning, border: colors.warning + '32' },
    danger: { bg: colors.danger + (isDark ? '24' : '12'), fg: colors.danger, border: colors.danger + '30' },
    info: { bg: colors.info + (isDark ? '22' : '12'), fg: colors.info, border: colors.info + '30' },
  };
  const toneStyle = tones[tone] || tones.neutral;

  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-xl border px-2.5 py-1.5 ${className}`}
      style={{ backgroundColor: toneStyle.bg, borderColor: toneStyle.border }}
      accessibilityRole="text"
    >
      {icon ? <Ionicons name={icon} size={13} color={toneStyle.fg} /> : null}
      <Text style={{ color: toneStyle.fg }} className="text-[11px] font-extrabold uppercase">
        {label}
      </Text>
    </View>
  );
};

export const Notice = ({ tone = 'info', title, message, icon, className = '' }) => {
  const { colors, isDark } = useTheme();
  const tones = {
    info: { bg: colors.info + (isDark ? '22' : '10'), fg: colors.info, border: colors.info + '30', icon: icon || 'information-circle-outline' },
    success: { bg: colors.success + (isDark ? '22' : '10'), fg: colors.success, border: colors.success + '30', icon: icon || 'checkmark-circle-outline' },
    warning: { bg: colors.warning + (isDark ? '24' : '12'), fg: colors.warning, border: colors.warning + '32', icon: icon || 'warning-outline' },
    danger: { bg: colors.danger + (isDark ? '24' : '12'), fg: colors.danger, border: colors.danger + '30', icon: icon || 'alert-circle-outline' },
  };
  const toneStyle = tones[tone] || tones.info;

  return (
    <View
      className={`flex-row items-start gap-3 rounded-2xl border p-4 ${className}`}
      style={{ backgroundColor: toneStyle.bg, borderColor: toneStyle.border }}
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : 'summary'}
    >
      <Ionicons name={toneStyle.icon} size={20} color={toneStyle.fg} style={{ marginTop: 1 }} />
      <View className="flex-1">
        {title ? (
          <Text className="text-sm font-extrabold" style={{ color: toneStyle.fg }}>
            {title}
          </Text>
        ) : null}
        {message ? (
          <Text className="text-[13px] font-medium mt-1 leading-[18px]" style={{ color: toneStyle.fg }}>
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
