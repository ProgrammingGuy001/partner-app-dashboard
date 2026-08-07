import React, { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';
import { useLogout } from '../../hooks/useLogout';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Notice } from '../../components/common/Primitives';
import DeleteVerificationDataButton from '../../components/verification/DeleteVerificationDataButton';
import { useToast } from '../../hooks/useToast';

const PendingApprovalScreen = () => {
  const { colors } = useTheme();
  const { logout, loggingOut } = useLogout();
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    try {
      await refreshProfile();
    } catch (error) {
      toast.error(error.message || 'Failed to refresh verification status');
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile, toast]);

  const verificationStatus = [
    {
      label: 'Phone Verified',
      icon: 'call',
      completed: user?.is_verified,
    },
    {
      label: 'PAN Verified',
      icon: 'card',
      completed: user?.is_pan_verified,
    },
    {
      label: 'Bank Details Verified',
      icon: 'wallet',
      completed: user?.is_bank_details_verified,
    },
    {
      label: 'ID Verification',
      icon: 'shield-checkmark',
      completed: user?.is_id_verified,
      pending: !user?.is_id_verified,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}
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
        {/* Header with Logout */}
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className="text-2xl font-extrabold text-foreground">
              Pending Approval
            </Text>
            <Text className="text-[13px] text-muted-foreground mt-1">
              Your verification is under review
            </Text>
          </View>
          <TouchableOpacity
            onPress={logout}
            disabled={loggingOut}
            accessibilityRole="button"
            accessibilityLabel="Logout"
            accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
            className="w-10 h-10 rounded-[20px] bg-surface items-center justify-center border border-border"
            style={colors.shadowSm}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* Main Illustration */}
        <View className="items-center mb-8">
          <View className="w-[120px] h-[120px] rounded-full bg-primary-light flex items-center justify-center mb-5">
            <View className="w-20 h-20 rounded-[40px] bg-primary items-center justify-center">
              <Ionicons name="hourglass-outline" size={40} color={colors.primaryForeground} />
            </View>
          </View>

          <Text className="text-[22px] font-extrabold text-foreground text-center">
            Waiting for Admin Approval
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-2 leading-5 px-5">
            You've completed all self-verification steps. Our team is reviewing your ID documents and will approve your account shortly.
          </Text>
        </View>

        {/* Verification Status Card */}
        <View
          className="bg-surface rounded-2xl p-5 mb-6 border border-border"
          style={colors.shadowSm}
        >
          <Text className="text-[15px] font-bold text-foreground mb-4">
            Verification Status
          </Text>

          {verificationStatus.map((item, index) => (
            <View
              key={index}
              className={`flex-row items-center py-3 ${
                index < verificationStatus.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <View
                className="w-10 h-10 rounded-[20px] items-center justify-center mr-3"
                style={{
                  backgroundColor: item.completed
                    ? colors.primaryLight
                    : item.pending
                    ? colors.warning + '15'
                    : colors.surface,
                }}
              >
                <Ionicons
                  name={item.completed ? 'checkmark-circle' : item.pending ? 'time' : item.icon}
                  size={22}
                  color={item.completed ? colors.primary : item.pending ? colors.warning : colors.textMuted}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{item.label}</Text>
                {item.pending && (
                  <Text className="text-[11px] mt-0.5" style={{ color: colors.warning }}>Pending admin review</Text>
                )}
              </View>
              {item.completed && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </View>
          ))}
        </View>

        {/* Info Card */}
        <Notice
          tone="info"
          title="What happens next?"
          message={"An admin will review your ID document. Pull down to refresh your approval status, or log out and check again later."}
        />

        <View className="mt-5">
          <DeleteVerificationDataButton />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default PendingApprovalScreen;
