import React, { useMemo } from 'react';
import { View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui';
import { formatters } from '../../util/formatters';
import { useResponsive } from '../../hooks/useResponsive';
import { useTheme } from '../../hooks/useTheme';

const getStatConfig = (colors, isInternal = false) => {
  const baseCards = [
    {
      key: 'completedJobs',
      title: 'Completed',
      icon: 'checkmark-circle-outline',
      iconColor: colors.success,
      bgColor: colors.success + '15',
      format: (v) => String(v ?? 0),
    },
    {
      key: 'inProgressJobs',
      title: 'In Progress',
      icon: 'time-outline',
      iconColor: colors.warning,
      bgColor: colors.warning + '15',
      format: (v) => String(v ?? 0),
    },
  ];

  // For external partners (is_internal=false): show Earnings only 
  // For internal partners (is_internal=true): show only Incentives (no Earnings/Payout)
  if (!isInternal) {
    baseCards.push(
      {
        key: 'totalEarnings',
        title: 'Earnings',
        icon: 'wallet-outline',
        iconColor: colors.info,
        bgColor: colors.info + '15',
        format: formatters.currency,
      }
    );
  } else {
    // Internal partners see only incentives, not earnings/payout
    baseCards.push({
      key: 'totalIncentives',
      title: 'Incentives',
      icon: 'sparkles-outline',
      iconColor: '#7c3aed',
      bgColor: '#7c3aed15',
      format: formatters.currency,
    });
  }

  return baseCards;
};

const StatCard = React.memo(({ config, value, cardWidth, colors }) => (
  <View
    className="rounded-[20px] border border-border bg-card p-4"
    style={{ width: cardWidth, ...colors.shadowSm }}
  >
    <View
      className="w-9 h-9 rounded-[10px] items-center justify-center mb-2.5"
      style={{ backgroundColor: config.bgColor }}
    >
      <Ionicons name={config.icon} size={18} color={config.iconColor} />
    </View>
    <View>
      <Text className="text-lg font-extrabold text-foreground tracking-tight mb-px">
        {config.format(value)}
      </Text>
      <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        {config.title}
      </Text>
    </View>
  </View>
));

const StatsCards = ({ stats, isInternal = false }) => {
  const { width, px, gap } = useResponsive();
  const { colors } = useTheme();
  
  const { cardWidth, STAT_CONFIG } = useMemo(() => {
    const statConfig = getStatConfig(colors, isInternal);
    const cols = 2;
    const totalGaps = (cols - 1) * gap;
    const cardWidth = (width - px * 2 - totalGaps) / cols;
    return { cardWidth, STAT_CONFIG: statConfig };
  }, [gap, width, px, colors, isInternal]);

  return (
    <View className="flex-row flex-wrap mb-5" style={{ gap }}>
      {STAT_CONFIG.map((config) => (
        <StatCard
          key={config.key}
          config={config}
          value={stats?.[config.key]}
          cardWidth={cardWidth}
          colors={colors}
        />
      ))}
    </View>
  );
};

export default React.memo(StatsCards);
