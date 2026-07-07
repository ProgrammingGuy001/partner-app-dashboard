import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import useChecklistStore from '../../store/checklistStore';
import { useTheme } from '../../hooks/useTheme';

const ErrorAlert = ({ message }) => {
  const clearError = useChecklistStore((state) => state.clearError);
  const { colors } = useTheme();

  return (
    <View
      className="flex-row items-start gap-3 rounded-2xl border p-4"
      style={{ backgroundColor: colors.danger + '12', borderColor: colors.danger + '30' }}
      accessibilityRole="alert"
    >
      <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
      <View className="flex-1">
        <Text style={{ color: colors.danger }} className="text-[13px] font-bold">Error</Text>
        <Text style={{ color: colors.danger }} className="mt-1 text-[13px] font-medium leading-[18px]">
          {message}
        </Text>
      </View>
      <Pressable
        onPress={clearError}
        className="h-9 w-9 items-center justify-center rounded-xl"
        accessibilityRole="button"
        accessibilityLabel="Dismiss error"
      >
        <Ionicons name="close" size={18} color={colors.danger} />
      </Pressable>
    </View>
  );
};

export default ErrorAlert;
