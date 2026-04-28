import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import './src/global.css';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { ToastProvider } from './src/context/ToastContext';
import AppNavigator from './src/navigation/AppNavigator';
import OfflineBanner from './src/components/common/OfflineBanner';
import { useTheme } from './src/hooks/useTheme';

export default function App() {
  const { colors, isDark } = useTheme();

  // Sync Android/iOS system UI chrome with the active theme background
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    // Apply NativeWind `dark` class at root — activates all dark: variants throughout the tree
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <View className={`flex-1${isDark ? ' dark' : ''}`} style={{ backgroundColor: colors.background }}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <OfflineBanner />
            <ToastProvider>
              <AppNavigator />
              <PortalHost />
            </ToastProvider>
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
