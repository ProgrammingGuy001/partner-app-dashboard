import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

const variantClasses = {
  primary: {
    container: 'bg-primary',
    text: 'text-primary-foreground',
    loader: '#fbfaf8',
  },
  secondary: {
    container: 'bg-secondary',
    text: 'text-secondary-foreground',
    loader: '#3a1a1a',
  },
  danger: {
    container: 'bg-destructive',
    text: 'text-destructive-foreground',
    loader: '#fbfaf8',
  },
  outline: {
    container: 'border border-primary bg-card',
    text: 'text-primary',
    loader: '#6b4b41',
  },
  ghost: {
    container: 'bg-secondary/80',
    text: 'text-foreground',
    loader: '#3a1a1a',
  },
};

const sizeClasses = {
  sm: {
    container: 'px-3 py-2 rounded-lg',
    text: 'text-sm',
  },
  md: {
    container: 'px-4 py-2.5 rounded-xl',
    text: 'text-base',
  },
  lg: {
    container: 'px-5 py-3 rounded-xl',
    text: 'text-base',
  },
};

const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  style,
  textStyle,
  children,
  onPress,
}) => {
  const variantStyle = variantClasses[variant] || variantClasses.primary;
  const sizeStyle = sizeClasses[size] || sizeClasses.md;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`items-center justify-center ${variantStyle.container} ${sizeStyle.container} ${fullWidth ? 'w-full' : ''} ${(disabled || loading) ? 'opacity-60' : 'active:opacity-85'} ${className}`}
      style={style}
    >
      {loading ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color={variantStyle.loader} />
          <Text className={`font-semibold ${variantStyle.text} ${sizeStyle.text}`} style={textStyle}>
            Loading...
          </Text>
        </View>
      ) : (
        <Text className={`font-semibold ${variantStyle.text} ${sizeStyle.text}`} style={textStyle}>
          {children}
        </Text>
      )}
    </Pressable>
  );
};

export default Button;
