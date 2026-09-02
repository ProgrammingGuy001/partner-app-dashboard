import React from 'react';
import { View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui';
import useChecklistStore from '../../store/checklistStore';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../common/Primitives';
import { typography } from '../../theme/designSystem';

const ChecklistStats = () => {
  const stats = useChecklistStore((state) => state.stats);
  const { colors } = useTheme();
  const pct = stats.completionPercentage ?? 0;

  const STAT_CHIPS = [
    { key: 'totalItems',    label: 'Total',        icon: 'list-outline',             color: colors.textMuted, bg: colors.background },
    { key: 'checkedCount',  label: 'Checked',      icon: 'checkbox-outline',         color: colors.info,      bg: colors.surfaceAlt },
    { key: 'pendingCount',  label: 'Under Review', icon: 'time-outline',             color: colors.warning,   bg: colors.surfaceAlt },
    { key: 'approvedCount', label: 'Approved',     icon: 'checkmark-circle-outline', color: colors.success,   bg: colors.surfaceAlt },
  ];

  const barColor = pct >= 100 ? colors.success : pct >= 50 ? colors.primary : colors.warning;

  return (
    <View className="mt-3 gap-4">
      {/* Progress card */}
      <Card elevated>
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-base font-extrabold text-foreground">Completion Progress</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              {stats.approvedCount} of {stats.totalItems} items approved
            </Text>
          </View>
          <View className="items-end">
            <Text style={[typography.title1, { color: barColor }]}>{pct}%</Text>
          </View>
        </View>
        {/* Track */}
        <View className="h-2.5 overflow-hidden rounded-full border border-border bg-background">
          <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </View>
      </Card>

      {/* Stat chips row */}
      <View className="gap-3">
        {[STAT_CHIPS.slice(0, 2), STAT_CHIPS.slice(2)].map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row gap-3">
            {row.map((chip) => (
              <Card key={chip.key} className="flex-1 flex-row items-center gap-3 p-3">
                <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: chip.bg }}>
                  <Ionicons name={chip.icon} size={18} color={chip.color} />
                </View>
                <View>
                  <Text className="text-xl font-extrabold text-foreground leading-6">{stats[chip.key] ?? 0}</Text>
                  <Text className="text-xs font-bold text-muted-foreground uppercase">{chip.label}</Text>
                </View>
              </Card>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

export default ChecklistStats;
