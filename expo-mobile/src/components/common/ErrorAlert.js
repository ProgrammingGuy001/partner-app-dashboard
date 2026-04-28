import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import useChecklistStore from '../../store/checklistStore';

const ErrorAlert = ({ message }) => {
  const clearError = useChecklistStore((state) => state.clearError);

  return (
    <View className="flex-row items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <Ionicons name="alert-circle-outline" size={20} color="#B91C1C" />
      <View className="flex-1">
        <Text className="text-[13px] font-bold text-red-800">Error</Text>
        <Text className="mt-0.5 text-[13px] text-red-700">{message}</Text>
      </View>
      <Pressable onPress={clearError} className="p-1">
        <Ionicons name="close" size={18} color="#B91C1C" />
      </Pressable>
    </View>
  );
};

export default ErrorAlert;
