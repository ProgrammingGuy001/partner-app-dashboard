import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '@/components/ui/button';

const ChecklistHeader = ({ checklistName, checklistDescription, onBack }) => {
  const { colors } = useTheme();
  return (
    <View className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <Button variant="ghost" size="sm" onPress={onBack} className="mb-2 h-auto self-start px-0">
        <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
        <Text className="text-xs text-muted-foreground">Back to Job</Text>
      </Button>

      <Text className="text-xs uppercase text-muted-foreground">Checklist</Text>
      <Text className="mt-1 text-xl font-bold text-foreground font-heading">{checklistName}</Text>
      {checklistDescription ? <Text className="mt-1.5 text-xs text-muted-foreground">{checklistDescription}</Text> : null}
    </View>
  );
};

export default ChecklistHeader;
