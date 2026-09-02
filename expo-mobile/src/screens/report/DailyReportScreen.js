// Generate the Daily Installation Report without marking attendance.
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import DailyReportForm, { ReportInput } from "../../components/dashboard/DailyReportForm";
import ScreenHeader from "../../components/common/ScreenHeader";
import Loader from "../../components/common/Loader";
import { Card, Notice } from "../../components/common/Primitives";
import { useProgressPhotos } from "../../hooks/useProgressPhotos";
import { useToast } from "../../hooks/useToast";
import { useTheme } from "../../hooks/useTheme";
import { dashboardApi } from "../../api/dashboardApi";
import { getApiErrorMessage, getApiFieldErrors } from "../../api/apiErrors";
import { useDashboardStore } from "../../store/dashboardStore";
import { spacing } from "../../theme/designSystem";
import { emptyReport, hasAccomplishment, normalizeReport, reportDate } from "../../util/dailyReport";
import { reportDateToISO } from "../../util/dailyReportDate";

const DailyReportScreen = () => {
  const toast = useToast();
  const { colors } = useTheme();
  const jobs = useDashboardStore((state) => state.jobs);
  const setJobs = useDashboardStore((state) => state.setJobs);
  const [jobId, setJobId] = useState("manual");
  const [manualJob, setManualJob] = useState({ projectName: "", salesOrder: "", projectSupervisor: "", siteAddress: "" });
  const [date, setDate] = useState(reportDate(0));
  const [reportData, setReportData] = useState(emptyReport);
  const [generating, setGenerating] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(jobs.length === 0);
  const [jobsError, setJobsError] = useState("");
  const [serverErrors, setServerErrors] = useState({});
  const progressPhotos = useProgressPhotos();

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    setJobsError("");
    try {
      const response = await dashboardApi.getJobs();
      setJobs(response.jobs || response.data || []);
    } catch (error) {
      setJobsError(getApiErrorMessage(error));
    } finally {
      setJobsLoading(false);
    }
  }, [setJobs]);

  useEffect(() => {
    if (jobs.length === 0) fetchJobs();
    else setJobsLoading(false);
  }, [fetchJobs, jobs.length]);

  const setManualField = (field, apiField) => (value) => {
    setManualJob((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => ({ ...current, [apiField]: "" }));
  };

  const handleGenerate = async () => {
    if (jobId === "manual" && !manualJob.projectName.trim()) return toast.error("Enter the project name for the manual job");
    const iso = reportDateToISO(date);
    if (!iso) return toast.error("Enter a valid DD/MM/YYYY report date that is not in the future");
    if (!hasAccomplishment(reportData)) return toast.error("Add at least one key accomplishment to the daily report");

    setGenerating(true);
    setServerErrors({});
    try {
      await dashboardApi.generateDailyReport({
        jobId,
        manualJob,
        reportDate: iso,
        reportData: normalizeReport(reportData),
        progressPhotos: progressPhotos.photos,
      });
      toast.success("Daily Installation Report generated");
    } catch (error) {
      setServerErrors(getApiFieldErrors(error));
      toast.error(getApiErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Field operations" title="Daily report" subtitle="Generate and share an installation report" className="pt-0" />

        <Text className="text-xs font-semibold uppercase text-muted-foreground">Job <Text className="text-destructive">*</Text></Text>
        <View className="gap-2">
          {jobsLoading && jobs.length === 0 ? <Loader text="Loading jobs" /> : null}
          {jobsError ? <Notice tone={jobs.length ? "warning" : "danger"} title={jobs.length ? "Showing saved jobs" : "Jobs unavailable"} message={jobsError} /> : null}
          {jobsError ? <Button variant="outline" size="sm" onPress={fetchJobs}><Text>Try again</Text></Button> : null}
          {!jobsLoading && jobs.length === 0 ? <Text className="text-sm text-muted-foreground">No jobs assigned yet. Use the manual option below.</Text> : null}
          {jobs.map((job) => (
            <Button
              key={job.id}
              variant={jobId === job.id ? "secondary" : "outline"}
              onPress={() => { setJobId(job.id); setServerErrors((current) => ({ ...current, job_id: "" })); }}
              accessibilityState={{ selected: jobId === job.id }}
              className="w-full justify-between"
            >
              <Text className="flex-1" numberOfLines={1}>{job.name || `Job ${job.id}`} · ID {job.id}</Text>
              {jobId === job.id ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
            </Button>
          ))}
          <Button
            variant={jobId === "manual" ? "secondary" : "outline"}
            onPress={() => { setJobId("manual"); setServerErrors((current) => ({ ...current, job_id: "" })); }}
            accessibilityState={{ selected: jobId === "manual" }}
            className="w-full justify-between"
          >
            <Text className="flex-1">Job not listed — enter details manually</Text>
            {jobId === "manual" ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
          </Button>
          {serverErrors.job_id ? <Text accessibilityRole="alert" className="text-xs text-destructive">{serverErrors.job_id}</Text> : null}
        </View>

        {jobId === "manual" ? (
          <Card className="gap-3 p-3">
            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground">Manual job details</Text>
              <Text className="text-xs text-muted-foreground">Used only in this PDF; this does not create a dashboard job.</Text>
            </View>
            <ReportInput label="Project name (required)" value={manualJob.projectName} placeholder="Project or site name" maxLength={255} colors={colors} error={serverErrors.project_name} onChangeText={setManualField("projectName", "project_name")} />
            <ReportInput label="Sales order" value={manualJob.salesOrder} placeholder="Sales order number" maxLength={100} colors={colors} error={serverErrors.sales_order} onChangeText={setManualField("salesOrder", "sales_order")} />
            <ReportInput label="Project supervisor" value={manualJob.projectSupervisor} placeholder="Defaults to your profile" maxLength={255} colors={colors} error={serverErrors.project_supervisor} onChangeText={setManualField("projectSupervisor", "project_supervisor")} />
            <ReportInput label="Site address" value={manualJob.siteAddress} placeholder="Installation site address" maxLength={1000} multiline colors={colors} error={serverErrors.site_address} onChangeText={setManualField("siteAddress", "site_address")} />
          </Card>
        ) : null}

        <ReportInput label="Report date" value={date} placeholder="DD/MM/YYYY" maxLength={10} keyboardType="numbers-and-punctuation" colors={colors} error={serverErrors.report_date} onChangeText={(value) => { setDate(value); setServerErrors((current) => ({ ...current, report_date: "" })); }} />

        <DailyReportForm reportData={reportData} setReportData={setReportData} colors={colors} progressPhotos={progressPhotos.photos} onPickPhotos={progressPhotos.pick} onRemovePhoto={progressPhotos.remove} />
        {serverErrors.report_data ? <Text accessibilityRole="alert" className="text-sm text-destructive">{serverErrors.report_data}</Text> : null}
        {serverErrors.progress_photos ? <Text accessibilityRole="alert" className="text-sm text-destructive">{serverErrors.progress_photos}</Text> : null}

        <Button className="w-full" loading={generating} onPress={handleGenerate}><Text>Generate and share PDF</Text></Button>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DailyReportScreen;
