import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BankVerification from '../../components/verification/BankVerification';
import DocumentUpload from '../../components/verification/DocumentUpload';
import PANVerification from '../../components/verification/PANVerification';
import VerificationStepper from '../../components/verification/VerificationStepper';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import Loader from '../../components/common/Loader';
import ScreenHeader from '../../components/common/ScreenHeader';
import { Card, IconButton, Notice } from '../../components/common/Primitives';
import { verificationApi } from '../../api/verificationApi';
import { useLogout } from '../../hooks/useLogout';
import { useToast } from '../../hooks/useToast';
import { useAuthStore } from '../../store/authStore';
import { useVerificationStore } from '../../store/verificationStore';
import { useResponsive } from '../../hooks/useResponsive';
import { VERIFICATION_STEPS } from '../../util/constants';
import { logger } from '../../util/helpers';
import DeleteVerificationDataButton from '../../components/verification/DeleteVerificationDataButton';
import { getApiErrorMessage } from '../../api/apiErrors';
import { spacing } from '../../theme/designSystem';

const VerificationScreen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasStatus, setHasStatus] = useState(false);
  const hasFetched = useRef(false);
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
      if (status.is_pan_verified !== true) setCurrentStep(VERIFICATION_STEPS.PAN);
      else if (status.is_bank_details_verified !== true) setCurrentStep(VERIFICATION_STEPS.BANK);
      else setCurrentStep(VERIFICATION_STEPS.DOCUMENT);
      setHasStatus(true);
      return status;
    } catch (err) {
      logger.error('VerificationScreen', `Failed to fetch verification status: ${err?.message}`);
      const message = getApiErrorMessage(err);
      setError(message);
      toast.error(message);
      return null;
    }
  }, [user, setUser, setCurrentStep, setVerificationStatus, toast]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    let isMounted = true;
    const run = async () => {
      setLoading(true);
      try {
        await fetchVerificationStatus();
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => { isMounted = false; };
  }, [fetchVerificationStatus]);

  const applySuccess = (status) => {
    setVerificationStatus(status);
    if (user) setUser({ ...user, ...status });
    setHasStatus(true);
    setError(null);
  };
  const handlePanSuccess = (status) => { applySuccess(status); nextStep(); };
  const handleBankSuccess = (status) => { applySuccess(status); nextStep(); };
  const handleVerificationDone = async (status) => status ? applySuccess(status) : fetchVerificationStatus();

  const onPressLogout = () =>
    Alert.alert('Logout', 'Do you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Loader text="Loading verification status" fullScreen />
      </SafeAreaView>
    );
  }

  if (error && !hasStatus) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="pt-6 gap-4" style={{ paddingHorizontal: px }}>
          <Notice tone="danger" title="Verification unavailable" message={error} />
          <Button variant="outline" onPress={() => { setLoading(true); fetchVerificationStatus().finally(() => setLoading(false)); }}>
            <Text>Retry</Text>
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
          paddingBottom: spacing.xl,
          alignItems: isTablet ? 'center' : 'stretch',
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: maxCardWidth ?? '100%' }}>

          <ScreenHeader
            eyebrow="Account setup"
            title="Verification"
            subtitle="Complete these steps to start earning"
            right={<IconButton icon="log-out-outline" label="Logout" tone="danger" onPress={onPressLogout} disabled={loggingOut} />}
          />

          {error ? <Notice tone="warning" title="Showing saved status" message={error} className="mb-5" /> : null}

          {/* Stepper */}
          <Card className="mb-6">
            <VerificationStepper
              currentStep={currentStep}
              isPanVerified={isPanVerified}
              isBankVerified={isBankVerified}
            />
          </Card>

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

          <View className="mt-6">
            <DeleteVerificationDataButton />
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default VerificationScreen;
