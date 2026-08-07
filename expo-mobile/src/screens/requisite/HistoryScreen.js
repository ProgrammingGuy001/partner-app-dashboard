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
import { Notice } from "../../components/common/Primitives";
import { bomAPI } from "../../api/bomApi";
import { useToast } from "../../hooks/useToast";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { formatters } from "../../util/formatters";

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
  const [updatingId, setUpdatingId] = useState(null);
  const [historyLimit, setHistoryLimit] = useState(100);
  const [loadingMore, setLoadingMore] = useState(false);

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

  const runAction = async (id, action, successMessage) => {
    setUpdatingId(id);
    try {
      await action();
      await fetchHistory(true);
      toast.success(successMessage);
    } catch (err) {
      toast.error(err?.message || 'Could not update requisite');
    } finally {
      setUpdatingId(null);
    }
  };

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (!isRefresh && historyLimit === 100) setLoading(true);
    setError("");
    try {
      const data = await bomAPI.getHistory(historyLimit, 0);
      setHistory(data);
    } catch (err) {
      setError(err.message || "Failed to fetch history");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [historyLimit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

  const getRepairOrderName = useCallback(
    (item) => item.odoo_repair_order_name || item.repair_reference || item.sales_order,
    []
  );

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const repairOrderName = getRepairOrderName(item);
      const matchesSearch =
        repairOrderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sales_order?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sr_poc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.do_number?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [getRepairOrderName, history, searchTerm, statusFilter]);

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
        contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 120 }}
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
        <View className="flex-row items-center gap-3 pt-4 mb-6">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
            style={colors.shadowSm}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xs font-bold text-muted-foreground uppercase">
              REQUISITE
            </Text>
            <Text className="text-xl font-extrabold text-foreground">
              History
            </Text>
          </View>
        </View>

        {/* Filters Card */}
        <View
          className="bg-surface rounded-2xl p-5 mb-6 border border-border"
          style={colors.shadowMd}
        >
          <View className="gap-2 mb-5">
            <Text className="text-xs font-bold text-muted-foreground uppercase">
              Search
            </Text>
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="RO, SO or POC Name"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Search requisite history"
              className="h-12 rounded-xl bg-background border border-border px-4 text-base font-semibold text-foreground"
            />
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold text-muted-foreground uppercase">
              Status
            </Text>
            <View className="flex-row gap-2.5">
              {statusOptions.map((option) => {
                const active = statusFilter === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setStatusFilter(option.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${option.label}`}
                    accessibilityState={{ selected: active }}
                    className={`px-4 py-2.5 rounded-xl border ${
                      active
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={`text-[13px] font-bold ${
                        active ? "text-primary-foreground" : "text-muted-foreground"
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
          <View className="mb-4 gap-2">
            <Notice tone="danger" message={error} />
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={refreshing}
              accessibilityRole="button"
              accessibilityLabel="Retry loading requisite history"
              accessibilityState={{ disabled: refreshing, busy: refreshing }}
              className="min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4"
            >
              <Text className="text-sm font-bold text-primary">{refreshing ? "Retrying…" : "Retry"}</Text>
            </TouchableOpacity>
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
              const repairOrderName = getRepairOrderName(item);
              return (
                <View
                  key={item.id}
                  className="bg-surface rounded-2xl border border-border overflow-hidden"
                  style={colors.shadowSm}
                >
                  <Pressable
                    onPress={() => toggleExpand(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Toggle requisite ${repairOrderName}`}
                    accessibilityState={{ expanded }}
                    className="p-4 flex-row items-center justify-between"
                  >
                    <View className="flex-1 gap-1">
                      <Text className="text-base font-extrabold text-foreground">
                        {repairOrderName}
                      </Text>
                      {repairOrderName !== item.sales_order ? (
                        <Text className="text-xs text-muted-foreground font-semibold">
                          SO: {item.sales_order}
                        </Text>
                      ) : null}
                      <View className="flex-row gap-3">
                        <Text className="text-xs text-muted-foreground font-semibold">
                          POC: {item.sr_poc || "N/A"}
                        </Text>
                        <Text className="text-xs text-muted-foreground font-semibold">
                          Items: {item.site_requisites?.length || 0}
                        </Text>
                      </View>
                      <Text className="text-xs text-muted-foreground font-semibold">
                        Created: {formatters.dateTime(item.created_date) || "N/A"}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity
                        onPress={(event) => {
                          event.stopPropagation();
                          handleDownload(item.id, item.sales_order);
                        }}
                        disabled={downloadingId === item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Download repair order for ${repairOrderName}`}
                        accessibilityState={{ disabled: downloadingId === item.id, busy: downloadingId === item.id }}
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
                    <View className="gap-2 rounded-xl border border-border bg-background p-3">
                      <Text className="text-[11px] font-bold uppercase text-muted-foreground">Odoo sync</Text>
                      <Text className={`text-sm font-bold ${item.odoo_sync_status === 'failed' ? 'text-destructive' : 'text-foreground'}`}>
                        {item.odoo_sync_status}
                      </Text>
                      {item.odoo_sync_error ? <Text className="text-xs text-destructive">{item.odoo_sync_error}</Text> : null}
                      <View className="flex-row flex-wrap gap-2">
                        {item.odoo_sync_status === 'failed' ? (
                          <TouchableOpacity
                            disabled={updatingId === item.id}
                            onPress={() => runAction(item.id, () => bomAPI.retrySync(item.id), 'Odoo sync retried')}
                            className="min-h-11 flex-row items-center justify-center gap-1 rounded-xl border border-border px-3"
                            style={{ opacity: updatingId === item.id ? 0.5 : 1 }}
                          >
                            <Ionicons name="refresh" size={15} color={colors.primary} />
                            <Text className="text-xs font-bold text-primary">Retry sync</Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          disabled={updatingId === item.id}
                          onPress={() => runAction(
                            item.id,
                            () => bomAPI.updateStatus(item.id, item.status === 'completed' ? 'pending' : 'completed'),
                            item.status === 'completed' ? 'Requisite reopened' : 'Requisite completed',
                          )}
                          className="min-h-11 items-center justify-center rounded-xl border border-border px-3"
                          style={{ opacity: updatingId === item.id ? 0.5 : 1 }}
                        >
                          <Text className="text-xs font-bold text-primary">{item.status === 'completed' ? 'Reopen' : 'Mark completed'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {expanded && (
                    <View className="p-4 border-t border-background bg-background/50 gap-2.5">
                      <View className="flex-row flex-wrap gap-2">
                        {[
                          ["Customer", item.customer_name],
                          ["Project", item.project_name],
                          ["Cabinet", item.cabinet_position],
                          ["SO POC", item.so_poc],
                          ["SO Status", item.so_status],
                          ["Expected Delivery", formatters.date(item.expected_delivery)],
                          ["DO Number", item.do_number],
                          ["Repair Status", item.odoo_repair_order_state],
                          ["Closed", formatters.dateTime(item.closed_date)],
                          ["Delivery Address", item.delivery_address],
                        ].map(([label, value]) => (
                          <View key={label} className="min-w-[47%] flex-1 rounded-xl border border-border bg-surface p-3">
                            <Text className="text-[10px] font-bold uppercase text-muted-foreground">{label}</Text>
                            <Text className="mt-1 text-xs font-semibold text-foreground">{value || "N/A"}</Text>
                          </View>
                        ))}
                      </View>

                      <Text className="mt-2 text-xs font-extrabold uppercase text-muted-foreground">
                        Requisite Items
                      </Text>
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
                                {req.component_status ? (
                                  <View className="px-2 py-0.5 rounded-lg bg-muted">
                                    <Text className="text-[10px] font-bold capitalize text-foreground">
                                      {req.component_status}
                                    </Text>
                                  </View>
                                ) : null}
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
            {history.length === historyLimit ? (
              <TouchableOpacity
                onPress={() => {
                  setLoadingMore(true);
                  setHistoryLimit((current) => current + 100);
                }}
                disabled={loadingMore}
                accessibilityRole="button"
                accessibilityLabel="Load more requisite history"
                accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
                className="min-h-12 items-center justify-center rounded-xl border border-border bg-surface px-4"
                style={{ opacity: loadingMore ? 0.6 : 1 }}
              >
                <Text className="text-sm font-bold text-primary">
                  {loadingMore ? "Loading…" : "Load 100 more"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default HistoryScreen;
