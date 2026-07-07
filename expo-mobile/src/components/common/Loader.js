import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

const Loader = ({ text, fullScreen = false }) => {
  const { colors } = useTheme();

  return (
    <View
      className={`${fullScreen ? 'flex-1 bg-background' : 'py-6'} items-center justify-center gap-3`}
      accessibilityRole="progressbar"
      accessibilityLabel={text || 'Loading'}
    >
      <View className="h-14 w-14 rounded-2xl bg-primary-light items-center justify-center">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
      {text ? <Text className="text-sm font-medium text-muted-foreground">{text}</Text> : null}
    </View>
  );
};

export default Loader;
