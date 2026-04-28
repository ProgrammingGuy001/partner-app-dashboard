import React from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';
import { useOTAUpdates } from '../../hooks/useOTAUpdates';
import { useTheme } from '../../hooks/useTheme';

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
            style={{ backgroundColor: colors.primary + '15' }}
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

        <TouchableOpacity
          onPress={handleCheckUpdate}
          disabled={isChecking || isDownloading}
          className="px-4 py-2 rounded-lg"
          style={{
            backgroundColor: isUpdateAvailable ? colors.success : colors.primary,
            opacity: isChecking || isDownloading ? 0.6 : 1,
          }}
        >
          {isChecking || isDownloading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-xs font-bold text-white">
              {isUpdateAvailable ? 'Update Now' : 'Check'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default UpdateChecker;
