import React from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import useChecklistStore from '../../store/checklistStore';
import { useTheme } from '../../hooks/useTheme';
import { typography } from '../../theme/designSystem';
import { IconButton } from './Primitives';

const ErrorAlert = ({ message }) => {
  const clearError = useChecklistStore((state) => state.clearError);
  const { colors } = useTheme();

  return (
    <View
      className="flex-row items-start gap-3 rounded-2xl border border-destructive bg-destructive-muted p-4"
      accessibilityRole="alert"
    >
      <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
      <View className="flex-1">
        <Text style={[typography.captionStrong, { color: colors.danger }]}>Error</Text>
        <Text style={[typography.caption, { color: colors.danger }]} className="mt-1">
          {message}
        </Text>
      </View>
      <IconButton
        icon="close"
        label="Dismiss error"
        tone="danger"
        onPress={clearError}
      />
    </View>
  );
};

export default ErrorAlert;
