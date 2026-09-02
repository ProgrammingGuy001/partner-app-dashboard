import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { dashboardApi } from "../../api/dashboardApi";
import { useTheme } from "../../hooks/useTheme";
import { todayISO } from "../../util/isoDate";
import { ROSTER_STATUS_LABEL } from "../../util/constants";
import { Card, StatusBadge } from "../common/Primitives";
import { typography } from "../../theme/designSystem";

// The backend decides where the day stands (app/routes/roster.py::_entry_status).
// Each state gets one line of copy and one primary action.
const STATE_COPY = {
  blocked: {
    headline: "Start the job to open attendance",
    body: "Attendance and the checklist unlock once this job is started.",
    action: "open_job",
    actionLabel: "Open job",
  },
  scheduled: {
    headline: "You are scheduled",
    body: (entry) => `Check-in opens shortly before ${entry.slot_start}.`,
    action: "open_job",
    actionLabel: "View job",
  },
  check_in_open: {
    headline: "Check in now",
    body: "Take your site photo to start the slot.",
    action: "check_in",
    actionLabel: "Check in",
  },
  checked_in: {
    headline: "You are on site",
    body: "Work through the checklist, then check out before the slot ends.",
    action: "open_job",
    actionLabel: "Open job",
    secondary: "check_out",
    secondaryLabel: "Check out",
  },
  report_due: {
    headline: "Submit your daily report",
    body: "The slot has ended. Generate the report, then check out.",
    action: "daily_report",
    actionLabel: "Daily report",
    secondary: "check_out",
    secondaryLabel: "Check out",
  },
  completed: {
    headline: "Day complete",
    body: "Checked out and reported. Nothing else is due today.",
    action: "open_job",
    actionLabel: "View job",
  },
  auto_closed: {
    headline: "Closed automatically",
    body: "You were checked out by the system. Tell your supervisor if that is wrong.",
    action: "open_job",
    actionLabel: "View job",
  },
  missed: {
    headline: "Slot missed",
    body: "No check-in was recorded for this slot.",
    action: "open_job",
    actionLabel: "View job",
  },
};

// What needs attention first, not whatever sits earliest in the day.
const PRIORITY = ["check_in_open", "report_due", "checked_in", "blocked", "scheduled", "missed", "completed", "auto_closed"];

const pickEntry = (entries) =>
  [...entries].sort(
    (a, b) => PRIORITY.indexOf(a.status) - PRIORITY.indexOf(b.status) || a.slot_number - b.slot_number,
  )[0];

const TodayCard = ({ onAction }) => {
  const { colors } = useTheme();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await dashboardApi.getRoster({ dateFrom: todayISO(), dateTo: todayISO() });
      setEntries(data.entries || []);
    } catch {
      // A roster outage must not hide the dashboard — the card just stays away.
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Card className="mt-4">
        <View className="h-4 w-20 rounded bg-muted" />
        <View className="mt-3 h-5 w-48 rounded bg-muted" />
        <View className="mt-5 h-12 w-full rounded-xl bg-muted" />
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="mt-4">
        <Text style={{ fontSize: typography.callout.fontSize, lineHeight: typography.callout.lineHeight }} className="font-extrabold text-foreground">No assignment today</Text>
        <Text style={typography.caption} className="mt-1 text-muted-foreground">
          Your supervisor has not rostered you for a slot today. Your jobs are listed below.
        </Text>
      </Card>
    );
  }

  const entry = pickEntry(entries);
  const copy = STATE_COPY[entry.status] || STATE_COPY.scheduled;
  const body = typeof copy.body === "function" ? copy.body(entry) : copy.body;
  const remaining = entries.length - 1;

  return (
    <Card className="mt-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text style={typography.micro} className="uppercase tracking-wider text-muted-foreground">Today</Text>
          <Text style={{ fontSize: (typography.body.fontSize + typography.title3.fontSize) / 2, lineHeight: typography.title3.lineHeight }} className="mt-1 font-extrabold text-foreground" numberOfLines={2}>
            {entry.job?.name}
          </Text>
        </View>
        <StatusBadge label={ROSTER_STATUS_LABEL[entry.status] || entry.status} />
      </View>

      <View className="mt-3 gap-1.5">
        <View className="flex-row items-center gap-2">
          <Ionicons name="time-outline" size={15} color={colors.textMuted} />
          <Text style={typography.caption} className="text-muted-foreground">
            Slot {entry.slot_number} · {entry.slot_start}–{entry.slot_end}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Ionicons name="location-outline" size={15} color={colors.textMuted} />
          <Text style={typography.caption} className="flex-1 text-muted-foreground" numberOfLines={1}>
            {entry.job?.service_location || entry.job?.customer_city || "Location pending"}
          </Text>
        </View>
      </View>

      <Text style={typography.caption} className="mt-4 text-foreground">
        <Text className="font-bold">{copy.headline}. </Text>
        <Text className="text-muted-foreground">{body}</Text>
      </Text>

      <Button className="mt-4 h-12" onPress={() => onAction?.(copy.action, entry)}>
        <Text>{copy.actionLabel}</Text>
      </Button>

      {copy.secondary ? (
        <Button variant="outline" className="mt-2 h-12" onPress={() => onAction?.(copy.secondary, entry)}>
          <Text>{copy.secondaryLabel}</Text>
        </Button>
      ) : null}

      {remaining > 0 ? (
        <Button variant="link" size="sm" className="mt-3 h-auto" onPress={() => onAction?.("roster", entry)} accessibilityRole="button">
          <Text className="text-center font-bold text-primary">
            +{remaining} more slot{remaining === 1 ? "" : "s"} today
          </Text>
        </Button>
      ) : null}
    </Card>
  );
};

export default TodayCard;
