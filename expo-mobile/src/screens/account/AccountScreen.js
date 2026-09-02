import React, { useCallback, useState } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button, Text } from "@/components/ui";
import { getApiErrorMessage } from "../../api/apiErrors";
import EmptyState from "../../components/common/EmptyState";
import { Card, Notice, StatusBadge } from "../../components/common/Primitives";
import ScreenHeader from "../../components/common/ScreenHeader";
import UpdateChecker from "../../components/common/UpdateChecker";
import DeleteVerificationDataButton from "../../components/verification/DeleteVerificationDataButton";
import { useLogout } from "../../hooks/useLogout";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { useAuthStore } from "../../store/authStore";
import { spacing, typography } from "../../theme/designSystem";

const DETAIL_ROWS = [
  { label: "First name", key: "first_name", icon: "person-outline" },
  { label: "Last name", key: "last_name", icon: "person-outline" },
  { label: "City", key: "city", icon: "location-outline" },
  { label: "Pincode", key: "pincode", icon: "map-outline" },
];

const VERIFICATION_ITEMS = [
  { label: "PAN", key: "is_pan_verified" },
  { label: "Bank", key: "is_bank_details_verified" },
  { label: "Documents", key: "is_id_verified" },
];

const AccountScreen = () => {
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const { logout, loggingOut } = useLogout();
  const { px, isTablet, maxCardWidth } = useResponsive();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    setRefreshError("");
    try {
      await refreshProfile();
    } catch (error) {
      setRefreshError(getApiErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile]);

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const onPressLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: px,
          paddingBottom: spacing.xl,
          alignItems: isTablet ? "center" : "stretch",
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <View style={{ width: "100%", maxWidth: maxCardWidth ?? "100%" }}>
          <ScreenHeader eyebrow="Profile" title="Account" subtitle="Your details, verification status and app settings" />

          {refreshError ? (
            <Notice
              tone={user ? "warning" : "danger"}
              title={user ? "Showing saved account details" : "Account unavailable"}
              message={refreshError}
              className="mb-5"
            />
          ) : null}

          {!user ? (
            <Card>
              <EmptyState icon="person-outline" title="Account details unavailable" subtitle="Refresh to load your account details." />
              <Button onPress={handleRefresh} loading={refreshing} className="mt-4">Refresh account</Button>
            </Card>
          ) : (
            <>
              <Card elevated className="mb-5">
                <View className="flex-row items-center gap-4">
                  <View className="h-16 w-16 rounded-2xl bg-primary items-center justify-center">
                    <Text style={typography.title2} className="text-primary-foreground">{initials || "AU"}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text style={typography.title2} className="flex-1 text-foreground" numberOfLines={2}>{fullName || "Account user"}</Text>
                      {user.is_verified ? <Ionicons name="checkmark-circle" size={typography.title3.fontSize} color={colors.primary} /> : null}
                    </View>
                    <Text style={typography.caption} className="mt-1 text-muted-foreground">{user.phone_number || "Phone number unavailable"}</Text>
                  </View>
                </View>
              </Card>

              <Card className="mb-5">
                <Text style={typography.micro} className="mb-4 text-muted-foreground uppercase">Personal information</Text>
                <View className="gap-4">
                  {DETAIL_ROWS.map((row) => (
                    <View key={row.key} className="flex-row items-center gap-3">
                      <View className="h-9 w-9 rounded-xl bg-primary-light items-center justify-center">
                        <Ionicons name={row.icon} size={typography.title3.fontSize} color={colors.primary} />
                      </View>
                      <View className="flex-1">
                        <Text style={typography.micro} className="text-muted-foreground uppercase">{row.label}</Text>
                        <Text style={typography.callout} className="text-foreground">{user[row.key] || "Not provided"}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>

              <Card className="mb-5">
                <Text style={typography.micro} className="mb-4 text-muted-foreground uppercase">Verification status</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {VERIFICATION_ITEMS.map((item) => {
                    const verified = user[item.key] === true;
                    return (
                      <StatusBadge
                        key={item.key}
                        label={`${item.label}: ${verified ? "verified" : "pending"}`}
                        tone={verified ? "success" : "warning"}
                        icon={verified ? "checkmark-circle" : "time-outline"}
                      />
                    );
                  })}
                </View>
                <Notice
                  tone={user.is_verified ? "success" : "warning"}
                  title={user.is_verified ? "Account verified" : "Verification pending"}
                  message={user.is_verified ? "Your account is active." : "Your submitted details are still under review."}
                />
              </Card>

              <Card className="mb-5">
                <Text style={typography.micro} className="mb-4 text-muted-foreground uppercase">App updates</Text>
                <UpdateChecker />
              </Card>

              <Card className="mb-5">
                <Text style={typography.micro} className="mb-4 text-muted-foreground uppercase">Privacy</Text>
                <DeleteVerificationDataButton />
              </Card>

              <Button variant="destructive" onPress={onPressLogout} loading={loggingOut} accessibilityLabel="Logout account" className="mb-5">
                <Ionicons name="log-out-outline" size={typography.title3.fontSize} color={colors.primaryForeground} />
                Logout account
              </Button>
            </>
          )}

          <Text style={typography.caption} className="text-center text-muted-foreground">
            Version {require("../../../app.json").expo.version}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AccountScreen;
