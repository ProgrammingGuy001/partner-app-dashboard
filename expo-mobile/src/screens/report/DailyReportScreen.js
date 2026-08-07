// Generate the Daily Installation Report on its own, without marking attendance.
// Nothing is stored: the PDF goes straight to the share sheet. Check-out still
// generates and files its own copy against that day's attendance record.
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import DailyReportForm, {
  ReportInput,
} from "../../components/dashboard/DailyReportForm";
import { useProgressPhotos } from "../../hooks/useProgressPhotos";
import { useToast } from "../../hooks/useToast";
import { useTheme } from "../../hooks/useTheme";
import { dashboardApi } from "../../api/dashboardApi";
import { useDashboardStore } from "../../store/dashboardStore";
import {
  emptyReport,
  hasAccomplishment,
  normalizeReport,
  reportDate,
} from "../../util/dailyReport";

// The API takes an ISO date; the report rows use DD/MM/YYYY.
const toISO = (ddmmyyyy) => {
  const match = new RegExp(/^(\d{2})\/(\d{2})\/(\d{4})$/).exec(
    String(ddmmyyyy || ""),
  );
  if (!match) return "";
  const [, d, m, y] = match;
  const candidate = new Date(Number(y), Number(m) - 1, Number(d));
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (
    candidate.getFullYear() !== Number(y) ||
    candidate.getMonth() !== Number(m) - 1 ||
    candidate.getDate() !== Number(d) ||
    candidate > today
  )
    return "";
  return `${y}-${m}-${d}`;
};

const DailyReportScreen = () => {
  const toast = useToast();
  const { colors, isDark } = useTheme();
  const onPrimary = isDark ? colors.background : "#fff";
  // Any of the partner's jobs, not just in-progress ones: a report can be needed
  // for a job that has since been completed or paused.
  const jobs = useDashboardStore((state) => state.jobs);
  const setJobs = useDashboardStore((state) => state.setJobs);

  const [jobId, setJobId] = useState("manual");
  const [manualJob, setManualJob] = useState({
    projectName: "",
    salesOrder: "",
    projectSupervisor: "",
    siteAddress: "",
  });
  const [date, setDate] = useState(reportDate(0));
  const [reportData, setReportData] = useState(emptyReport);
  const [generating, setGenerating] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(jobs.length === 0);
  const [jobsError, setJobsError] = useState("");
  const progressPhotos = useProgressPhotos();

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    setJobsError("");
    try {
      const response = await dashboardApi.getJobs();
      setJobs(response.jobs || response.data || []);
    } catch (error) {
      setJobsError(error.message || "Could not load your jobs");
    } finally {
      setJobsLoading(false);
    }
  }, [setJobs]);

  useEffect(() => {
    if (jobs.length === 0) fetchJobs();
    else setJobsLoading(false);
  }, [fetchJobs, jobs.length]);

  const handleGenerate = async () => {
    if (!jobId) {
      toast.error("Select the job this report is for");
      return;
    }
    if (jobId === "manual" && !manualJob.projectName.trim()) {
      toast.error("Enter the project name for the manual job");
      return;
    }
    const iso = toISO(date);
    if (!iso) {
      toast.error(
        "Enter a valid report date in DD/MM/YYYY that is not in the future",
      );
      return;
    }
    if (!hasAccomplishment(reportData)) {
      toast.error("Add at least one key accomplishment to the daily report");
      return;
    }

    setGenerating(true);
    try {
      await dashboardApi.generateDailyReport({
        jobId,
        manualJob,
        reportDate: iso,
        reportData: normalizeReport(reportData),
        progressPhotos: progressPhotos.photos,
      });
      toast.success("Daily Installation Report generated");
    } catch (err) {
      toast.error(err?.message || "Could not generate the report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-xs font-semibold uppercase text-muted-foreground">
          Job <Text className="text-destructive">*</Text>
        </Text>
        <View className="gap-2">
          {jobsLoading ? (
            <ActivityIndicator
              color={colors.primary}
              accessibilityLabel="Loading jobs"
            />
          ) : jobsError ? (
            <View className="items-start gap-2">
              <Text className="text-sm text-destructive">{jobsError}</Text>
              <Button variant="outline" size="sm" onPress={fetchJobs}>
                <Text>Try again</Text>
              </Button>
            </View>
          ) : jobs.length === 0 ? (
            <Text className="text-sm text-muted-foreground">
              No jobs assigned yet.
            </Text>
          ) : (
            jobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                onPress={() => setJobId(job.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: jobId === job.id }}
                className={`min-h-11 flex-row items-center justify-between rounded-xl border px-3 py-2 ${
                  jobId === job.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background"
                }`}
              >
                <Text
                  className="flex-1 text-sm text-foreground"
                  numberOfLines={1}
                >
                  {job.name || `Job ${job.id}`} · ID {job.id}
                </Text>
                {jobId === job.id ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.primary}
                  />
                ) : null}
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity
            onPress={() => setJobId("manual")}
            accessibilityRole="button"
            accessibilityState={{ selected: jobId === "manual" }}
            className={`min-h-11 flex-row items-center justify-between rounded-xl border px-3 py-2 ${
              jobId === "manual"
                ? "border-primary bg-primary/10"
                : "border-border bg-background"
            }`}
          >
            <Text className="flex-1 text-sm font-semibold text-foreground">
              Job not listed — enter details manually
            </Text>
            {jobId === "manual" ? (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.primary}
              />
            ) : null}
          </TouchableOpacity>
        </View>

        {jobId === "manual" ? (
          <View className="gap-3 rounded-xl border border-border p-3">
            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground">
                Manual job details
              </Text>
              <Text className="text-xs text-muted-foreground">
                Used only in this PDF; this does not create a dashboard job.
              </Text>
            </View>
            <ReportInput
              label="Project name (required)"
              value={manualJob.projectName}
              placeholder="Project or site name"
              maxLength={255}
              colors={colors}
              onChangeText={(projectName) =>
                setManualJob((current) => ({ ...current, projectName }))
              }
            />
            <ReportInput
              label="Sales order"
              value={manualJob.salesOrder}
              placeholder="Sales order number"
              maxLength={100}
              colors={colors}
              onChangeText={(salesOrder) =>
                setManualJob((current) => ({ ...current, salesOrder }))
              }
            />
            <ReportInput
              label="Project supervisor"
              value={manualJob.projectSupervisor}
              placeholder="Defaults to your profile"
              maxLength={255}
              colors={colors}
              onChangeText={(projectSupervisor) =>
                setManualJob((current) => ({ ...current, projectSupervisor }))
              }
            />
            <ReportInput
              label="Site address"
              value={manualJob.siteAddress}
              placeholder="Installation site address"
              maxLength={1000}
              multiline
              colors={colors}
              onChangeText={(siteAddress) =>
                setManualJob((current) => ({ ...current, siteAddress }))
              }
            />
          </View>
        ) : null}

        <ReportInput
          label="Report date"
          value={date}
          placeholder="DD/MM/YYYY"
          maxLength={10}
          keyboardType="numbers-and-punctuation"
          colors={colors}
          onChangeText={setDate}
        />

        <DailyReportForm
          reportData={reportData}
          setReportData={setReportData}
          colors={colors}
          progressPhotos={progressPhotos.photos}
          onPickPhotos={progressPhotos.pick}
          onRemovePhoto={progressPhotos.remove}
        />

        <Button
          className="w-full h-12 rounded-xl"
          disabled={generating}
          onPress={handleGenerate}
        >
          {generating ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color={onPrimary} size="small" />
              <Text className="text-sm font-bold" style={{ color: onPrimary }}>
                Generating…
              </Text>
            </View>
          ) : (
            <Text className="text-sm font-bold" style={{ color: onPrimary }}>
              Generate and share PDF
            </Text>
          )}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DailyReportScreen;
