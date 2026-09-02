import React, { useMemo } from "react";
import { Linking, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui";
import { useAuthStore } from "../../store/authStore";
import { JOB_STATUS_LABELS } from "../../util/constants";
import { formatters } from "../../util/formatters";
import { useTheme } from "../../hooks/useTheme";
import { Card, StatusBadge } from "../common/Primitives";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "../../theme/designSystem";

const Row = ({ icon, label, value, pressable, colors, isLast }) => {
  const content = (
    <View
      className="flex-row items-center gap-3 px-4 py-3.5"
      style={{
        minHeight: spacing.xl * 2,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View className="w-8 h-8 rounded-lg bg-primary-light items-center justify-center">
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text style={typography.micro} className="text-muted-foreground uppercase">
          {label}
        </Text>
        <Text
          style={{ fontSize: typography.callout.fontSize, lineHeight: typography.callout.lineHeight }}
          className={`font-semibold mt-0.5 ${
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
    <Button
      variant="ghost"
      className="h-auto w-full rounded-none p-0"
      onPress={pressable}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.primaryLight : "transparent",
      })}
    >
      {content}
    </Button>
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
        { icon: "business-outline", label: "Customer", value: job.customer_name },
        { icon: "document-text-outline", label: "Sales Order", value: job.sales_order },
        job.customer_phone && {
          icon: "call-outline",
          label: "Customer Phone",
          value: formatters.phone(job.customer_phone),
          pressable: () => Linking.openURL(`tel:${job.customer_phone}`),
        },
        job.assigned_admin_name && {
          icon: "person-outline",
          label: "Assigned Admin",
          value: job.assigned_admin_name,
        },
        { icon: "construct-outline", label: "Job Type", value: job.type },
        { icon: "location-outline", label: "Address", value: address },
        { icon: "expand-outline", label: "Job Size", value: job.size },
        // Same split as the dashboard stats: earnings are external-only,
        // incentives internal-only.
        !user?.is_internal && {
          icon: "wallet-outline",
          label: "Earnings",
          value: formatters.currency(job.rate),
        },
        user?.is_internal && {
          icon: "gift-outline",
          label: "Incentive",
          value: formatters.currency(job.incentive),
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
        ...[
          ["Drawing", job.drawing_document_link],
          ["Handover Document", job.handover_document_link],
          ["NCR Document", job.ncr_document_link],
          ["Project Report", job.project_report_document_link],
        ].filter(([, link]) => link).map(([label, link]) => ({
          icon: "document-attach-outline",
          label,
          value: "Open document",
          pressable: () => Linking.openURL(link),
        })),
      ].filter(Boolean),
    [address, job, user?.is_internal],
  );

  return (
    <View className="gap-4">
      <Card>
        <View className="flex-row justify-between items-start gap-3">
          <Text style={{ fontSize: typography.title2.fontSize, lineHeight: typography.title2.lineHeight }} className="flex-1 font-extrabold text-foreground">
            {job.name}
          </Text>
          <StatusBadge
            label={JOB_STATUS_LABELS[job.status] || job.status}
            tone={statusTone}
          />
        </View>

        {job.description ? (
          <Text className="text-sm text-muted-foreground mt-3" style={{ lineHeight: (typography.callout.lineHeight + typography.body.lineHeight) / 2 }}>
            {job.description}
          </Text>
        ) : null}
      </Card>

      <Card padded={false} className="overflow-hidden bg-surface">
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
      </Card>
    </View>
  );
};

export default React.memo(JobDetails);
