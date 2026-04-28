import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text } from '@/components/ui';
import { ROUTES } from '../util/constants';

const NotFoundScreen = ({ navigation }) => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-5">
        <Text variant="h1" className="text-7xl font-extrabold text-accent">404</Text>
        <Text className="mt-2 text-3xl font-bold text-foreground font-heading">Page Not Found</Text>
        <Text className="mb-3 mt-2 text-center text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </Text>
        <Button onPress={() => navigation.navigate(ROUTES.MAIN_TABS)}><Text>Go to Dashboard</Text></Button>
      </View>
    </SafeAreaView>
  );
};

export default NotFoundScreen;
