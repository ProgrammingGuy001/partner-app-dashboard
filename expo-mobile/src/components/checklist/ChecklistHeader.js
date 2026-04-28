import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import Ionicons from '@react-native-vector-icons/ionicons';

const ChecklistHeader = ({ checklistName, checklistDescription, onBack }) => {
  return (
    <View className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <Pressable onPress={onBack} className="mb-2 flex-row items-center gap-1.5 self-start">
        <Ionicons name="arrow-back" size={16} color="#7c685f" />
        <Text className="text-xs text-muted-foreground">Back to Job</Text>
      </Pressable>

      <Text className="text-[11px] uppercase tracking-widest text-muted-foreground">Checklist</Text>
      <Text className="mt-1 text-xl font-bold text-foreground font-heading">{checklistName}</Text>
      {checklistDescription ? <Text className="mt-1.5 text-xs text-muted-foreground">{checklistDescription}</Text> : null}
    </View>
  );
};

export default ChecklistHeader;
