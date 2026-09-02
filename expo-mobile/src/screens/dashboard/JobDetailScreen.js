import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  View,
  TextInput,
  Linking,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import JobDetails from "../../components/dashboard/JobDetails";
import BillingSection from "../../components/dashboard/BillingSection";
import EmptyState from "../../components/common/EmptyState";
import { useAuthStore } from "../../store/authStore";
import Loader from "../../components/common/Loader";
import { dashboardApi } from "../../api/dashboardApi";
import { grnApi } from "../../api/grnApi";
import { useDashboardStore } from "../../store/dashboardStore";
import { useToast } from "../../hooks/useToast";
import { useTheme } from "../../hooks/useTheme";
import { ROUTES } from "../../util/constants";
import {
  DOCUMENT_LABELS,
  closureDocuments,
  completionDocumentLink,
} from "../../util/jobDocuments";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Card, Notice, StatusBadge } from '../../components/common/Primitives';
import { getApiErrorMessage, getApiFieldErrors } from '../../api/apiErrors';
import { spacing, typography } from '../../theme/designSystem';

const JobDetailScreen = ({ navigation, route }) => {
  const id = Number(route.params?.id);
  const toast = useToast();
  const { colors } = useTheme();
  const { getJobDetailFromCache, cacheJobDetail } = useDashboardStore();
  const user = useAuthStore((s) => s.user);
  const isExternalIP = user?.is_internal === false;
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const cached = getJobDetailFromCache(id);
  const [loading, setLoading] = useState(!cached);
  const [job, setJob] = useState(cached?.job ?? null);
  const [jobError, setJobError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [endOtp, setEndOtp] = useState("");
  const [endOtpSent, setEndOtpSent] = useState(false);
  const [endOtpSending, setEndOtpSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(null);
  const [paperwork, setPaperwork] = useState(null);
  const [paperworkError, setPaperworkError] = useState("");
  const [startFieldErrors, setStartFieldErrors] = useState({});
  const [finishFieldErrors, setFinishFieldErrors] = useState({});
  const hasValidJobId = Number.isInteger(id) && id > 0;
  const checklistCount = job?.checklists?.length ?? 0;
  const requiredCompletionDocuments = closureDocuments(job?.type);
  const allCompletionDocumentsAttached = requiredCompletionDocuments.every((slot) =>
    completionDocumentLink(job, slot),
  );

  const fetchJobDetails = useCallback(async (force = false) => {
    if (!hasValidJobId) {
      toast.error("Invalid job selected");
      navigation.goBack();
      return null;
    }

    try {
      const response = await dashboardApi.getJob(id, { force });
      const baseJob = response.job || response.data;
      const jobData = response.checklistsError ? { ...baseJob, _partialError: response.checklistsError } : baseJob;
      if (isMountedRef.current) {
        setJob(jobData);
        setJobError(null);
      }
      return jobData;
    } catch (error) {
      if (isMountedRef.current) {
        const message = getApiErrorMessage(error);
        setJobError({ message, status: error.status });
        toast.error(message);
      }
      return null;
    }
  }, [id, hasValidJobId, toast, navigation]);


  useEffect(() => {
    if (!hasValidJobId) {
      setLoading(false);
      return;
    }
    if (cached) return;

    (async () => {
      if (isMountedRef.current) setLoading(true);
      const jobData = await fetchJobDetails();
      if (jobData) cacheJobDetail(id, jobData);
      if (isMountedRef.current) setLoading(false);
    })();
  }, [id, hasValidJobId, cached, fetchJobDetails, cacheJobDetail]);

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    const jobData = await fetchJobDetails(true);
    if (jobData) cacheJobDetail(id, jobData);
    setRefreshing(false);
  }, [id, fetchJobDetails, cacheJobDetail]);

  const handleRetry = async () => {
    setLoading(true);
    const jobData = await fetchJobDetails(true);
    if (jobData) cacheJobDetail(id, jobData);
    if (isMountedRef.current) setLoading(false);
  };


  const handleSendStartOtp = async () => {
    setOtpSending(true);
    try {
      await dashboardApi.requestStartOtp(id);
      setOtpSent(true);
      toast.success(`OTP sent to the customer on ${job.customer_phone}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      if (isMountedRef.current) setOtpSending(false);
    }
  };

  const handleStartJob = async () => {
    setStarting(true);
    setStartFieldErrors({});
    try {
      await dashboardApi.startJob(id, {
        otp: job.customer_phone ? otp.trim() : undefined,
      });
      setOtp("");
      setOtpSent(false);
      toast.success(job.status === "paused" ? "Job resumed" : "Job started");
      const jobData = await fetchJobDetails(true);
      if (jobData) cacheJobDetail(id, jobData);
    } catch (error) {
      setStartFieldErrors(getApiFieldErrors(error));
      toast.error(getApiErrorMessage(error));
    } finally {
      if (isMountedRef.current) setStarting(false);
    }
  };

  const isGrnJob = job?.type === "grn";
  useEffect(() => {
    if (!isGrnJob || !hasValidJobId) return;
    let cancelled = false;
    grnApi
      .getJobPaperwork(id)
      .then((data) => { if (!cancelled) { setPaperwork(data); setPaperworkError(""); } })
      .catch((error) => { if (!cancelled) { setPaperwork(null); setPaperworkError(getApiErrorMessage(error)); } });
    return () => { cancelled = true; };
  }, [isGrnJob, hasValidJobId, id]);

  const handleSendEndOtp = async () => {
    setEndOtpSending(true);
    try {
      await dashboardApi.requestEndOtp(id);
      setEndOtpSent(true);
      toast.success(`OTP sent to the customer on ${job.customer_phone}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      if (isMountedRef.current) setEndOtpSending(false);
    }
  };

  const handleFinishJob = async () => {
    setFinishing(true);
    setFinishFieldErrors({});
    try {
      await dashboardApi.finishJob(id, {
        otp: job.customer_phone ? endOtp.trim() : undefined,
      });
      setEndOtp("");
      setEndOtpSent(false);
      toast.success("Job completed");
      const jobData = await fetchJobDetails(true);
      if (jobData) cacheJobDetail(id, jobData);
    } catch (error) {
      // The backend names the missing closure document, so surface it verbatim.
      setFinishFieldErrors(getApiFieldErrors(error));
      toast.error(getApiErrorMessage(error));
    } finally {
      if (isMountedRef.current) setFinishing(false);
    }
  };

  const handleCompletionDocumentUpload = async (slot) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ...(slot === "project_report"
            ? ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
            : []),
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      setUploadingDocument(slot);
      await dashboardApi.uploadCompletionDocument(id, slot, result.assets?.[0]);
      const jobData = await fetchJobDetails(true);
      if (jobData) cacheJobDetail(id, jobData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success(`${DOCUMENT_LABELS[slot]} attached`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      if (isMountedRef.current) setUploadingDocument(null);
    }
  };

  if (loading) {
    return <Loader fullScreen text="Loading job details..." />;
  }

  if (!job) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-xl font-bold text-foreground">
            {jobError?.status === 404 ? "Job not found" : "Could not load job"}
          </Text>
          {jobError?.message ? <Notice tone="danger" title="Job unavailable" message={jobError.message} /> : null}
          {jobError?.status !== 404 && (
            <Button variant="outline" onPress={handleRetry}><Text>Try again</Text></Button>
          )}
          <Button onPress={() => navigation.goBack()}>
            <Text>Back to Dashboard</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl + spacing.xs,
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <JobDetails job={job} />

        {job._partialError ? <Notice tone="warning" title="Checklists unavailable" message={getApiErrorMessage(job._partialError)} className="mt-4" /> : null}
        {paperworkError ? <Notice tone="warning" title="Order paperwork unavailable" message={paperworkError} className="mt-4" /> : null}

        {/* Start / resume — an IP may start their own job, same as the supervisor */}
        {(job.status === "created" || job.status === "paused") && (
          <Card className="mt-4">
            <Text style={{ fontSize: typography.callout.fontSize, lineHeight: typography.callout.lineHeight }} className="font-extrabold text-foreground">
              {job.status === "paused" ? "Resume this job" : "Start this job"}
            </Text>
            <Text style={typography.caption} className="mt-1 text-muted-foreground">
              {job.customer_phone
                ? "Send the customer a one-time code and enter it here to go on site."
                : "No customer phone on file, so this job starts without an OTP."}
            </Text>

            {job.customer_phone && (
              <View className="mt-4 flex-row gap-3">
                <TextInput
                  value={otp}
                  onChangeText={(value) => setOtp(value.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  placeholder="Customer OTP"
                  placeholderTextColor={colors.textMuted}
                  className="flex-1 h-12 rounded-xl border border-border bg-background px-4 text-foreground"
                />
                <Button
                  variant="outline"
                  onPress={handleSendStartOtp}
                  disabled={otpSending}
                  className="h-12"
                >
                  <Text>{otpSending ? "Sending…" : otpSent ? "Resend" : "Send OTP"}</Text>
                </Button>
              </View>
            )}
            {startFieldErrors.otp ? <Text className="mt-2 text-xs text-destructive">{startFieldErrors.otp}</Text> : null}

            <Button
              onPress={handleStartJob}
              disabled={starting || (Boolean(job.customer_phone) && otp.trim().length === 0)}
              className="mt-4 h-12"
            >
              <Text>
                {starting
                  ? "Starting…"
                  : job.status === "paused"
                    ? "Resume job"
                    : "Start job"}
              </Text>
            </Button>
          </Card>
        )}

        {job.status === "in_progress" && (
          <Card className="mt-4">
            <Text style={{ fontSize: typography.callout.fontSize, lineHeight: typography.callout.lineHeight }} className="font-extrabold text-foreground">
              Complete this job
            </Text>
            <Text style={typography.caption} className="mt-1 text-muted-foreground">
              {job.customer_phone
                ? "Send the customer a one-time code and enter it here to close the job."
                : "No customer phone on file, so this job closes without an OTP."}
            </Text>

            <View
              className="mt-4 rounded-xl border border-border bg-background p-4"
              accessibilityLabel={`Required completion documents: ${requiredCompletionDocuments.map((slot) => DOCUMENT_LABELS[slot]).join(", ")}`}
            >
              <Text className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Required before completion
              </Text>
              {requiredCompletionDocuments.map((slot) => {
                const link = completionDocumentLink(job, slot);
                const uploading = uploadingDocument === slot;
                return (
                  <View key={slot} className="mt-3 rounded-xl border border-border bg-surface p-3">
                    <View className="flex-row items-center gap-3">
                      <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary-light">
                        <Ionicons
                          name={link ? "checkmark-circle-outline" : "document-attach-outline"}
                          size={17}
                          color={link ? colors.success : colors.primary}
                        />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text style={{ fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }} className="font-bold text-foreground">
                          {DOCUMENT_LABELS[slot]}
                        </Text>
                        <Text
                          className="mt-0.5 font-semibold"
                          style={{ fontSize: typography.micro.fontSize, lineHeight: typography.micro.lineHeight, color: link ? colors.success : colors.textMuted }}
                        >
                          {link ? "Attached and ready" : "Upload required"}
                        </Text>
                      </View>
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => handleCompletionDocumentUpload(slot)}
                        disabled={uploading}
                        accessibilityRole="button"
                        accessibilityLabel={`${link ? "Replace" : "Upload"} ${DOCUMENT_LABELS[slot]}`}
                        accessibilityState={{ disabled: uploading, busy: uploading }}
                      >
                        <Text>{uploading ? "Uploading…" : link ? "Replace" : "Upload"}</Text>
                      </Button>
                    </View>
                    {link && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => Linking.openURL(link)}
                        accessibilityRole="link"
                        accessibilityLabel={`View ${DOCUMENT_LABELS[slot]}`}
                        className="mt-2 self-start"
                      >
                        <Text>View attached file</Text>
                      </Button>
                    )}
                  </View>
                );
              })}
            </View>

            {job.customer_phone && (
              <View className="mt-4 flex-row gap-3">
                <TextInput
                  value={endOtp}
                  onChangeText={(value) => setEndOtp(value.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  placeholder="Customer OTP"
                  placeholderTextColor={colors.textMuted}
                  className="flex-1 h-12 rounded-xl border border-border bg-background px-4 text-foreground"
                />
                <Button
                  variant="outline"
                  onPress={handleSendEndOtp}
                  disabled={endOtpSending}
                  className="h-12"
                >
                  <Text>{endOtpSending ? "Sending…" : endOtpSent ? "Resend" : "Send OTP"}</Text>
                </Button>
              </View>
            )}
            {finishFieldErrors.otp ? <Text className="mt-2 text-xs text-destructive">{finishFieldErrors.otp}</Text> : null}

            <Button
              onPress={handleFinishJob}
              disabled={finishing || !allCompletionDocumentsAttached || (Boolean(job.customer_phone) && endOtp.trim().length === 0)}
              className="mt-4 h-12"
            >
              <Text>{finishing ? "Completing…" : "Complete job"}</Text>
            </Button>
          </Card>
        )}

        {isGrnJob && paperwork && (
          <Card className="mt-4">
            <Text style={{ fontSize: typography.callout.fontSize, lineHeight: typography.callout.lineHeight }} className="font-extrabold text-foreground">Order paperwork</Text>

            <View className="mt-3 flex-row items-start justify-between gap-3">
              <Text style={typography.caption} className="text-muted-foreground">Sales order</Text>
              <Text style={{ fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }} className="flex-1 text-right font-semibold text-foreground">
                {paperwork.sales_order || "Not set yet"}
              </Text>
            </View>

            <View className="mt-2 flex-row items-start justify-between gap-3">
              <Text style={typography.caption} className="text-muted-foreground">Repair order</Text>
              <Text style={{ fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }} className="flex-1 text-right font-semibold text-foreground">
                {paperwork.repair_orders.length
                  ? paperwork.repair_orders.map((order) => order.name).join(", ")
                  : paperwork.lookup_error
                    ? "Could not reach Odoo"
                    : "None linked"}
              </Text>
            </View>

            {paperwork.grns.length === 0 ? (
              <Text className="mt-3 text-xs text-muted-foreground">
                No GRN has been raised for this job yet.
              </Text>
            ) : (
              paperwork.grns.map((grn) => (
                <View key={grn.id} className="mt-3 rounded-xl border border-border bg-background p-3">
                  <Text style={{ fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }} className="font-semibold text-foreground">
                    {grn.odoo_picking_name || grn.source_document}
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {grn.status.replaceAll("_", " ")}
                    {grn.has_missing ? " · packages missing" : ""}
                  </Text>
                </View>
              ))
            )}

            {paperwork.grns.some((grn) => grn.status === "pending") && (
              <Button
                variant="outline"
                onPress={() => navigation.navigate(ROUTES.MAIN_TABS, {
                  screen: ROUTES.SITE_GRN,
                  params: { jobId: job.id, salesOrder: job.sales_order },
                })}
                className="mt-4 h-12"
              >
                <Text>Close pending GRN</Text>
              </Button>
            )}
          </Card>
        )}

        {/* Mission Control Quick Actions */}
        <View className="flex-row gap-3 mt-4">
          <Button
            variant="outline"
            onPress={() => navigation.navigate(ROUTES.MAIN_TABS, {
              screen: ROUTES.SITE_GRN,
              params: { jobId: job.id, salesOrder: job.sales_order },
            })}
            accessibilityRole="button"
            accessibilityLabel={`Open site GRN for ${job.name}`}
            className="h-auto flex-1 flex-col p-4"
          >
            <View className="w-12 h-12 rounded-full bg-primary-light items-center justify-center mb-2">
              <Ionicons name="cube" size={typography.title2.fontSize} color={colors.primary} />
            </View>
            <Text>Upload GRN</Text>
          </Button>

          <Button
            variant="outline"
            onPress={() => navigation.navigate(ROUTES.MAIN_TABS, {
              screen: ROUTES.SITE_REQUISITE,
              params: { salesOrder: job.sales_order },
            })}
            accessibilityRole="button"
            accessibilityLabel={`Create a site requisite for ${job.name}`}
            className="h-auto flex-1 flex-col p-4"
          >
            <View className="w-12 h-12 rounded-full bg-primary-light items-center justify-center mb-2">
              <Ionicons name="construct" size={typography.title2.fontSize} color={colors.primary} />
            </View>
            <Text>Missing part</Text>
          </Button>
        </View>

        {/* Billing Section — external IP users only */}
        {isExternalIP && <BillingSection job={job} />}

        {/* Checklists Section */}
        <Card padded={false} className="mt-4 overflow-hidden">
          <View className="px-5 py-4 border-b border-border flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-base font-extrabold text-foreground">
                Required Tasks
              </Text>
              <Text className="text-xs font-medium text-muted-foreground mt-0.5">
                Checklist workflow for this job
              </Text>
            </View>
            {checklistCount > 0 ? (
              <StatusBadge label={`${checklistCount} item${checklistCount === 1 ? "" : "s"}`} tone="primary" />
            ) : null}
          </View>
          {job.checklists?.length ? (
            <View>
              {job.checklists.map((checklist, index) => (
                <Button
                  variant="ghost"
                  key={checklist.id}
                  onPress={() =>
                    navigation.navigate(ROUTES.CHECKLIST, {
                      jobId: job.id,
                      checklistId: checklist.id,
                    })
                  }
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Open checklist: ${checklist.name}`}
                  accessibilityHint="Double tap to open this checklist"
                  className="h-auto w-full flex-row items-center justify-between rounded-none px-5 py-4"
                  style={{
                    minHeight: 64,
                    borderBottomWidth:
                      index === job.checklists.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="w-9 h-9 rounded-lg bg-primary-light items-center justify-center">
                      <Ionicons
                        name="checkbox-outline"
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <Text
                      style={{ fontSize: typography.callout.fontSize, lineHeight: typography.callout.lineHeight }}
                      className="flex-1 font-bold text-foreground"
                      numberOfLines={2}
                    >
                      {checklist.name}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textMuted}
                  />
                </Button>
              ))}
            </View>
          ) : (
            <View className="p-5">
              <EmptyState
                icon="checkbox-outline"
                title="No checklists assigned"
                subtitle="Required tasks for this job will appear here when assigned."
              />
            </View>
          )}
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
};

export default JobDetailScreen;
