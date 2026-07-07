import React, { useMemo } from "react";
import { Linking, Pressable, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui";
import { useAuthStore } from "../../store/authStore";
import { JOB_STATUS_LABELS } from "../../util/constants";
import { formatters } from "../../util/formatters";
import { useTheme } from "../../hooks/useTheme";
import { StatusBadge } from "../common/Primitives";

const Row = ({ icon, label, value, pressable, colors, isLast }) => {
  const content = (
    <View
      className="flex-row items-center gap-3 px-4 py-3.5"
      style={{
        minHeight: 58,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View className="w-8 h-8 rounded-lg bg-primary-light items-center justify-center">
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-[11px] font-bold text-muted-foreground uppercase">
          {label}
        </Text>
        <Text
          className={`text-[15px] font-semibold mt-0.5 ${
            pressable ? "text-primary" : "text-foreground"
          }`}
        >
          {value || "N/A"}
        </Text>
      </View>
      {pressable && (
        <Ionicons name="open-outline" size={16} color={colors.primary} />
      )}
    </View>
  );

  if (!pressable) return content;
  return (
    <Pressable
      onPress={pressable}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.primaryLight : "transparent",
      })}
    >
      {content}
    </Pressable>
  );
};

const JobDetails = ({ job }) => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const statusTone =
    job.status === "completed"
      ? "success"
      : job.status === "in_progress" || job.status === "paused"
        ? "warning"
        : "neutral";
  const address = useMemo(
    () =>
      [
        job.address_line_1,
        job.address_line_2,
        [job.city, job.state].filter(Boolean).join(", "),
        job.pincode,
      ]
        .filter(Boolean)
        .join("\n"),
    [job.address_line_1, job.address_line_2, job.city, job.state, job.pincode],
  );
  const rows = useMemo(
    () =>
      [
        { icon: "construct-outline", label: "Job Type", value: job.type },
        { icon: "location-outline", label: "Address", value: address },
        { icon: "expand-outline", label: "Job Size", value: job.size },
        !user?.is_internal && {
          icon: "wallet-outline",
          label: "Earnings",
          value: formatters.currency(job.rate),
        },
        {
          icon: "calendar-outline",
          label: "Timeline",
          value: `${formatters.date(job.start_date)} - ${formatters.date(job.delivery_date)}`,
        },
        job.google_map_link && {
          icon: "map-outline",
          label: "Site Location",
          value: "View on Google Maps",
          pressable: () => Linking.openURL(job.google_map_link),
        },
      ].filter(Boolean),
    [address, job, user?.is_internal],
  );

  return (
    <View className="gap-4">
      <View
        className="bg-surface p-5 rounded-2xl border border-border"
        style={colors.shadowSm}
      >
        <View className="flex-row justify-between items-start gap-3">
          <Text className="flex-1 text-[22px] font-extrabold text-foreground leading-[28px]">
            {job.name}
          </Text>
          <StatusBadge
            label={JOB_STATUS_LABELS[job.status] || job.status}
            tone={statusTone}
          />
        </View>

        {job.description ? (
          <Text className="text-sm text-muted-foreground leading-[22px] mt-3">
            {job.description}
          </Text>
        ) : null}
      </View>

      <View
        className="rounded-2xl border border-border bg-surface overflow-hidden"
        style={colors.shadowSm}
      >
        <View className="px-4 pt-4 pb-3 border-b border-border">
          <Text className="text-xs font-extrabold uppercase text-muted-foreground">
            Job Information
          </Text>
        </View>
        {rows.map((row, index) => (
          <Row
            key={row.label}
            icon={row.icon}
            label={row.label}
            value={row.value}
            pressable={row.pressable}
            colors={colors}
            isLast={index === rows.length - 1}
          />
        ))}
      </View>
    </View>
  );
};

export default React.memo(JobDetails);
