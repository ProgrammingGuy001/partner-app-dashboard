import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';
import { useOTAUpdates } from '../../hooks/useOTAUpdates';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '@/components/ui/button';

const UpdateChecker = () => {
  const { colors } = useTheme();
  const {
    isChecking,
    isDownloading,
    isUpdateAvailable,
    error,
    checkAndApplyUpdate,
  } = useOTAUpdates();

  const handleCheckUpdate = async () => {
    await checkAndApplyUpdate();
  };

  // Don't show in development
  if (__DEV__) {
    return null;
  }

  return (
    <View className="px-4 py-3 bg-card rounded-2xl border border-border" style={colors.shadowSm}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-3">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: colors.primaryLight }}
          >
            <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-foreground mb-0.5">
              App Updates
            </Text>
            <Text className="text-xs text-muted-foreground">
              {isChecking
                ? 'Checking for updates...'
                : isDownloading
                ? 'Downloading update...'
                : isUpdateAvailable
                ? 'Update available!'
                : error
                ? error
                : 'Check for new features'}
            </Text>
          </View>
        </View>

        <Button
          variant={isUpdateAvailable ? 'default' : 'outline'}
          size="sm"
          onPress={handleCheckUpdate}
          disabled={isChecking || isDownloading}
          accessibilityRole="button"
          accessibilityLabel={isUpdateAvailable ? 'Update app now' : 'Check for app updates'}
          accessibilityState={{ disabled: isChecking || isDownloading, busy: isChecking || isDownloading }}
        >
          {isChecking || isDownloading ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text className="text-xs font-bold" style={{ color: colors.primaryForeground }}>
              {isUpdateAvailable ? 'Update Now' : 'Check'}
            </Text>
          )}
        </Button>
      </View>
    </View>
  );
};

export default UpdateChecker;
