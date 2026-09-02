import React from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui';
import { hitSlop, radii, typography } from '../../theme/designSystem';
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
  const { colors } = useTheme();
  const toneStyles = {
    neutral: {
      className: 'bg-surface border-border',
      color: colors.text,
    },
    primary: {
      className: 'bg-primary border-primary',
      color: colors.primaryForeground,
    },
    subtle: {
      className: 'bg-primary-light border-primary-light',
      color: colors.primary,
    },
    danger: {
      className: 'bg-destructive-muted border-destructive',
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
      className={`items-center justify-center border ${toneStyle.className} ${className}`}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radii.lg,
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
        <Text style={typography.caption} className="text-muted-foreground mt-1">
          {subtitle}
        </Text>
      ) : null}
    </View>
    {right ? <View>{right}</View> : null}
  </View>
);

export const StatusBadge = ({ label, tone = 'neutral', icon, className = '' }) => {
  const { colors } = useTheme();
  const tones = {
    neutral: { className: 'bg-surface-alt border-border', fg: colors.textSecondary },
    primary: { className: 'bg-primary-light border-primary', fg: colors.primary },
    success: { className: 'bg-success-muted border-success', fg: colors.success },
    warning: { className: 'bg-warning-muted border-warning', fg: colors.warning },
    danger: { className: 'bg-destructive-muted border-destructive', fg: colors.danger },
    info: { className: 'bg-info-muted border-info', fg: colors.info },
  };
  const toneStyle = tones[tone] || tones.neutral;

  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-xl border px-2.5 py-1.5 ${toneStyle.className} ${className}`}
      accessibilityRole="text"
    >
      {icon ? <Ionicons name={icon} size={13} color={toneStyle.fg} /> : null}
      <Text style={{ fontSize: typography.micro.fontSize, lineHeight: typography.micro.lineHeight, color: toneStyle.fg }} className="font-extrabold uppercase">
        {label}
      </Text>
    </View>
  );
};

export const Notice = ({ tone = 'info', title, message, icon, className = '' }) => {
  const { colors } = useTheme();
  const tones = {
    info: { className: 'bg-info-muted border-info', fg: colors.info, icon: icon || 'information-circle-outline' },
    success: { className: 'bg-success-muted border-success', fg: colors.success, icon: icon || 'checkmark-circle-outline' },
    warning: { className: 'bg-warning-muted border-warning', fg: colors.warning, icon: icon || 'warning-outline' },
    danger: { className: 'bg-destructive-muted border-destructive', fg: colors.danger, icon: icon || 'alert-circle-outline' },
  };
  const toneStyle = tones[tone] || tones.info;

  return (
    <View
      className={`flex-row items-start gap-3 rounded-2xl border p-4 ${toneStyle.className} ${className}`}
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : 'summary'}
    >
      <Ionicons name={toneStyle.icon} size={20} color={toneStyle.fg} />
      <View className="flex-1">
        {title ? (
          <Text className="text-sm font-extrabold" style={{ color: toneStyle.fg }}>
            {title}
          </Text>
        ) : null}
        {message ? (
          <Text style={[typography.caption, { color: toneStyle.fg }]} className="mt-1">
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
