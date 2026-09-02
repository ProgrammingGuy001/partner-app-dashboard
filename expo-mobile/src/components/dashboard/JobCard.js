import React, { useCallback } from "react";
import { View } from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui";
import { useAuthStore } from "../../store/authStore";
import { JOB_STATUS_LABELS, statusAccent } from "../../util/constants";
import { formatters } from "../../util/formatters";
import { useTheme } from "../../hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Card } from "../common/Primitives";
import { spacing, typography } from "../../theme/designSystem";

const JobCard = ({ job, onPress }) => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);

  const accent = React.useMemo(
    () => statusAccent(colors, job.status),
    [colors, job.status],
  );

  const handlePress = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onPress?.();
  }, [onPress]);

  const badgeStyle = React.useMemo(
    () => ({
      backgroundColor: accent.badge,
      borderWidth: 1,
      borderColor: accent.border,
    }),
    [accent],
  );

  return (
    <Button
      variant="ghost"
      className="h-auto w-full p-0"
      onPress={handlePress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Job: ${job.name}, Status: ${JOB_STATUS_LABELS[job.status] || job.status}`}
      accessibilityHint="Double tap to view job details"
      accessibilityValue={{ text: JOB_STATUS_LABELS[job.status] || job.status }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.96 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <Card padded={false} className="mb-2.5 w-full overflow-hidden">
        <View className="p-4 gap-3">
          <View className="flex-row items-start gap-3">
            <View className="flex-1 gap-1">
              <Text
                className="text-base font-extrabold text-foreground"
                style={{ lineHeight: (typography.callout.lineHeight + typography.body.lineHeight) / 2 }}
                numberOfLines={2}
              >
                {job.name}
              </Text>
              <Text
                style={typography.caption}
                className="text-muted-foreground"
                numberOfLines={1}
              >
                {[job.customer_name, job.city].filter(Boolean).join(" · ") ||
                  "Customer details pending"}
              </Text>
            </View>
            <View className="h-9 w-9 rounded-xl bg-primary-light items-center justify-center">
              <Ionicons
                name="chevron-forward"
                size={17}
                color={colors.primary}
              />
            </View>
          </View>

          <View className="flex-row flex-wrap items-center gap-2">
            <View
              className="flex-row items-center gap-1 rounded-xl px-2.5 py-1"
              style={badgeStyle}
            >
              <View
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: accent.dot }}
              />
              <Text
                style={{
                  fontSize: typography.micro.fontSize,
                  lineHeight: typography.micro.lineHeight,
                  color: accent.text,
                  textTransform: "uppercase",
                  letterSpacing: 0,
                }}
              >
                {JOB_STATUS_LABELS[job.status] || job.status}
              </Text>
            </View>

            <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-alt px-2.5 py-1">
              <Ionicons
                name="calendar-outline"
                size={12}
                color={colors.textMuted}
              />
              <Text
                className="text-xs font-semibold text-muted-foreground"
                numberOfLines={1}
              >
                {formatters.date(job.delivery_date)}
              </Text>
            </View>

            <View className="rounded-xl bg-surface-alt px-2.5 py-1">
              <Text className="text-xs font-semibold text-muted-foreground">
                #{job.id?.toString().slice(-4)}
              </Text>
            </View>

            {user?.is_internal ? null : (
              <View className="flex-row items-center gap-1.5 rounded-xl bg-primary-light px-2.5 py-1">
                <Ionicons
                  name="wallet-outline"
                  size={12}
                  color={colors.primary}
                />
                <Text
                  className="text-xs font-extrabold text-primary"
                  style={{ fontVariant: ["tabular-nums"] }}
                  numberOfLines={1}
                >
                  {formatters.currency(job.rate)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Card>
    </Button>
  );
};

export default React.memo(JobCard);
