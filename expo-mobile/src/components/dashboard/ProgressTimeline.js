import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';
import { formatters } from '../../util/formatters';
import { useTheme } from '../../hooks/useTheme';

const ProgressTimeline = ({ progress }) => {
  const { colors } = useTheme();
  const filtered = (progress || []).filter(Boolean);

  if (!filtered.length) {
    return (
      <View 
        className="bg-surface rounded-2xl p-5 border border-border"
        style={colors.shadowSm}
      >
        <Text className="text-base font-extrabold text-foreground tracking-tight mb-4">Progress History</Text>
        <View className="items-center gap-2 py-4">
          <Ionicons name="time-outline" size={36} color="#d8cfca" />
          <Text className="text-sm font-semibold text-muted-foreground">No progress uploaded yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View 
      className="bg-surface rounded-2xl p-5 border border-border"
      style={colors.shadowSm}
    >
      <Text className="text-base font-extrabold text-foreground tracking-tight mb-5">Progress History</Text>
      <View className="gap-3">
        {filtered.map((item) => (
          <View key={item.id} className="flex-row gap-3">
            <View className="mt-2 w-2.5 h-2.5 rounded-full bg-primary" />
            <View className="flex-1 rounded-xl border border-border bg-background p-3.5">
              <Text className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{formatters.dateTime(item.uploaded_at)}</Text>
              {item.comment ? (
                <Text className="mt-1.5 text-sm font-medium text-foreground">{item.comment}</Text>
              ) : null}
              {item.doc_link ? (
                <Pressable
                  onPress={() => Linking.openURL(item.doc_link)}
                  className="mt-3 flex-row items-center gap-1.5"
                >
                  <Ionicons name="document-outline" size={14} color={colors.primary} />
                  <Text className="text-xs font-bold text-primary">View Attachment</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default ProgressTimeline;
