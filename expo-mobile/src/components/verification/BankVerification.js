import React, { useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { verificationApi } from '../../api/verificationApi';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../hooks/useTheme';
import { formatters } from '../../util/formatters';
import { validators } from '../../util/validators';
import KYCConsentModal from './KYCConsentModal';

const BankVerification = ({ onSuccess, isBankVerified, canProceed }) => {
  const toast = useToast();
  const { colors } = useTheme();
  const [formData, setFormData] = useState({ accountNumber: '', ifsc: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    const accountValidation = validators.accountNumber(formData.accountNumber);
    if (!accountValidation.valid) {
      newErrors.accountNumber = accountValidation.message;
    }

    const ifscValidation = validators.ifsc(formData.ifsc);
    if (!ifscValidation.valid) {
      newErrors.ifsc = ifscValidation.message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await verificationApi.verifyBank(formData.accountNumber, formData.ifsc);
      toast.success('Bank details verified successfully!');
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || 'Bank verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!canProceed) {
    return (
      <View 
        className="bg-surface rounded-3xl p-8 items-center opacity-60 border border-border border-dashed"
      >
        <View className="w-16 h-16 rounded-[32px] bg-background items-center justify-center mb-4">
          <Ionicons name="lock-closed" size={28} color={colors.textMuted} />
        </View>
        <Text className="text-lg font-bold text-foreground mb-2">
          Step Locked
        </Text>
        <Text className="text-sm text-muted-foreground text-center leading-5">
          Please complete the PAN verification first to unlock bank details verification.
        </Text>
      </View>
    );
  }

  if (isBankVerified) {
    return (
      <View 
        className="bg-surface rounded-3xl p-8 items-center border border-border"
        style={colors.shadowSm}
      >
        <View 
          className="w-20 h-20 rounded-[40px] items-center justify-center mb-5"
          style={{ backgroundColor: colors.success + '15' }}
        >
          <Ionicons name="cash-outline" size={40} color={colors.success} />
        </View>
        <Text className="text-xl font-extrabold text-foreground mb-2">
          Bank Details Verified
        </Text>
        <Text className="text-sm text-muted-foreground text-center leading-5">
          Your settlement account has been successfully linked and verified.
        </Text>
      </View>
    );
  }

  return (
    <>
      <KYCConsentModal
        visible={showConsent}
        type="bank"
        onAccept={() => { setConsentGiven(true); setShowConsent(false); }}
        onDecline={() => setShowConsent(false)}
      />
    <View
      className="bg-surface rounded-3xl p-6 border border-border"
      style={colors.shadowSm}
    >
      <View className="mb-5">
        <Text className="text-lg font-extrabold text-foreground mb-1.5">
          Bank Details
        </Text>
        <Text className="text-[13px] text-muted-foreground leading-[18px]">
          Provide your primary bank account details for payouts.
        </Text>
      </View>

      <View className="gap-4 mb-6">
        <View className="gap-2">
          <Text className="text-xs font-bold text-foreground uppercase tracking-wide">
            Account Number
          </Text>
          <Input
            placeholder="0000 0000 0000"
            value={formData.accountNumber}
            onChangeText={(text) => {
              setFormData((prev) => ({ ...prev, accountNumber: text }));
              setErrors((prev) => ({ ...prev, accountNumber: '' }));
            }}
            keyboardType="number-pad"
            className="h-[52px] rounded-xl bg-background border px-4 text-base font-semibold text-foreground"
            style={{
              borderColor: errors.accountNumber ? colors.danger : colors.border,
            }}
          />
          {errors.accountNumber && (
            <Text className="text-danger text-xs font-medium">{errors.accountNumber}</Text>
          )}
        </View>

        <View className="gap-2">
          <Text className="text-xs font-bold text-foreground uppercase tracking-wide">
            IFSC Code
          </Text>
          <Input
            placeholder="HDFC0001234"
            value={formData.ifsc}
            onChangeText={(text) => {
              setFormData((prev) => ({ ...prev, ifsc: formatters.uppercase(text) }));
              setErrors((prev) => ({ ...prev, ifsc: '' }));
            }}
            autoCapitalize="characters"
            maxLength={11}
            className="h-[52px] rounded-xl bg-background border px-4 text-base font-semibold text-foreground"
            style={{
              borderColor: errors.ifsc ? colors.danger : colors.border,
            }}
          />
          {errors.ifsc && (
            <Text className="text-danger text-xs font-medium">{errors.ifsc}</Text>
          )}
        </View>
      </View>

      {!consentGiven ? (
        <Button
          className="w-full h-14 rounded-2xl bg-primary"
          onPress={() => setShowConsent(true)}
        >
          <Text className="text-white text-base font-bold">Continue</Text>
        </Button>
      ) : (
        <Button
          className="w-full h-14 rounded-2xl bg-primary"
          loading={loading}
          onPress={handleSubmit}
        >
          <Text className="text-white text-base font-bold">Verify Bank Account</Text>
        </Button>
      )}
    </View>
    </>
  );
};

export default BankVerification;
