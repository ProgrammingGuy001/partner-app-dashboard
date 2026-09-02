import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  RefreshControl,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import EmptyState, { SkeletonList } from "../../components/common/EmptyState";
import { Card, IconButton, Notice, StatusBadge } from "../../components/common/Primitives";
import { bomAPI } from "../../api/bomApi";
import { useToast } from "../../hooks/useToast";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { formatters } from "../../util/formatters";
import ScreenHeader from '../../components/common/ScreenHeader';
import { getApiErrorMessage } from '../../api/apiErrors';
import { spacing, typography } from '../../theme/designSystem';

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
      toast.error(getApiErrorMessage(err));
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
      toast.error(getApiErrorMessage(err));
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
      setError(getApiErrorMessage(err));
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
        contentContainerStyle={{ paddingHorizontal: px, paddingBottom: spacing.xl * 4 }}
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
        <ScreenHeader eyebrow="Requisite" title="History" subtitle="Submitted site requisites" />
        <IconButton icon="arrow-back" label="Go back" onPress={() => navigation.goBack()} className="mb-4" />

        {/* Filters Card */}
        <Card elevated className="mb-6">
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
                  <Button
                    variant={active ? "default" : "outline"}
                    size="sm"
                    key={option.value}
                    onPress={() => setStatusFilter(option.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${option.label}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text>{option.label}</Text>
                  </Button>
                );
              })}
            </View>
          </View>
        </Card>

        {error ? (
          <View className="mb-4 gap-2">
            <Notice tone={history.length ? "warning" : "danger"} title={history.length ? "Showing saved history" : "History unavailable"} message={error} />
            <Button
              variant="outline"
              onPress={handleRefresh}
              loading={refreshing}
              accessibilityRole="button"
              accessibilityLabel="Retry loading requisite history"
              accessibilityState={{ disabled: refreshing, busy: refreshing }}
            >
              <Text>Retry</Text>
            </Button>
          </View>
        ) : null}

        {!filteredHistory.length ? (
          <View className="py-16">
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
                <Card
                  padded={false}
                  key={item.id}
                  className="overflow-hidden"
                >
                  <View
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
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={(event) => {
                          event.stopPropagation();
                          handleDownload(item.id, item.sales_order);
                        }}
                        disabled={downloadingId === item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Download repair order for ${repairOrderName}`}
                        accessibilityState={{ disabled: downloadingId === item.id, busy: downloadingId === item.id }}
                      >
                        <Ionicons
                          name={downloadingId === item.id ? "hourglass-outline" : "download-outline"}
                          size={typography.caption.fontSize}
                          color={colors.primary}
                        />
                        <Text>RO</Text>
                      </Button>
                      <IconButton
                        icon={expanded ? "chevron-up" : "chevron-down"}
                        label={`${expanded ? "Collapse" : "Expand"} requisite ${repairOrderName}`}
                        onPress={() => toggleExpand(item.id)}
                      />
                    </View>
                  </View>

                  <View className="p-4 border-t border-background gap-3">
                    <View className="flex-row items-center gap-1.5">
                      <Text style={typography.captionStrong} className="text-muted-foreground">
                        STATUS
                      </Text>
                      <StatusBadge label={item.status} tone={item.status === "completed" ? "success" : "warning"} />
                    </View>
                    <View className="gap-2 rounded-xl border border-border bg-background p-3">
                      <Text style={typography.micro} className="uppercase text-muted-foreground">Odoo sync</Text>
                      <Text className={`text-sm font-bold ${item.odoo_sync_status === 'failed' ? 'text-destructive' : 'text-foreground'}`}>
                        {item.odoo_sync_status}
                      </Text>
                      {item.odoo_sync_error ? <Text className="text-xs text-destructive">{item.odoo_sync_error}</Text> : null}
                      <View className="flex-row flex-wrap gap-2">
                        {item.odoo_sync_status === 'failed' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingId === item.id}
                            onPress={() => runAction(item.id, () => bomAPI.retrySync(item.id), 'Odoo sync retried')}
                          >
                            <Ionicons name="refresh" size={15} color={colors.primary} />
                            <Text>Retry sync</Text>
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingId === item.id}
                          onPress={() => runAction(
                            item.id,
                            () => bomAPI.updateStatus(item.id, item.status === 'completed' ? 'pending' : 'completed'),
                            item.status === 'completed' ? 'Requisite reopened' : 'Requisite completed',
                          )}
                        >
                          <Text>{item.status === 'completed' ? 'Reopen' : 'Mark completed'}</Text>
                        </Button>
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
                          <View key={label} className="basis-2/5 flex-1 rounded-xl border border-border bg-surface p-3">
                            <Text style={typography.micro} className="uppercase text-muted-foreground">{label}</Text>
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
                                  <StatusBadge label={req.responsible_department} tone="primary" />
                                )}
                                {req.component_status ? (
                                  <StatusBadge label={req.component_status} />
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
                        <Text style={typography.caption} className="text-center text-muted-foreground py-2.5">
                          No line items found.
                        </Text>
                      )}
                    </View>
                  )}
                </Card>
              );
            })}
            {history.length === historyLimit ? (
              <Button
                variant="outline"
                onPress={() => {
                  setLoadingMore(true);
                  setHistoryLimit((current) => current + 100);
                }}
                loading={loadingMore}
                accessibilityRole="button"
                accessibilityLabel="Load more requisite history"
                accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
              >
                <Text>Load 100 more</Text>
              </Button>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default HistoryScreen;
