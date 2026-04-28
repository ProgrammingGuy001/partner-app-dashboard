import React, { useCallback } from "react";
import { Platform, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui";
import { useAuthStore } from "../../store/authStore";
import {
  JOB_STATUS_ACCENT,
  JOB_STATUS_LABELS,
} from "../../util/constants";
import { formatters } from "../../util/formatters";
import { useTheme } from "../../hooks/useTheme";

const JobCard = ({ job, onPress }) => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  
  const accent = React.useMemo(() => 
    JOB_STATUS_ACCENT[job.status] ?? JOB_STATUS_ACCENT.created
  , [job.status]);

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress?.();
  }, [onPress]);

  const badgeStyle = React.useMemo(() => ({
    backgroundColor: accent.badge,
    borderWidth: 1,
    borderColor: accent.border + "33",
  }), [accent]);

  return (
    <Pressable
      onPress={handlePress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Job: ${job.name}, Status: ${JOB_STATUS_LABELS[job.status] || job.status}`}
      accessibilityHint="Double tap to view job details"
      style={({ pressed }) => ({
        opacity: pressed ? 0.96 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        className="rounded-[20px] border border-border bg-card overflow-hidden mb-3"
        style={colors.shadowSm}
      >
        <View className="p-4">
          {/* Top row: title + status badge */}
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1 mr-3">
              <Text className="text-base font-bold text-foreground leading-[22px] tracking-tight">
                {job.name}
              </Text>
            </View>
            <View
              className="flex-row items-center gap-[5px] rounded-xl px-2.5 py-[5px]"
              style={badgeStyle}
            >
              <View
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: accent.dot }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: accent.text,
                  textTransform: "uppercase",
                  letterSpacing: 0.2,
                }}
              >
                {JOB_STATUS_LABELS[job.status] || job.status}
              </Text>
            </View>
          </View>

          {/* Info Section */}
          <View className="flex-row gap-4 mb-4">
            <View className="flex-1 gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <View className="w-[22px] h-[22px] rounded-md bg-primary-light items-center justify-center">
                  <Ionicons name="person-outline" size={12} color="#5a3d35" />
                </View>
                <Text className="text-[13px] text-muted-foreground font-medium" numberOfLines={1}>
                  {job.customer_name || "N/A"}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="w-[22px] h-[22px] rounded-md bg-primary-light items-center justify-center">
                  <Ionicons name="location-outline" size={12} color="#5a3d35" />
                </View>
                <Text className="text-[13px] text-muted-foreground font-medium" numberOfLines={1}>
                  {job.city || "N/A"}
                </Text>
              </View>
            </View>
            <View className="w-px h-full bg-border opacity-50" />
            <View className="flex-[0.8] gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <View className="w-[22px] h-[22px] rounded-md bg-primary-light items-center justify-center">
                  <Ionicons name="calendar-outline" size={12} color="#5a3d35" />
                </View>
                <Text className="text-[13px] text-muted-foreground font-medium">
                  {formatters.date(job.delivery_date)}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="w-[22px] h-[22px] rounded-md bg-primary-light items-center justify-center">
                  <Ionicons name="barcode-outline" size={12} color="#5a3d35" />
                </View>
                <Text className="text-[13px] text-muted-foreground font-medium">
                  #{job.id?.toString().slice(-4)}
                </Text>
              </View>
            </View>
          </View>

          {/* Action/Rate Row */}
          <View className="flex-row items-center justify-between pt-3 border-t border-border">
            {!user?.is_internal ? (
              <View>
                <Text className="text-[11px] font-semibold text-muted-foreground uppercase mb-0.5">
                  EST. EARNINGS
                </Text>
                <Text className="text-lg font-extrabold text-foreground tracking-tight">
                  {formatters.currency(job.rate)}
                </Text>
              </View>
            ) : (
              <View />
            )}
            <View className="flex-row items-center gap-1.5 bg-primary px-3 py-2 rounded-xl">
              <Text className="text-white text-[13px] font-bold">
                Details
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default React.memo(JobCard);
