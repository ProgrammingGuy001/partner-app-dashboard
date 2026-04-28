import React, { useState, useCallback } from "react";
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  TouchableOpacity,
  Switch,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useLogout } from "../../hooks/useLogout";
import { useAuthStore } from "../../store/authStore";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { logger } from "../../util/helpers";
import UpdateChecker from "../../components/common/UpdateChecker";

const DETAIL_ROWS = [
  { label: "First Name", key: "first_name", icon: "person-outline" },
  { label: "Last Name", key: "last_name", icon: "person-outline" },
  { label: "City", key: "city", icon: "location-outline" },
  { label: "Pincode", key: "pincode", icon: "map-outline" },
];

const VERIF_ITEMS = [
  { label: "PAN", key: "is_pan_verified", icon: "card-outline" },
  { label: "Bank", key: "is_bank_details_verified", icon: "wallet-outline" },
  { label: "Documents", key: "is_id_verified", icon: "document-text-outline" },
];

const VerifChip = ({ label, icon, verified, colors }) => (
  <View
    className="flex-row items-center gap-1.5 px-3 py-2 rounded-[20px] border"
    style={{
      backgroundColor: verified ? colors.success + "10" : colors.warning + "10",
      borderColor: verified ? colors.success + "20" : colors.warning + "20",
    }}
  >
    <Ionicons
      name={icon}
      size={14}
      color={verified ? colors.success : colors.warning}
    />
    <Text
      style={{
        fontSize: 12,
        fontWeight: "700",
        color: verified ? colors.success : colors.warning,
      }}
    >
      {label}
    </Text>
    <Ionicons
      name={verified ? "checkmark-circle" : "time-outline"}
      size={13}
      color={verified ? colors.success : colors.warning}
    />
  </View>
);

const AccountScreen = () => {
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const { logout, loggingOut } = useLogout();
  const { px, isTablet, maxCardWidth } = useResponsive();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    try {
      await refreshProfile();
    } catch (e) {
      // silently fail
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile]);

  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    "Account User";
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const onPressLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  const section = (title, children) => (
    <View
      className="bg-surface rounded-3xl border border-border mb-5 overflow-hidden"
      style={colors.shadowSm}
    >
      {title ? (
        <View className="px-5 pt-5 pb-3 border-b border-background">
          <Text className="text-xs font-extrabold text-muted-foreground uppercase tracking-widest">
            {title}
          </Text>
        </View>
      ) : null}
      <View className="p-5">{children}</View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: px,
          paddingTop: 16,
          paddingBottom: 120,
          alignItems: isTablet ? "center" : "stretch",
        }}
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
        <View style={{ width: "100%", maxWidth: maxCardWidth ?? "100%" }}>
          {/* Premium Hero Card */}
          <View
            className="bg-surface rounded-[32px] p-6 mb-6 flex-row items-center gap-5 border border-border"
            style={colors.shadowMd}
          >
            {/* Avatar */}
            <View
              className="w-20 h-20 rounded-[40px] bg-primary items-center justify-center"
              style={colors.shadowSm}
            >
              <Text className="text-[28px] font-extrabold text-white">
                {initials || "AU"}
              </Text>
            </View>
            {/* Name / phone */}
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1">
                <Text className="text-[22px] font-extrabold text-foreground tracking-tight">
                  {fullName}
                </Text>
                {user?.is_verified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.success}
                  />
                )}
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="w-6 h-6 rounded-md bg-primary-light items-center justify-center">
                  <Ionicons
                    name="call-outline"
                    size={12}
                    color={colors.primary}
                  />
                </View>
                <Text className="text-sm text-muted-foreground font-medium">
                  {user?.phone_number || "—"}
                </Text>
              </View>
            </View>
          </View>

          {/* Account Details */}
          {section(
            "Personal Information",
            <View className="gap-4">
              {DETAIL_ROWS.map((row) => (
                <View
                  key={row.key}
                  className="flex-row items-center gap-4"
                >
                  <View className="w-9 h-9 rounded-[10px] bg-primary-light items-center justify-center">
                    <Ionicons
                      name={row.icon}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[11px] font-bold text-muted-foreground uppercase">
                      {row.label}
                    </Text>
                    <Text className="text-[15px] font-semibold text-foreground">
                      {user?.[row.key] || "—"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>,
          )}

          {/* Verification Status */}
          {section(
            "Verification Status",
            <View className="gap-4">
              <View className="flex-row flex-wrap gap-2.5">
                {VERIF_ITEMS.map((item) => (
                  <VerifChip
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    verified={user?.[item.key] === true}
                    colors={colors}
                  />
                ))}
              </View>

              <View
                className="flex-row items-center gap-3 rounded-2xl p-4 mt-1"
                style={{
                  backgroundColor: user?.is_verified
                    ? colors.success
                    : colors.warning,
                  ...colors.shadowSm,
                }}
              >
                <View className="w-8 h-8 rounded-2xl bg-white/20 items-center justify-center">
                  <Ionicons
                    name={
                      user?.is_verified ? "shield-checkmark" : "shield-outline"
                    }
                    size={18}
                    color="#fff"
                  />
                </View>
                <Text className="text-sm font-bold text-white flex-1">
                  {user?.is_verified
                    ? "Account fully verified and active"
                    : "Verification pending review"}
                </Text>
              </View>
            </View>,
          )}

          {/* Support Section */}
          {section(
            "Support",
            <View className="gap-4">
              <TouchableOpacity
                className="flex-row items-center gap-4 opacity-45"
                disabled
              >
                <View className="w-9 h-9 rounded-[10px] bg-primary-light items-center justify-center">
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-foreground">
                    Contact Support
                  </Text>
                  <Text className="text-[11px] font-medium text-muted-foreground">
                    Coming Soon
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center gap-4 opacity-45"
                disabled
              >
                <View className="w-9 h-9 rounded-[10px] bg-primary-light items-center justify-center">
                  <Ionicons
                    name="help-circle-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-foreground">
                    Help Center
                  </Text>
                  <Text className="text-[11px] font-medium text-muted-foreground">
                    Coming Soon
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>,
          )}

          {/* App Updates */}
          {section(
            "App Updates",
            <UpdateChecker />,
          )}

          {/* Logout Button */}
          <TouchableOpacity
            onPress={onPressLogout}
            className="flex-row items-center justify-center gap-2.5 p-4 rounded-[20px] border mb-5"
            style={{
              backgroundColor: colors.danger + "10",
              borderColor: colors.danger + "20",
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text
              style={{ fontSize: 16, fontWeight: "700", color: colors.danger }}
            >
              Logout Account
            </Text>
          </TouchableOpacity>

          <Text className="text-center text-muted-foreground text-xs font-medium">
            Version 1.0.4 (OLED Build)
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AccountScreen;
