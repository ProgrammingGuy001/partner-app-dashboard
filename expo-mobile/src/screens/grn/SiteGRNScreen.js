import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui/text";
import ScreenHeader from "../../components/common/ScreenHeader";
import Loader from "../../components/common/Loader";
import EmptyState from "../../components/common/EmptyState";
import { Notice } from "../../components/common/Primitives";
import { grnApi } from "../../api/grnApi";
import { useTheme } from "../../hooks/useTheme";

const asGRNList = (data) => {
  if (Array.isArray(data)) return data;
  return data ? [data] : [];
};

const receivedMapFor = (grn) => {
  const initial = {};
  grn?.packages?.forEach((p) => {
    initial[p.id] = p.is_received;
  });
  return initial;
};

const SiteGRNScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const onPrimary = colors.primaryForeground;
  const [grns, setGrns] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [received, setReceived] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const grn = selectedId ? grns.find((item) => item.id === selectedId) || null : null;
  const submitted = grn?.status === "submitted";

  const fetchGRN = useCallback(async () => {
    try {
      const data = await grnApi.getAssigned();
      const list = asGRNList(data);
      setGrns(list);
      setSelectedId((currentId) => {
        if (currentId && list.some((item) => item.id === currentId)) {
          return currentId;
        }
        return list.length === 1 ? list[0].id : null;
      });
      setError("");
    } catch (err) {
      setGrns([]);
      setSelectedId(null);
      if (err?.response?.status === 404) {
        setError("No pending GRN is assigned to you.");
      } else {
        setError("Failed to load GRN. Pull down to retry.");
      }
    }
  }, []);

  useEffect(() => {
    fetchGRN().finally(() => setLoading(false));
  }, [fetchGRN]);

  useEffect(() => {
    setReceived(receivedMapFor(grn));
  }, [grn]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGRN();
    setRefreshing(false);
  };

  const toggle = (pkgId) => {
    if (submitted) return;
    setReceived((prev) => ({ ...prev, [pkgId]: !prev[pkgId] }));
  };

  const doSubmit = async () => {
    if (!grn?.packages) return;
    setSubmitting(true);
    try {
      const packages = grn.packages.map((p) => ({
        package_id: p.id,
        is_received: received[p.id] ?? false,
      }));
      const updated = await grnApi.submit(grn.id, packages);
      setGrns((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedId(updated.id);
      setReceived(receivedMapFor(updated));
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.detail || "Submission failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!grn?.packages) return;
    const missing = grn.packages.filter((p) => !received[p.id]);
    if (missing.length > 0) {
      Alert.alert(
        "Missing Packages",
        `${missing.length} package${missing.length !== 1 ? "s" : ""} not marked as received.\n\nSubmitting will alert your supervisor. Continue?`,
        [
          { text: "Go Back", style: "cancel" },
          { text: "Submit Anyway", style: "destructive", onPress: doSubmit },
        ],
      );
    } else {
      Alert.alert(
        "Submit GRN",
        "All packages marked as received. Submit now?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Submit", onPress: doSubmit },
        ],
      );
    }
  };

  if (loading) {
    return <Loader fullScreen text="Loading GRN..." />;
  }

  if (error && grns.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <EmptyState
            icon="cube-outline"
            title="No GRN available"
            subtitle={error}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!grn) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <ScreenHeader
            eyebrow="Goods Receipt"
            title="Site GRN"
            subtitle={`${grns.length} pending deliver${grns.length === 1 ? "y" : "ies"}`}
            right={
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: colors.primary + "18",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="cube-outline" size={24} color={colors.primary} />
              </View>
            }
          />

          {grns.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="No GRN available"
              subtitle="No pending GRN is assigned to you."
            />
          ) : (
            grns.map((item) => {
              const packageCount = item.packages?.length || 0;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setSelectedId(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open GRN ${item.odoo_picking_name || item.source_document}`}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    padding: 16,
                    borderRadius: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    ...colors.shadowSm,
                  }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      backgroundColor: colors.warning + "16",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="time-outline" size={22} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text
                      numberOfLines={1}
                      style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}
                    >
                      {item.odoo_picking_name || item.source_document}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: colors.textMuted, fontSize: 12 }}
                    >
                      {item.source_document} · {packageCount} package{packageCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const receivedCount = grn?.packages
    ? grn.packages.filter((p) => received[p.id]).length
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 200 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {grns.length > 1 && (
          <TouchableOpacity
            onPress={() => setSelectedId(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to all GRNs"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 14,
              alignSelf: "flex-start",
            }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "700" }}>
              All GRNs
            </Text>
          </TouchableOpacity>
        )}

        {/* Header */}
        <ScreenHeader
          eyebrow="Goods Receipt"
          title="Site GRN"
          subtitle={
            grn.odoo_picking_name && grn.odoo_picking_name !== grn.source_document
              ? `${grn.source_document} · ${grn.odoo_picking_name}`
              : grn.source_document
          }
          right={
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: colors.primary + "18",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="cube-outline" size={24} color={colors.primary} />
            </View>
          }
        />

        {/* Submitted status */}
        {submitted && (
          <Notice
            tone={grn.has_missing ? "danger" : "success"}
            title={
              grn.has_missing
                ? "Submitted with missing packages"
                : "All packages received"
            }
            message={
              grn.submitted_at
                ? new Date(grn.submitted_at).toLocaleString()
                : undefined
            }
            className="mb-4"
          />
        )}

        {/* Progress */}
        {grn && (
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-bold text-foreground">
                Packages
              </Text>
              <Text className="text-[13px] font-semibold text-muted-foreground">
                {receivedCount} / {grn.packages.length} received
              </Text>
            </View>
            <View className="h-2 bg-muted rounded-full overflow-hidden">
              <View
                style={{
                  height: 8,
                  width: `${grn.packages.length ? (receivedCount / grn.packages.length) * 100 : 0}%`,
                  backgroundColor: colors.success,
                  borderRadius: 999,
                }}
              />
            </View>
          </View>
        )}

        {/* Package list */}
        {grn &&
          grn.packages.map((pkg) => {
            const isReceived = received[pkg.id] ?? false;
            return (
              <TouchableOpacity
                key={pkg.id}
                onPress={() => toggle(pkg.id)}
                disabled={submitted}
                accessibilityRole="checkbox"
                accessibilityLabel={pkg.package_name}
                accessibilityState={{
                  checked: isReceived,
                  disabled: submitted,
                }}
                activeOpacity={submitted ? 1 : 0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 10,
                  borderWidth: 1.5,
                  borderColor: isReceived ? colors.success : colors.border,
                  backgroundColor: isReceived
                    ? colors.success + "14"
                    : colors.surface,
                  ...colors.shadowSm,
                }}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    borderWidth: 2,
                    borderColor: isReceived ? colors.success : colors.border,
                    backgroundColor: isReceived
                      ? colors.success
                      : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isReceived && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={colors.background}
                    />
                  )}
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: "500",
                    color: isReceived ? colors.success : colors.text,
                  }}
                >
                  {pkg.package_name}
                </Text>
                {!isReceived && !submitted && (
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    Tap
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {/* Submit button */}
      {!submitted && grn && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: 20,
            paddingBottom: insets.bottom + 90,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Submit GRN"
            accessibilityState={{ disabled: submitting, busy: submitting }}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={onPrimary} />
            ) : (
              <Ionicons name="clipboard-outline" size={20} color={onPrimary} />
            )}
            <Text style={{ color: onPrimary, fontWeight: "700", fontSize: 16 }}>
              {submitting ? "Submitting..." : "Submit GRN"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default SiteGRNScreen;
