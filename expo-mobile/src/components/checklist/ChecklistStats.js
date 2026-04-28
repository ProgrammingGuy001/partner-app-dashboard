import React from 'react';
import { View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui';
import useChecklistStore from '../../store/checklistStore';
import { useTheme } from '../../hooks/useTheme';

const ChecklistStats = () => {
  const stats = useChecklistStore((state) => state.stats);
  const { colors } = useTheme();
  const pct = stats.completionPercentage ?? 0;

  const STAT_CHIPS = [
    { key: 'totalItems',    label: 'Total',        icon: 'list-outline',             color: colors.textMuted, bg: colors.background },
    { key: 'checkedCount',  label: 'Checked',      icon: 'checkbox-outline',         color: colors.info,      bg: colors.info + '15' },
    { key: 'pendingCount',  label: 'Under Review',  icon: 'time-outline',            color: colors.warning,   bg: colors.warning + '15' },
    { key: 'approvedCount', label: 'Approved',     icon: 'checkmark-circle-outline',  color: colors.success,  bg: colors.success + '15' },
  ];

  const barColor = pct >= 100 ? colors.success : pct >= 50 ? colors.primary : colors.warning;

  return (
    <View className="mt-3 gap-4">
      {/* Progress card */}
      <View className="rounded-3xl border border-border bg-card p-5" style={colors.shadowMd}>
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-base font-extrabold text-foreground">Completion Progress</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              {stats.approvedCount} of {stats.totalItems} items approved
            </Text>
          </View>
          <View className="items-end">
            <Text style={{ fontSize: 24, fontWeight: '900', color: barColor, letterSpacing: -1 }}>{pct}%</Text>
          </View>
        </View>
        {/* Track */}
        <View className="h-2.5 bg-background rounded-[5px] overflow-hidden border border-border">
          <View style={{ height: 10, width: `${pct}%`, backgroundColor: barColor, borderRadius: 5 }} />
        </View>
      </View>

      {/* Stat chips row */}
      <View className="flex-row gap-3 flex-wrap">
        {STAT_CHIPS.map((chip) => (
          <View
            key={chip.key}
            className="flex-1 min-w-[45%] flex-row items-center gap-3 rounded-[20px] border border-border bg-card p-3.5"
            style={colors.shadowSm}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: chip.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={chip.icon} size={18} color={chip.color} />
            </View>
            <View>
              <Text className="text-xl font-extrabold text-foreground leading-6">
                {stats[chip.key] ?? 0}
              </Text>
              <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{chip.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default ChecklistStats;
