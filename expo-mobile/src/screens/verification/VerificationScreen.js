import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import BankVerification from '../../components/verification/BankVerification';
import DocumentUpload from '../../components/verification/DocumentUpload';
import PANVerification from '../../components/verification/PANVerification';
import VerificationStepper from '../../components/verification/VerificationStepper';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SkeletonBlock } from '../../components/common/EmptyState';
import ErrorAlert from '../../components/common/ErrorAlert';
import { verificationApi } from '../../api/verificationApi';
import { useLogout } from '../../hooks/useLogout';
import { useToast } from '../../hooks/useToast';
import { useAuthStore } from '../../store/authStore';
import { useVerificationStore } from '../../store/verificationStore';
import { useResponsive } from '../../hooks/useResponsive';
import { useTheme } from '../../hooks/useTheme';
import { VERIFICATION_STEPS } from '../../util/constants';
import { logger } from '../../util/helpers';

const VerificationScreen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFetched = useRef(false);
  const { colors } = useTheme();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { logout, loggingOut } = useLogout();
  const { px, isTablet, maxCardWidth } = useResponsive();

  const { currentStep, isPanVerified, isBankVerified, isDocumentUploaded, setCurrentStep, setVerificationStatus, nextStep } =
    useVerificationStore();

  const fetchVerificationStatus = useCallback(async () => {
    try {
      setError(null);
      const status = await verificationApi.getVerificationStatus();
      setVerificationStatus(status);
      if (user) setUser({ ...user, ...status });
      return status;
    } catch (err) {
      logger.error('VerificationScreen', `Failed to fetch verification status: ${err?.message}`);
      setError(err?.message || 'Failed to load verification status');
      toast.error('Failed to load verification status');
      return null;
    }
  }, [user, setUser, setVerificationStatus, toast]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    let isMounted = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const status = await verificationApi.getVerificationStatus();
        if (!isMounted) return;
        setVerificationStatus(status);
        if (user) setUser({ ...user, ...status });
        if (status.is_pan_verified !== true) setCurrentStep(VERIFICATION_STEPS.PAN);
        else if (status.is_bank_details_verified !== true) setCurrentStep(VERIFICATION_STEPS.BANK);
        else setCurrentStep(VERIFICATION_STEPS.DOCUMENT);
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Failed to load verification status');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => { isMounted = false; };
  }, []);

  const handlePanSuccess  = async () => { await fetchVerificationStatus(); nextStep(); };
  const handleBankSuccess = async () => { await fetchVerificationStatus(); nextStep(); };
  const handleVerificationDone = async () => { await fetchVerificationStatus(); };

  const onPressLogout = () =>
    Alert.alert('Logout', 'Do you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="pt-6 gap-4" style={{ paddingHorizontal: px }}>
          <SkeletonBlock height={28} width="65%" />
          <SkeletonBlock height={16} width="80%" />
          <View className="flex-row gap-3 mt-2">
            {[1, 2, 3].map((i) => <SkeletonBlock key={i} height={44} width={44} borderRadius={22} />)}
          </View>
          <SkeletonBlock height={200} borderRadius={16} style={{ marginTop: 8 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !currentStep) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="pt-6 gap-4" style={{ paddingHorizontal: px }}>
          <ErrorAlert message={error} />
          <Button onPress={() => { hasFetched.current = false; setLoading(true); fetchVerificationStatus().finally(() => setLoading(false)); }}>
            <Text className="text-white font-semibold">Retry</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: px,
          paddingBottom: 40,
          alignItems: isTablet ? 'center' : 'stretch',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: maxCardWidth ?? '100%' }}>

          {/* Premium Header */}
          <View className="pt-6 pb-5 flex-row justify-between items-center">
            <View>
              <Text className="text-2xl font-extrabold text-foreground tracking-tight">
                Verification
              </Text>
              <Text className="text-[13px] text-muted-foreground mt-1 font-medium">
                Complete steps to start earning
              </Text>
            </View>
            <TouchableOpacity 
              onPress={onPressLogout}
              className="w-10 h-10 rounded-[20px] bg-surface items-center justify-center border border-border"
              style={colors.shadowSm}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>

          {/* Stepper */}
          <View 
            className="bg-surface rounded-3xl p-5 mb-6 border border-border"
            style={colors.shadowSm}
          >
            <VerificationStepper
              currentStep={currentStep}
              isPanVerified={isPanVerified}
              isBankVerified={isBankVerified}
            />
          </View>

          {/* Step content */}
          <View>
            {currentStep === VERIFICATION_STEPS.PAN && (
              <PANVerification onSuccess={handlePanSuccess} isPanVerified={isPanVerified} />
            )}
            {currentStep === VERIFICATION_STEPS.BANK && (
              <BankVerification onSuccess={handleBankSuccess} isBankVerified={isBankVerified} canProceed={isPanVerified} />
            )}
            {currentStep === VERIFICATION_STEPS.DOCUMENT && (
              <DocumentUpload
                canProceed={isPanVerified && isBankVerified}
                isDocumentUploaded={isDocumentUploaded}
                onDone={handleVerificationDone}
              />
            )}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default VerificationScreen;
