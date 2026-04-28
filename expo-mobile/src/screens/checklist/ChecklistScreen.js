import React, { useEffect } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import ChecklistHeader from "../../components/checklist/ChecklistHeader";
import ChecklistItem from "../../components/checklist/ChecklistItem";
import ChecklistStats from "../../components/checklist/ChecklistStats";
import ChecklistDocumentUpload from "../../components/checklist/ChecklistDocumentUpload";
import UnsavedChangesBar from "../../components/checklist/UnsavedChangesBar";
import Loader from "../../components/common/Loader";
import ErrorAlert from "../../components/common/ErrorAlert";
import EmptyState from "../../components/common/EmptyState";
import useChecklistStore from "../../store/checklistStore";
import { useTheme } from "../../hooks/useTheme";
import Ionicons from "@react-native-vector-icons/ionicons";
import { ROUTES } from "../../util/constants";

const ChecklistScreen = ({ navigation, route }) => {
  const { jobId, checklistId } = route.params;
  const { colors } = useTheme();

  const checklist = useChecklistStore((state) => state.checklist);
  const items = useChecklistStore((state) => state.items);
  const isLoading = useChecklistStore((state) => state.isLoading);
  const error = useChecklistStore((state) => state.error);

  const fetchChecklist = useChecklistStore((state) => state.fetchChecklist);
  const resetStore = useChecklistStore((state) => state.resetStore);
  const invalidateChecklistCache = useChecklistStore((state) => state.invalidateChecklistCache);

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  useEffect(() => {
    fetchChecklist(Number(jobId), Number(checklistId));
    return () => {
      resetStore();
    };
  }, [jobId, checklistId]);

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRefreshing(true);
    invalidateChecklistCache(Number(jobId), Number(checklistId));
    await fetchChecklist(Number(jobId), Number(checklistId));
    setIsRefreshing(false);
  };

  if (isLoading) {
    return <Loader fullScreen text="Loading checklist..." />;
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 p-5">
          <ErrorAlert message={error} />
        </View>
      </SafeAreaView>
    );
  }

  if (!checklist) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">No checklist found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <UnsavedChangesBar />

        {/* Premium Header */}
        <View className="flex-row items-center gap-3 mb-6">
          <View className="flex-1">
            <Text
              className="text-xl font-extrabold text-foreground tracking-tight"
              numberOfLines={1}
            >
              {checklist.name}
            </Text>
          </View>
        </View>

        <ChecklistStats />

        <View
          className="mt-6 bg-surface rounded-[24px] overflow-hidden border border-border"
          style={colors.shadowSm}
        >
          <View className="px-5 bg-card border-b border-border flex-row items-center gap-2 py-3.5">
            <Ionicons name="list" size={18} color={colors.primary} />
            <Text className="text-base font-extrabold text-foreground">
              Task Items
            </Text>
          </View>

          <View className="p-2.5">
            {items.length ? (
              items.map((item) => (
                <ChecklistItem key={String(item.id)} item={item} />
              ))
            ) : (
              <EmptyState
                icon="checkbox-outline"
                title="No checklist items"
                subtitle="Items for this checklist will appear here once assigned"
                style={{ marginTop: 8 }}
              />
            )}
          </View>
        </View>

        {/* Checklist Document Upload Section */}
        <ChecklistDocumentUpload checklistId={Number(checklistId)} jobId={Number(jobId)} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ChecklistScreen;
