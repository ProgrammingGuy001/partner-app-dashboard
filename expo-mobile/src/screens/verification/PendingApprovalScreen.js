import React, { useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';
import { useLogout } from '../../hooks/useLogout';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import ScreenHeader from '../../components/common/ScreenHeader';
import { Card, IconButton, Notice } from '../../components/common/Primitives';
import DeleteVerificationDataButton from '../../components/verification/DeleteVerificationDataButton';
import { useToast } from '../../hooks/useToast';
import { getApiErrorMessage } from '../../api/apiErrors';
import { spacing, typography } from '../../theme/designSystem';

const PendingApprovalScreen = () => {
  const { colors } = useTheme();
  const { logout, loggingOut } = useLogout();
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const toast = useToast();

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    try {
      await refreshProfile();
      setRefreshError('');
    } catch (error) {
      const message = getApiErrorMessage(error);
      setRefreshError(message);
      toast.error(message);
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
        contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xl }}
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
        <ScreenHeader
          eyebrow="Account verification"
          title="Pending approval"
          subtitle="Your identity document is under review"
          right={<IconButton icon="log-out-outline" label="Logout" tone="danger" onPress={logout} disabled={loggingOut} />}
          className="pt-0"
        />

        {/* Main Illustration */}
        <View className="items-center mb-8">
          <View className="h-24 w-24 rounded-full bg-primary-light items-center justify-center mb-5">
            <View className="h-16 w-16 rounded-full bg-primary items-center justify-center">
              <Ionicons name="hourglass-outline" size={40} color={colors.primaryForeground} />
            </View>
          </View>

          <Text className="font-extrabold text-foreground text-center" style={typography.title2}>
            Waiting for Admin Approval
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-2 leading-5 px-5">
            You've completed all self-verification steps. Our team is reviewing your ID documents and will approve your account shortly.
          </Text>
        </View>

        {/* Verification Status Card */}
        {refreshError ? <Notice tone="warning" title="Showing saved status" message={refreshError} className="mb-5" /> : null}

        <Card className="mb-6">
          <Text className="font-bold text-foreground mb-4" style={typography.callout}>
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
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{
                  backgroundColor: item.completed
                    ? colors.primaryLight
                    : item.pending
                    ? colors.surfaceAlt
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
                  <Text className="mt-0.5" style={[typography.micro, { color: colors.warning }]}>Pending admin review</Text>
                )}
              </View>
              {item.completed && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </View>
          ))}
        </Card>

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
