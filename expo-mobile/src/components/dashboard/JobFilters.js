import React, { useMemo, useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui';
import { JOB_STATUS, JOB_STATUS_ACCENT, JOB_STATUS_LABELS } from '../../util/constants';
import { useDashboardStore } from '../../store/dashboardStore';
import { useTheme } from '../../hooks/useTheme';

const STATUS_FILTERS = [JOB_STATUS.IN_PROGRESS, JOB_STATUS.CREATED, JOB_STATUS.COMPLETED, JOB_STATUS.PAUSED];
const filters = ['all', ...STATUS_FILTERS];

const FilterButton = React.memo(({ label, isActive, count, accent, colors, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`Filter by ${label}, ${count} jobs`}
    accessibilityState={{ selected: isActive }}
    style={({ pressed }) => ({
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 20,
      borderWidth: isActive ? 1.5 : 1,
      borderColor: isActive ? accent.border : colors.border,
      backgroundColor: isActive ? accent.badge : colors.surface,
      paddingHorizontal: 14,
      minHeight: 44,
      paddingVertical: 9,
      opacity: pressed ? 0.8 : 1,
      transform: [{ scale: pressed ? 0.98 : 1 }],
    })}
  >
    {isActive && (
      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent.dot }} />
    )}
    <Text
      style={{
        fontSize: 13,
        fontWeight: isActive ? '700' : '500',
        color: isActive ? accent.text : colors.textSecondary,
      }}
    >
      {label}
    </Text>
    <View
      className="rounded-[10px] px-[7px] py-0.5"
      style={{
        backgroundColor: isActive ? accent.border + '33' : colors.background,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: isActive ? accent.text : colors.textMuted,
          fontVariant: ['tabular-nums'],
        }}
      >
        {count}
      </Text>
    </View>
  </Pressable>
));

const JobFilters = () => {
  const { activeFilter, setActiveFilter, jobs } = useDashboardStore();
  const { colors } = useTheme();

  const filterCounts = useMemo(() => {
    const counts = {};
    STATUS_FILTERS.forEach((status) => {
      counts[status] = jobs.filter((job) => job.status === status).length;
    });
    return counts;
  }, [jobs]);

  const handleFilterPress = useCallback((status) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveFilter(status);
  }, [setActiveFilter]);

  // Neutral accent for the "All" chip — uses the brand primary
  const allAccent = useMemo(() => ({
    border: colors.primary,
    badge: colors.primaryLight,
    text: colors.primary,
    dot: colors.primary,
  }), [colors]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-3"
      contentContainerStyle={{ paddingRight: 4 }}
    >
      <View className="flex-row gap-2 pb-0.5">
        {filters.map((status) => {
          const isAll = status === 'all';
          return (
            <FilterButton
              key={status}
              label={isAll ? 'All' : JOB_STATUS_LABELS[status]}
              isActive={activeFilter === status}
              count={isAll ? jobs.length : filterCounts[status]}
              accent={isAll ? allAccent : JOB_STATUS_ACCENT[status]}
              colors={colors}
              onPress={() => handleFilterPress(status)}
            />
          );
        })}
      </View>
    </ScrollView>
  );
};

export default React.memo(JobFilters);
