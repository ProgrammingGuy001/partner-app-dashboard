import React, { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';
import { useLogout } from '../../hooks/useLogout';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';

const PendingApprovalScreen = () => {
  const { colors } = useTheme();
  const { logout, loggingOut } = useLogout();
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
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
            <Text className="text-2xl font-extrabold text-foreground tracking-tight">
              Pending Approval
            </Text>
            <Text className="text-[13px] text-muted-foreground mt-1">
              Your verification is under review
            </Text>
          </View>
          <TouchableOpacity
            onPress={logout}
            disabled={loggingOut}
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
              <Ionicons name="hourglass-outline" size={40} color="#fff" />
            </View>
          </View>

          <Text className="text-[22px] font-extrabold text-foreground text-center tracking-tight">
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
                    ? '#FEF3C7'
                    : colors.surface,
                }}
              >
                <Ionicons
                  name={item.completed ? 'checkmark-circle' : item.pending ? 'time' : item.icon}
                  size={22}
                  color={item.completed ? colors.primary : item.pending ? '#F59E0B' : colors.textMuted}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{item.label}</Text>
                {item.pending && (
                  <Text className="text-[11px] mt-0.5" style={{ color: '#F59E0B' }}>Pending admin review</Text>
                )}
              </View>
              {item.completed && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </View>
          ))}
        </View>

        {/* Info Card */}
        <View className="bg-[#EFF6FF] rounded-2xl p-4 flex-row gap-3 border border-[#DBEAFE]">
          <Ionicons name="information-circle" size={24} color="#3B82F6" style={{ marginTop: 2 }} />
          <View className="flex-1">
            <Text className="text-[13px] font-bold text-[#1E40AF] mb-1">
              What happens next?
            </Text>
            <Text className="text-xs text-[#1E3A8A] leading-[18px]">
              • Our admin team will review your documents{'\n'}
              • You'll receive a notification once approved{'\n'}
              • Approval typically takes 24-48 hours{'\n'}
              • You can log out and check back later
            </Text>
          </View>
        </View>

        {/* Support Section */}
        <View className="mt-8 items-center">
          <Text className="text-xs text-muted-foreground text-center mb-2">
            Need help? Contact support
          </Text>
          <TouchableOpacity className="flex-row items-center gap-1.5 px-4 py-2.5 bg-surface rounded-xl border border-border">
            <Ionicons name="mail" size={16} color={colors.primary} />
            <Text className="text-[13px] font-semibold text-primary">support@modula.com</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PendingApprovalScreen;
