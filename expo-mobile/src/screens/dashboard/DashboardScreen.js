import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  View,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";
import JobFilters from "../../components/dashboard/JobFilters";
import JobList from "../../components/dashboard/JobList";
import StatsCards from "../../components/dashboard/StatsCards";
import DailyAttendance from "../../components/dashboard/DailyAttendance";
import ScreenHeader from "../../components/common/ScreenHeader";
import { SkeletonList } from "../../components/common/EmptyState";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { dashboardApi } from "../../api/dashboardApi";
import { useDashboardStore } from "../../store/dashboardStore";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../hooks/useToast";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { ROUTES } from "../../util/constants";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const DashboardScreen = ({ navigation }) => {
  const toast = useToast();
  const { px } = useResponsive();
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const firstName = user?.first_name || "Partner";
  const initials =
    (user?.first_name?.[0] || "P") + (user?.last_name?.[0] || "");

  const {
    stats,
    jobs,
    setJobs,
    setLoading: setStoreLoading,
    setError,
    error: jobsError,
    isJobsStale,
  } = useDashboardStore();
  const [loading, setLoading] = useState(jobs.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const hasJobsRef = useRef(jobs.length > 0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchJobs = useCallback(async (force = false) => {
    if (!force && !isJobsStale()) return;
    if (!hasJobsRef.current && isMountedRef.current) setLoading(true);
    setStoreLoading(true);
    try {
      const response = await dashboardApi.getJobs();
      const fetched = response.jobs || response.data || [];
      hasJobsRef.current = fetched.length > 0;
      if (isMountedRef.current) {
        setJobs(fetched);
        setError(null);
      }
    } catch (error) {
      const message = error.message || "Failed to fetch jobs";
      if (isMountedRef.current) {
        setError(message);
        toast.error(message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setStoreLoading(false);
      }
    }
  }, [isJobsStale, setJobs, setError, setStoreLoading, toast]);

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isMountedRef.current) setRefreshing(true);
    await fetchJobs(true);
    if (isMountedRef.current) setRefreshing(false);
  }, [fetchJobs]);

  const handlePress = useCallback((route, params) => {
    Haptics.selectionAsync();
    navigation.navigate(route, params);
  }, [navigation]);

  const ListHeader = useCallback(() => (
    <View>
      {/* Modern Header */}
      <Animated.View entering={FadeInUp.duration(600)}>
        <ScreenHeader
          eyebrow={getGreeting()}
          title={firstName}
          subtitle={new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          right={
            <TouchableOpacity
              onPress={() => handlePress(ROUTES.ACCOUNT)}
              className="w-11 h-11 rounded-full bg-primary items-center justify-center"
              style={colors.shadowSm}
              accessibilityRole="button"
              accessibilityLabel="Open account settings"
            >
              <Text className="text-primary-foreground text-base font-bold">
                {initials}
              </Text>
            </TouchableOpacity>
          }
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).duration(600)}>
        <StatsCards stats={stats} isInternal={user?.is_internal} />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).duration(600)} className="mt-4">
        <DailyAttendance />
      </Animated.View>

      {/* Report generation without marking attendance. */}
      <Animated.View entering={FadeInUp.delay(500).duration(600)} className="mt-3">
        <TouchableOpacity
          onPress={() => navigation.navigate(ROUTES.DAILY_REPORT)}
          accessibilityRole="button"
          accessibilityLabel="Generate a Daily Installation Report"
          className="min-h-12 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-background px-4"
        >
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          <Text className="text-sm font-semibold text-primary">Generate Daily Report</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Job Queue section */}
      <Animated.View entering={FadeInUp.delay(700).duration(600)} className="mt-6">
        <View className="flex-row items-end justify-between mb-3">
          <View>
            <Text className="text-[18px] font-extrabold text-foreground">Your Jobs</Text>
            <Text className="text-[13px] font-medium text-muted-foreground mt-0.5">
              Active work queue
            </Text>
          </View>
          <View className="rounded-xl bg-primary-light px-3 py-1.5">
            <Text className="text-[12px] font-extrabold text-primary" style={{ fontVariant: ["tabular-nums"] }}>
              {jobs.length} total
            </Text>
          </View>
        </View>
        <JobFilters />
      </Animated.View>
    </View>
  ), [firstName, handlePress, colors, initials, stats, user, jobs.length]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <SkeletonList rows={5} px={px} />
      </SafeAreaView>
    );
  }

  if (jobsError && jobs.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background p-6">
        <View className="flex-1 items-center justify-center gap-3">
          <Ionicons name="cloud-offline-outline" size={42} color={colors.textMuted} />
          <Text className="text-base font-bold text-foreground">Could not load your jobs</Text>
          <Text className="text-center text-sm text-muted-foreground">{jobsError}</Text>
          <Button variant="outline" onPress={() => fetchJobs(true)}><Text>Try again</Text></Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <JobList
        onJobPress={(job) => handlePress(ROUTES.JOB_DETAIL, { id: job.id })}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
};

export default DashboardScreen;
