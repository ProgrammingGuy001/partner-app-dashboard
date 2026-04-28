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
import EmptyState from "../../components/common/EmptyState";
import { Text } from "@/components/ui/text";
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

const formatDate = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const DashboardScreen = ({ navigation }) => {
  const toast = useToast();
  const { px, width } = useResponsive();
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
      if (isMountedRef.current) setJobs(fetched);
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
      <Animated.View
        entering={FadeInUp.duration(600)}
        className="flex-row justify-between items-center pt-4 pb-5"
      >
        <View>
          <Text className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
            {getGreeting()}
          </Text>
          <Text className="text-[22px] font-extrabold text-foreground tracking-tight">
            {firstName} 👋
          </Text>
        </View>
        <View className="flex-row gap-3 items-center">
          <TouchableOpacity
            onPress={() => handlePress(ROUTES.ACCOUNT)}
            className="w-11 h-11 rounded-full bg-primary items-center justify-center"
            style={colors.shadowSm}
            accessibilityRole="button"
            accessibilityLabel="Account Settings"
          >
            <Text className="text-primary-foreground text-base font-bold">
              {initials}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).duration(600)}>
        <StatsCards stats={stats} isInternal={user?.is_internal} />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).duration(600)} className="mt-4">
        <DailyAttendance />
      </Animated.View>

      {/* Job Queue section */}
      <Animated.View entering={FadeInUp.delay(700).duration(600)} className="mt-6">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-[17px] font-bold text-foreground">
            Ongoing Jobs
          </Text>
          <TouchableOpacity
            onPress={() =>
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }
          ></TouchableOpacity>
        </View>
        <JobFilters />
        {!loading && jobs.length === 0 ? (
          <EmptyState
            icon="briefcase-outline"
            title="No jobs yet"
            subtitle="Your assigned jobs will appear here"
            style={{ marginTop: 16 }}
          />
        ) : null}
      </Animated.View>
    </View>
  ), [firstName, handlePress, colors, initials, stats, user, loading, jobs.length]);

  useEffect(() => {
    fetchJobs();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 gap-3 pt-5" style={{ padding: px }}>
          <View className="h-12 w-full bg-muted rounded-xl mb-2" />
          <View className="flex-row gap-2.5">
            {[1, 2].map((i) => (
              <View key={i} className="flex-1 h-[100px] bg-muted rounded-[20px]" />
            ))}
          </View>
          <View className="flex-row gap-2.5">
            {[1, 2].map((i) => (
              <View key={i} className="flex-1 h-[100px] bg-muted rounded-[20px]" />
            ))}
          </View>
          <View className="h-5 w-[40%] bg-muted rounded mt-3" />
          {[1, 2, 3].map((i) => (
            <View key={i} className="h-[110px] bg-muted rounded-[20px]" />
          ))}
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
