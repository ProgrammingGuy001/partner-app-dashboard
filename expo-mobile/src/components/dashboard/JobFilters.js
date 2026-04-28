import React, { useMemo, useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui';
import { JOB_STATUS, JOB_STATUS_ACCENT, JOB_STATUS_LABELS } from '../../util/constants';
import { useDashboardStore } from '../../store/dashboardStore';
import { useTheme } from '../../hooks/useTheme';

const filters = [JOB_STATUS.IN_PROGRESS, JOB_STATUS.CREATED, JOB_STATUS.COMPLETED, JOB_STATUS.PAUSED];

const FilterButton = React.memo(({ status, isActive, count, accent, colors, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`Filter by ${JOB_STATUS_LABELS[status]}, ${count} jobs`}
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
      paddingVertical: 8,
      opacity: pressed ? 0.8 : 1,
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
      {JOB_STATUS_LABELS[status]}
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
    filters.forEach((status) => {
      counts[status] = jobs.filter((job) => job.status === status).length;
    });
    return counts;
  }, [jobs]);

  const handleFilterPress = useCallback((status) => {
    setActiveFilter(status);
  }, [setActiveFilter]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
      <View className="flex-row gap-2 pb-0.5">
        {filters.map((status) => (
          <FilterButton
            key={status}
            status={status}
            isActive={activeFilter === status}
            count={filterCounts[status]}
            accent={JOB_STATUS_ACCENT[status]}
            colors={colors}
            onPress={() => handleFilterPress(status)}
          />
        ))}
      </View>
    </ScrollView>
  );
};

export default React.memo(JobFilters);
