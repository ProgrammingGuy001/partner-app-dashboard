import React, { useMemo } from "react";
import { View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui";
import { formatters } from "../../util/formatters";
import { useTheme } from "../../hooks/useTheme";

const getStatConfig = (colors, isInternal = false) => {
  const baseCards = [
    {
      key: "completedJobs",
      title: "Completed",
      icon: "checkmark-circle-outline",
      iconColor: colors.success,
      bgColor: colors.success + "15",
      format: (v) => String(v ?? 0),
    },
    {
      key: "inProgressJobs",
      title: "In Progress",
      icon: "time-outline",
      iconColor: colors.warning,
      bgColor: colors.warning + "15",
      format: (v) => String(v ?? 0),
    },
  ];

  // For external partners (is_internal=false): show Earnings only
  // For internal partners (is_internal=true): show only Incentives (no Earnings/Payout)
  if (!isInternal) {
    baseCards.push({
      key: "totalEarnings",
      title: "Earnings",
      icon: "wallet-outline",
      iconColor: colors.primary,
      bgColor: colors.primaryLight,
      format: formatters.currency,
    });
  } else {
    // Internal partners see only incentives, not earnings/payout
    baseCards.push({
      key: "totalIncentives",
      title: "Incentives",
      icon: "sparkles-outline",
      iconColor: colors.accent,
      bgColor: colors.accentLight,
      format: formatters.currency,
    });
  }

  return baseCards;
};

const StatItem = React.memo(({ config, value, colors, isLast }) => (
  <View
    className="flex-1 px-3 py-3.5"
    style={{
      minHeight: 84,
      borderRightWidth: isLast ? 0 : 1,
      borderRightColor: colors.border,
    }}
    accessible
    accessibilityLabel={`${config.title}: ${config.format(value)}`}
  >
    <View
      className="w-9 h-9 rounded-xl items-center justify-center mb-2"
      style={{ backgroundColor: config.bgColor }}
    >
      <Ionicons name={config.icon} size={18} color={config.iconColor} />
    </View>
    <Text
      className="text-[17px] font-extrabold text-foreground"
      style={{ fontVariant: ["tabular-nums"] }}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.82}
    >
      {config.format(value)}
    </Text>
    <Text
      className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5"
      numberOfLines={1}
    >
      {config.title}
    </Text>
  </View>
));

const StatsCards = ({ stats, isInternal = false }) => {
  const { colors } = useTheme();

  const STAT_CONFIG = useMemo(() => {
    const statConfig = getStatConfig(colors, isInternal);
    return statConfig;
  }, [colors, isInternal]);

  return (
    <View
      className="flex-row rounded-2xl border border-border bg-card mb-5 overflow-hidden"
      style={colors.shadowSm}
    >
      {STAT_CONFIG.map((config, index) => (
        <StatItem
          key={config.key}
          config={config}
          value={stats?.[config.key]}
          colors={colors}
          isLast={index === STAT_CONFIG.length - 1}
        />
      ))}
    </View>
  );
};

export default React.memo(StatsCards);
