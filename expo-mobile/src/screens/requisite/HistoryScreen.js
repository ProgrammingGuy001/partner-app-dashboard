import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Pressable,
  RefreshControl,
  TextInput,
  View,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/text";
import EmptyState, { SkeletonList } from "../../components/common/EmptyState";
import { bomAPI } from "../../api/bomApi";
import { useToast } from "../../hooks/useToast";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";

const HistoryScreen = ({ navigation }) => {
  const toast = useToast();
  const { px } = useResponsive();
  const { colors } = useTheme();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownload = async (id, salesOrder) => {
    setDownloadingId(id);
    try {
      await bomAPI.downloadRepairOrder(id, salesOrder);
    } catch (err) {
      toast.error(err?.message || 'Failed to download repair order');
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError("");
    try {
      const data = await bomAPI.getHistory(100, 0);
      setHistory(data);
    } catch (err) {
      setError(err.message || "Failed to fetch history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchHistory(true);
  }, [fetchHistory]);

  const toggleExpand = useCallback((id) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        item.sales_order?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sr_poc?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [history, searchTerm, statusFilter]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="pt-5" style={{ paddingHorizontal: px }}>
          <SkeletonList rows={5} />
        </View>
      </SafeAreaView>
    );
  }

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
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
        <View className="flex-row items-center gap-3 pt-4 mb-6">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
            style={colors.shadowSm}
          >
            <Ionicons name="arrow-back" size={20} color="#352822" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              REQUISITE
            </Text>
            <Text className="text-xl font-extrabold text-foreground tracking-tight">
              History
            </Text>
          </View>
        </View>

        {/* Filters Card */}
        <View
          className="bg-surface rounded-3xl p-5 mb-6 border border-border"
          style={colors.shadowMd}
        >
          <View className="gap-2 mb-5">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Search
            </Text>
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="SO-XXXXX or POC Name"
              placeholderTextColor="#9a8b84"
              className="h-[52px] rounded-xl bg-background border border-border px-4 text-base font-semibold text-foreground"
            />
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Status
            </Text>
            <View className="flex-row gap-2.5">
              {statusOptions.map((option) => {
                const active = statusFilter === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setStatusFilter(option.value)}
                    className={`px-4 py-2.5 rounded-xl border ${
                      active
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={`text-[13px] font-bold ${
                        active ? "text-white" : "text-muted-foreground"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {error ? (
          <View className="flex-row items-center gap-1.5 mb-4 p-3 bg-danger-muted rounded-[10px] border border-danger-muted/20">
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text className="text-danger text-[13px] font-semibold">
              {error}
            </Text>
          </View>
        ) : null}

        {!filteredHistory.length ? (
          <View className="py-[60px]">
            <EmptyState
              icon={
                searchTerm || statusFilter !== "all"
                  ? "search-outline"
                  : "receipt-outline"
              }
              title={
                searchTerm || statusFilter !== "all"
                  ? "No results found"
                  : "No history yet"
              }
              subtitle={
                searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search or filters."
                  : "Your submitted requisites will appear here."
              }
            />
          </View>
        ) : (
          <View className="gap-4">
            {filteredHistory.map((item) => {
              const expanded = expandedItems.has(item.id);
              return (
                <View
                  key={item.id}
                  className="bg-surface rounded-2xl border border-border overflow-hidden"
                  style={colors.shadowSm}
                >
                  <Pressable
                    onPress={() => toggleExpand(item.id)}
                    className="p-4 flex-row items-center justify-between"
                  >
                    <View className="flex-1 gap-1">
                      <Text className="text-base font-extrabold text-foreground">
                        {item.sales_order}
                      </Text>
                      <View className="flex-row gap-3">
                        <Text className="text-xs text-muted-foreground font-semibold">
                          POC: {item.sr_poc || "N/A"}
                        </Text>
                        <Text className="text-xs text-muted-foreground font-semibold">
                          Items: {item.site_requisites?.length || 0}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity
                        onPress={() => handleDownload(item.id, item.sales_order)}
                        disabled={downloadingId === item.id}
                        className="h-8 px-3 rounded-xl flex-row items-center gap-1 border border-border bg-background"
                        style={{ opacity: downloadingId === item.id ? 0.5 : 1 }}
                      >
                        <Ionicons
                          name={downloadingId === item.id ? "hourglass-outline" : "download-outline"}
                          size={14}
                          color={colors.primary}
                        />
                        <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                          RO
                        </Text>
                      </TouchableOpacity>
                      <View className="w-8 h-8 rounded-2xl bg-background items-center justify-center">
                        <Ionicons
                          name={expanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                    </View>
                  </Pressable>

                  <View className="p-4 border-t border-background gap-3">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-[12px] font-bold text-muted-foreground">
                        STATUS
                      </Text>
                      <View
                        className="px-2 py-1 rounded-lg"
                        style={{
                          backgroundColor:
                            item.status === "completed"
                              ? colors.success + "15"
                              : colors.warning + "15",
                        }}
                      >
                        <Text
                          className="text-[10px] font-extrabold uppercase"
                          style={{
                            color:
                              item.status === "completed"
                                ? colors.success
                                : colors.warning,
                          }}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {expanded && (
                    <View className="p-4 border-t border-background bg-background/50 gap-2.5">
                      {item.site_requisites?.length ? (
                        item.site_requisites.map((req, index) => (
                          <View
                            key={req.id || `${req.product_name}-${index}`}
                            className="p-3 bg-surface rounded-2xl border border-border"
                          >
                            <Text className="text-sm font-bold text-foreground">
                              {index + 1}. {req.product_name}
                            </Text>
                            <View className="mt-2 gap-1">
                              <View className="flex-row items-center gap-3 flex-wrap">
                                <Text className="text-xs text-muted-foreground">
                                  <Text className="font-bold">Qty:</Text>{" "}
                                  {req.quantity}
                                </Text>
                                {req.responsible_department && (
                                  <View
                                    className="px-2 py-0.5 rounded-lg"
                                    style={{ backgroundColor: colors.primary + '20' }}
                                  >
                                    <Text
                                      className="text-[10px] font-bold capitalize"
                                      style={{ color: colors.primary }}
                                    >
                                      {req.responsible_department}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text className="text-xs text-muted-foreground">
                                <Text className="font-bold">Issue:</Text>{" "}
                                {req.issue_description || "N/A"}
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text className="text-center text-muted-foreground text-[13px] py-2.5">
                          No line items found.
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default HistoryScreen;
