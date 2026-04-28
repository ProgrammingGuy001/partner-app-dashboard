import React from 'react';
import { Image, View } from 'react-native';
import { Text } from '@/components/ui/text';

const AuthHeader = ({ subtitle }) => {
  return (
    <View className="mb-5 items-center">
      <Image
        source={require('../../../assets/splash-icon.png')}
        className="mb-2 h-11 w-40"
        resizeMode="contain"
      />
      <Text variant="muted">{subtitle}</Text>
    </View>
  );
};

export default AuthHeader;
