import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button, Text } from "@/components/ui";
import ScreenHeader from "../../components/common/ScreenHeader";
import Loader from "../../components/common/Loader";
import EmptyState from "../../components/common/EmptyState";
import { Notice } from "../../components/common/Primitives";
import { grnApi } from "../../api/grnApi";
import { getApiErrorMessage } from "../../api/apiErrors";
import { useTheme } from "../../hooks/useTheme";
import { radii, spacing, typography } from "../../theme/designSystem";

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

const SiteGRNScreen = ({ route }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [grns, setGrns] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [received, setReceived] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const grn = selectedId ? grns.find((item) => item.id === selectedId) || null : null;
  const submitted = grn?.status === "submitted";

  const fetchGRN = useCallback(async () => {
    try {
      const data = await grnApi.getAssigned();
      const list = asGRNList(data);
      const requestedJobId = Number(route.params?.jobId);
      const requestedGRN = Number.isInteger(requestedJobId)
        ? list.find((item) => item.job_id === requestedJobId)
        : null;
      setGrns(list);
      setSelectedId((currentId) => {
        if (requestedGRN) return requestedGRN.id;
        if (currentId && list.some((item) => item.id === currentId)) {
          return currentId;
        }
        return list.length === 1 ? list[0].id : null;
      });
      setError("");
    } catch (err) {
      if (err?.status === 404 || err?.response?.status === 404) {
        setError("No pending GRN is assigned to you.");
      } else {
        setError(getApiErrorMessage(err));
      }
    }
  }, [route.params?.jobId]);

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
    setSubmitError("");
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
      setSubmitError(getApiErrorMessage(err));
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
            padding: spacing.lg,
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
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 3 }}
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
                  width: spacing.xl + spacing.sm,
                  height: spacing.xl + spacing.sm,
                  borderRadius: radii.lg,
                  backgroundColor: colors.primaryLight,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="cube-outline" size={24} color={colors.primary} />
              </View>
            }
          />

          {error ? <Notice tone="warning" title="Showing saved GRNs" message={error} className="mb-4" /> : null}

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
                <Button
                  variant="outline"
                  key={item.id}
                  onPress={() => setSelectedId(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open GRN ${item.odoo_picking_name || item.source_document}`}
                  className="mb-3 h-auto w-full flex-row justify-between gap-3 rounded-2xl bg-card p-4"
                  style={colors.shadowSm}
                >
                  <View
                    className="bg-warning-muted"
                    style={{
                      width: spacing.xl + spacing.sm,
                      height: spacing.xl + spacing.sm,
                      borderRadius: radii.lg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="time-outline" size={typography.title2.fontSize} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: spacing.xxs }}>
                    <Text
                      numberOfLines={1}
                      style={[typography.callout, { color: colors.text }]}
                    >
                      {item.odoo_picking_name || item.source_document}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[typography.caption, { color: colors.textMuted }]}
                    >
                      {item.source_document} · {packageCount} package{packageCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={typography.title3.fontSize} color={colors.textMuted} />
                </Button>
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
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 7 }}
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
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setSelectedId(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to all GRNs"
            className="mb-4 self-start"
          >
            <Ionicons name="chevron-back" size={typography.title3.fontSize} color={colors.primary} />
            <Text>All GRNs</Text>
          </Button>
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
                width: spacing.xl + spacing.sm,
                height: spacing.xl + spacing.sm,
                borderRadius: radii.lg,
                backgroundColor: colors.primaryLight,
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

        {grn.odoo_sync_error ? (
          <Notice
            tone="danger"
            title="Odoo sync failed"
            message={grn.odoo_sync_error}
            className="mb-4"
          />
        ) : null}

        {error ? (
          <Notice tone="warning" title="Showing saved GRN details" message={error} className="mb-4" />
        ) : null}

        {submitError ? (
          <Notice tone="danger" title="GRN not submitted" message={submitError} className="mb-4" />
        ) : null}

        {/* Progress */}
        {grn && (
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-bold text-foreground">
                Packages
              </Text>
              <Text style={{ fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }} className="font-semibold text-muted-foreground">
                {receivedCount} / {grn.packages.length} received
              </Text>
            </View>
            <View className="h-2 bg-muted rounded-full overflow-hidden">
              <View
                style={{
                  height: spacing.xs,
                  width: `${grn.packages.length ? (receivedCount / grn.packages.length) * 100 : 0}%`,
                  backgroundColor: colors.success,
                  borderRadius: radii.pill,
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
              <Button
                variant="outline"
                key={pkg.id}
                onPress={() => toggle(pkg.id)}
                disabled={submitted}
                accessibilityRole="checkbox"
                accessibilityLabel={pkg.package_name}
                accessibilityState={{
                  checked: isReceived,
                  disabled: submitted,
                }}
                className={`mb-2.5 h-auto w-full flex-row justify-between p-4 ${isReceived ? "border-success bg-success-muted" : "border-border bg-surface"}`}
                style={{
                  borderColor: isReceived ? colors.success : colors.border,
                  ...colors.shadowSm,
                }}
              >
                <View
                  style={{
                    width: typography.title1.fontSize,
                    height: typography.title1.fontSize,
                    borderRadius: radii.pill,
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
                      size={typography.body.fontSize}
                      color={colors.background}
                    />
                  )}
                </View>
                <Text
                  style={{
                    flex: 1,
                    ...typography.caption,
                    color: isReceived ? colors.success : colors.text,
                  }}
                >
                  {pkg.package_name}
                </Text>
                {!isReceived && !submitted && (
                  <Text style={[typography.micro, { color: colors.textMuted }]}>
                    Tap
                  </Text>
                )}
              </Button>
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
            padding: spacing.md,
            paddingBottom: insets.bottom + spacing.xl * 3,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Button
            onPress={handleSubmit}
            loading={submitting}
            accessibilityRole="button"
            accessibilityLabel="Submit GRN"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            <Ionicons name="clipboard-outline" size={typography.title3.fontSize} color={colors.primaryForeground} />
            <Text>Submit GRN</Text>
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
};

export default SiteGRNScreen;
