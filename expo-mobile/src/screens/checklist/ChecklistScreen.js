import React, { useEffect } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import ChecklistItem from "../../components/checklist/ChecklistItem";
import ChecklistStats from "../../components/checklist/ChecklistStats";
import ChecklistDocumentUpload from "../../components/checklist/ChecklistDocumentUpload";
import UnsavedChangesBar from "../../components/checklist/UnsavedChangesBar";
import Loader from "../../components/common/Loader";
import EmptyState from "../../components/common/EmptyState";
import ScreenHeader from "../../components/common/ScreenHeader";
import { Card, Notice } from "../../components/common/Primitives";
import { Button } from "@/components/ui/button";
import useChecklistStore from "../../store/checklistStore";
import { useTheme } from "../../hooks/useTheme";
import Ionicons from "@react-native-vector-icons/ionicons";
import { checklistApi } from "../../api/checklistApi";
import { getApiErrorMessage } from "../../api/apiErrors";
import { spacing } from "../../theme/designSystem";

const ChecklistScreen = ({ navigation, route }) => {
  const { jobId, checklistId } = route.params;
  const { colors } = useTheme();

  const checklist = useChecklistStore((state) => state.checklist);
  const items = useChecklistStore((state) => state.items);
  const isLoading = useChecklistStore((state) => state.isLoading);
  const error = useChecklistStore((state) => state.error);
  const warning = useChecklistStore((state) => state.warning);

  const fetchChecklist = useChecklistStore((state) => state.fetchChecklist);
  const resetStore = useChecklistStore((state) => state.resetStore);
  const invalidateChecklistCache = useChecklistStore((state) => state.invalidateChecklistCache);

  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await checklistApi.exportChecklist(Number(jobId), Number(checklistId));
    } catch (err) {
      Alert.alert("Export failed", getApiErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchChecklist(Number(jobId), Number(checklistId)).catch(() => {});
    return () => {
      resetStore();
    };
  }, [jobId, checklistId]);

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsRefreshing(true);
    invalidateChecklistCache(Number(jobId), Number(checklistId));
    try {
      await fetchChecklist(Number(jobId), Number(checklistId));
    } catch {
      // The inline notice keeps the real API error visible with cached content.
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading && !checklist) {
    return <Loader fullScreen text="Loading checklist..." />;
  }

  if (error && !checklist) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 gap-4 p-5">
          <Notice tone="danger" title="Checklist unavailable" message={error} />
          <Button variant="outline" onPress={() => fetchChecklist(Number(jobId), Number(checklistId)).catch(() => {})}>
            <Text>Try again</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!checklist) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <EmptyState
            icon="checkbox-outline"
            title="No checklist found"
            subtitle="Pull to refresh or return to the job detail screen."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        contentInsetAdjustmentBehavior="automatic"
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

        <ScreenHeader
          eyebrow="Job checklist"
          title={checklist.name || "Checklist"}
          subtitle={checklist.description || "Complete every assigned item"}
          right={(
            <Button variant="outline" size="sm" loading={isExporting} onPress={handleExport} accessibilityLabel="Export checklist as PDF">
              <Ionicons name="download-outline" size={16} color={colors.primary} />
              <Text>PDF</Text>
            </Button>
          )}
          className="pt-0"
        />

        {(error || warning) ? <Notice tone={error ? "danger" : "warning"} title={error ? "Checklist update failed" : "Checklist partly updated"} message={error || warning} className="mb-4" /> : null}

        <ChecklistStats />
        <Card className="mt-6 overflow-hidden" padded={false}>
          <View className="px-5 bg-card border-b border-border flex-row items-center gap-2 py-3.5">
            <Ionicons name="list" size={18} color={colors.primary} />
            <Text className="text-base font-extrabold text-foreground">Task Items</Text>
          </View>
          <View className="p-2.5">
            {items.length ? (
              items.map((item) => <ChecklistItem key={String(item.id)} item={item} />)
            ) : (
              <View className="mt-2">
                <EmptyState
                  icon="checkbox-outline"
                  title="No checklist items"
                  subtitle="Items for this checklist will appear here once assigned"
                />
              </View>
            )}
          </View>
        </Card>

        {/* Checklist Document Upload Section */}
        <ChecklistDocumentUpload checklistId={Number(checklistId)} jobId={Number(jobId)} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ChecklistScreen;
