import React, { useMemo, useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '@/components/ui';
import { JOB_STATUS, JOB_STATUS_LABELS, statusAccent } from '../../util/constants';
import { useDashboardStore } from '../../store/dashboardStore';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '@/components/ui/button';
import { radii, spacing, typography } from '../../theme/designSystem';

const STATUS_FILTERS = [JOB_STATUS.IN_PROGRESS, JOB_STATUS.CREATED, JOB_STATUS.COMPLETED, JOB_STATUS.PAUSED];
const filters = ['all', ...STATUS_FILTERS];

const FilterButton = React.memo(({ label, isActive, count, accent, colors, onPress }) => (
  <Button
    variant="outline"
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`Filter by ${label}, ${count} jobs`}
    accessibilityState={{ selected: isActive }}
    style={({ pressed }) => ({
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.xl,
      borderColor: isActive ? accent.border : colors.border,
      backgroundColor: isActive ? accent.badge : colors.surface,
      paddingHorizontal: spacing.md,
      minHeight: spacing.xl + spacing.sm,
      paddingVertical: spacing.xs,
      opacity: pressed ? 0.8 : 1,
      transform: [{ scale: pressed ? 0.98 : 1 }],
    })}
  >
    {isActive && (
      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent.dot }} />
    )}
    <Text
      style={{
        fontSize: typography.caption.fontSize,
        lineHeight: typography.caption.lineHeight,
        fontWeight: isActive ? '700' : '500',
        color: isActive ? accent.text : colors.textSecondary,
      }}
    >
      {label}
    </Text>
    <View
      className="rounded-lg px-2 py-0.5"
      style={{
        backgroundColor: isActive ? colors.surfaceAlt : colors.background,
      }}
    >
      <Text
        style={{
          ...typography.micro,
          color: isActive ? accent.text : colors.textMuted,
          fontVariant: ['tabular-nums'],
        }}
      >
        {count}
      </Text>
    </View>
  </Button>
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
              accent={isAll ? allAccent : statusAccent(colors, status)}
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
