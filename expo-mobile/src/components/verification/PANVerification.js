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

const PANVerification = ({ onSuccess, isPanVerified }) => {
  const toast = useToast();
  const { colors } = useTheme();
  const [pan, setPan] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  const handleSubmit = async () => {
    const value = formatters.uppercase(pan);
    const validation = validators.pan(value);

    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await verificationApi.verifyPan(value);
      toast.success('PAN verified successfully!');
      onSuccess?.();
    } catch (err) {
      const message = err.message || 'PAN verification failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (isPanVerified) {
    return (
      <View 
        className="bg-surface rounded-3xl p-8 items-center border border-border"
        style={colors.shadowSm}
      >
        <View 
          className="w-20 h-20 rounded-[40px] items-center justify-center mb-5"
          style={{ backgroundColor: colors.success + '15' }}
        >
          <Ionicons name="checkmark-shield" size={40} color={colors.success} />
        </View>
        <Text className="text-xl font-extrabold text-foreground mb-2">
          Identity Verified
        </Text>
        <Text className="text-sm text-muted-foreground text-center leading-5">
          Your Permanent Account Number has been successfully verified.
        </Text>
      </View>
    );
  }

  return (
    <>
      <KYCConsentModal
        visible={showConsent}
        type="pan"
        onAccept={() => { setConsentGiven(true); setShowConsent(false); }}
        onDecline={() => setShowConsent(false)}
      />
    <View
      className="bg-surface rounded-3xl p-6 border border-border"
      style={colors.shadowSm}
    >
      <View className="mb-5">
        <Text className="text-lg font-extrabold text-foreground mb-1.5">
          PAN Verification
        </Text>
        <Text className="text-[13px] text-muted-foreground leading-[18px]">
          Enter your 10-digit PAN exactly as it appears on your card.
        </Text>
      </View>

      <View className="gap-2 mb-6">
        <Text className="text-xs font-bold text-foreground uppercase tracking-wide">
          PAN Number
        </Text>
        <Input
          placeholder="ABCDE1234F"
          value={pan}
          onChangeText={(text) => {
            setPan(formatters.uppercase(text));
            setError('');
          }}
          maxLength={10}
          autoCapitalize="characters"
          className="h-[52px] rounded-xl bg-background border px-4 text-base font-semibold text-foreground"
          style={{
            borderColor: error ? colors.danger : colors.border,
          }}
        />
        {error && (
          <View className="flex-row items-center gap-1 mt-1">
            <Ionicons name="alert-circle" size={14} color={colors.danger} />
            <Text className="text-danger text-xs font-medium">{error}</Text>
          </View>
        )}
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
          disabled={pan.length !== 10}
          onPress={handleSubmit}
        >
          <Text className="text-white text-base font-bold">Verify Identity</Text>
        </Button>
      )}

      <View className="flex-row items-center justify-center gap-1.5 mt-5">
        <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} />
        <Text className="text-xs text-muted-foreground font-medium">
          Secure 256-bit encrypted verification
        </Text>
      </View>
    </View>
    </>
  );
};

export default PANVerification;
