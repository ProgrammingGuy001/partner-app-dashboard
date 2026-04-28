import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

const Loader = ({ text, fullScreen = false }) => {
  return (
    <View className={`${fullScreen ? 'flex-1 bg-background' : 'py-6'} items-center justify-center gap-2.5`}>
      <ActivityIndicator size="large" color="#6b4b41" />
      {text ? <Text className="text-sm text-muted-foreground">{text}</Text> : null}
    </View>
  );
};

export default Loader;
