import React from "react";
import { Linking, Pressable, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui";
import { useAuthStore } from "../../store/authStore";
import {
  JOB_STATUS_ACCENT,
  JOB_STATUS_LABELS,
} from "../../util/constants";
import { formatters } from "../../util/formatters";
import { useTheme } from "../../hooks/useTheme";

const Row = ({ icon, label, value, pressable, colors }) => {
  const content = (
    <View
      className="flex-row items-center gap-3 bg-card p-4 rounded-2xl border border-border"
      style={colors.shadowSm}
    >
      <View className="w-8 h-8 rounded-lg bg-primary-light items-center justify-center">
        <Ionicons name={icon} size={16} color="#5a3d35" />
      </View>
      <View className="flex-1">
        <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
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
        <Ionicons name="open-outline" size={16} color="#5a3d35" />
      )}
    </View>
  );

  if (!pressable) return content;
  return <Pressable onPress={pressable}>{content}</Pressable>;
};

const JobDetails = ({ job }) => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const accent = JOB_STATUS_ACCENT[job.status] ?? JOB_STATUS_ACCENT.created;

  return (
    <View className="gap-6">
      {/* Title & Status Card */}
      <View
        className="bg-card p-6 rounded-3xl border border-border"
        style={colors.shadowMd}
      >
        <View className="flex-row justify-between items-start mb-4">
          <Text className="flex-1 text-2xl font-extrabold text-foreground tracking-tight">
            {job.name}
          </Text>
          <View
            style={{
              backgroundColor: accent.badge,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: accent.border + "33",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: accent.text,
                textTransform: "uppercase",
              }}
            >
              {JOB_STATUS_LABELS[job.status] || job.status}
            </Text>
          </View>
        </View>

        {job.description ? (
          <Text className="text-sm text-muted-foreground leading-[22px]">
            {job.description}
          </Text>
        ) : null}
      </View>

      {/* Details Grid */}
      <View className="gap-3">
        <Row icon="construct-outline" label="Job Type" value={job.type} colors={colors} />
        <Row 
          icon="location-outline" 
          label="Address" 
          value={[
            job.address_line_1,
            job.address_line_2,
            [job.city, job.state].filter(Boolean).join(', '),
            job.pincode
          ].filter(Boolean).join('\n')} 
          colors={colors} 
        />
        <Row icon="expand-outline" label="Job Size" value={job.size} colors={colors} />
        {!user?.is_internal && (
          <Row
            icon="wallet-outline"
            label="Earnings"
            value={formatters.currency(job.rate)}
            colors={colors}
          />
        )}
        <Row
          icon="calendar-outline"
          label="Timeline"
          value={`${formatters.date(job.start_date)} - ${formatters.date(job.delivery_date)}`}
          colors={colors}
        />
        {job.google_map_link && (
          <Row
            icon="map-outline"
            label="Site Location"
            value="View on Google Maps"
            pressable={() => Linking.openURL(job.google_map_link)}
            colors={colors}
          />
        )}
      </View>
    </View>
  );
};

export default React.memo(JobDetails);
