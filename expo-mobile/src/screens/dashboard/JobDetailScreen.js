import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  View,
  TouchableOpacity,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import JobDetails from "../../components/dashboard/JobDetails";
import ProgressTimeline from "../../components/dashboard/ProgressTimeline";
import BillingSection from "../../components/dashboard/BillingSection";
import DailyJobUpdate from "../../components/dashboard/DailyJobUpdate";
import EmptyState from "../../components/common/EmptyState";
import { useAuthStore } from "../../store/authStore";
import Loader from "../../components/common/Loader";
import { dashboardApi } from "../../api/dashboardApi";
import { useDashboardStore } from "../../store/dashboardStore";
import { useToast } from "../../hooks/useToast";
import { useTheme } from "../../hooks/useTheme";
import { ROUTES } from "../../util/constants";
import { logger } from "../../util/helpers";
import Ionicons from "@react-native-vector-icons/ionicons";

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
  const [progress, setProgress] = useState(cached?.progress ?? []);
  const [refreshing, setRefreshing] = useState(false);
  const hasValidJobId = Number.isInteger(id) && id > 0;
  const checklistCount = job?.checklists?.length ?? 0;

  const fetchJobDetails = useCallback(async () => {
    if (!hasValidJobId) {
      toast.error("Invalid job selected");
      navigation.goBack();
      return null;
    }

    try {
      const response = await dashboardApi.getJob(id);
      const jobData = response.job || response.data;
      if (isMountedRef.current) setJob(jobData);
      return jobData;
    } catch (error) {
      if (isMountedRef.current) {
        toast.error(error.message || "Failed to fetch job details");
        navigation.goBack();
      }
      return null;
    }
  }, [id, hasValidJobId, toast, navigation]);

  const fetchJobProgress = useCallback(async () => {
    if (!hasValidJobId) return [];

    try {
      const response = await dashboardApi.getJobProgress(id);
      const uploads = response.uploads || [];
      if (isMountedRef.current) setProgress(uploads);
      return uploads;
    } catch (error) {
      logger.warn(
        "JobDetailScreen",
        `Failed to fetch progress: ${error?.message}`,
      );
      if (isMountedRef.current) {
        setProgress([]);
      }
      return [];
    }
  }, [id, hasValidJobId]);

  useEffect(() => {
    if (!hasValidJobId) {
      setLoading(false);
      return;
    }
    if (cached) return;

    (async () => {
      if (isMountedRef.current) setLoading(true);
      const [jobData, uploads] = await Promise.all([
        fetchJobDetails(),
        fetchJobProgress(),
      ]);
      if (jobData) cacheJobDetail(id, jobData, uploads);
      if (isMountedRef.current) setLoading(false);
    })();
  }, [id, hasValidJobId]);

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    const [jobData, uploads] = await Promise.all([
      fetchJobDetails(),
      fetchJobProgress(),
    ]);
    if (jobData) cacheJobDetail(id, jobData, uploads);
    setRefreshing(false);
  }, [id, fetchJobDetails, fetchJobProgress, cacheJobDetail]);

  if (loading) {
    return <Loader fullScreen text="Loading job details..." />;
  }

  if (!job) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-xl font-bold text-foreground">
            Job not found
          </Text>
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
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 40,
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

        {/* Billing Section — external IP users only */}
        {isExternalIP && <BillingSection job={job} />}

        {/* Checklists Section */}
        <View
          className="mt-4 rounded-2xl border border-border bg-surface overflow-hidden"
          style={colors.shadowSm}
        >
          <View className="px-5 py-4 border-b border-border flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-base font-extrabold text-foreground">
                Required Tasks
              </Text>
              <Text className="text-[12px] font-medium text-muted-foreground mt-0.5">
                Checklist workflow for this job
              </Text>
            </View>
            {checklistCount > 0 ? (
              <View className="rounded-xl bg-primary-light px-2.5 py-1">
                <Text className="text-[11px] font-extrabold text-primary">
                  {checklistCount} item{checklistCount === 1 ? "" : "s"}
                </Text>
              </View>
            ) : null}
          </View>
          {job.checklists?.length ? (
            <View>
              {job.checklists.map((checklist, index) => (
                <TouchableOpacity
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
                  className="flex-row items-center justify-between px-5 py-4"
                  style={{
                    minHeight: 64,
                    borderBottomWidth:
                      index === job.checklists.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="w-9 h-9 rounded-[10px] bg-primary-light items-center justify-center">
                      <Ionicons
                        name="checkbox-outline"
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <Text
                      className="flex-1 text-[15px] font-bold text-foreground"
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
                </TouchableOpacity>
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
        </View>

        {/* Daily Progress Update */}
        <View className="mt-4">
          <DailyJobUpdate jobId={job.id} />
        </View>

        <View className="mt-4">
          <ProgressTimeline progress={progress} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default JobDetailScreen;
