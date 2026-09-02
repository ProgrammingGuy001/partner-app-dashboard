import React, { useState } from "react";
import { View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { verificationApi } from "../../api/verificationApi";
import { useToast } from "../../hooks/useToast";
import { useTheme } from "../../hooks/useTheme";
import { formatters } from "../../util/formatters";
import { validators } from "../../util/validators";
import KYCConsentModal from "./KYCConsentModal";
import { Card } from "../common/Primitives";
import { getApiErrorMessage, getApiFieldErrors } from "../../api/apiErrors";
import { typography } from "../../theme/designSystem";

const PANVerification = ({ onSuccess, isPanVerified }) => {
  const toast = useToast();
  const { colors } = useTheme();
  const [pan, setPan] = useState("");
  const [error, setError] = useState("");
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
    setError("");
    try {
      const status = await verificationApi.verifyPan(value);
      toast.success("PAN verified successfully!");
      onSuccess?.(status);
    } catch (err) {
      const message = getApiFieldErrors(err).pan || getApiErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (isPanVerified) {
    return (
      <Card className="items-center p-8">
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-5"
          style={{ backgroundColor: colors.primaryLight }}
        >
          <Ionicons name="checkmark-shield" size={40} color={colors.primary} />
        </View>
        <Text className="text-xl font-extrabold text-foreground mb-2">
          Identity Verified
        </Text>
        <Text className="text-sm text-muted-foreground text-center leading-5">
          Your Permanent Account Number has been successfully verified.
        </Text>
      </Card>
    );
  }

  return (
    <>
      <KYCConsentModal
        visible={showConsent}
        type="pan"
        onAccept={() => {
          setConsentGiven(true);
          setShowConsent(false);
        }}
        onDecline={() => setShowConsent(false)}
      />
      <Card className="p-6">
        <View className="mb-5">
          <Text className="text-lg font-extrabold text-foreground mb-1.5">
            PAN Verification
          </Text>
          <Text className="text-muted-foreground" style={typography.caption}>
            Enter your 10-digit PAN exactly as it appears on your card.
          </Text>
        </View>

        <View className="gap-2 mb-6">
          <Text className="text-xs font-bold text-foreground uppercase">
            PAN Number
          </Text>
          <Input
            placeholder="ABCDE1234F"
            value={pan}
            onChangeText={(text) => {
              setPan(formatters.uppercase(text));
              setError("");
            }}
            maxLength={10}
            autoCapitalize="characters"
            accessibilityLabel="PAN number"
            className="h-14 rounded-xl bg-background border px-4 text-base font-semibold text-foreground"
            style={{
              borderColor: error ? colors.danger : colors.border,
            }}
          />
          {error && (
            <View className="flex-row items-center gap-1 mt-1">
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text className="text-destructive-muted-foreground text-xs font-medium">
                {error}
              </Text>
            </View>
          )}
        </View>

        {!consentGiven ? (
          <Button
            className="w-full"
            size="lg"
            disabled={pan.length !== 10}
            onPress={() => setShowConsent(true)}
          >
            <Text className="text-primary-foreground text-base font-bold">
              Continue
            </Text>
          </Button>
        ) : (
          <Button
            className="w-full"
            size="lg"
            loading={loading}
            disabled={pan.length !== 10}
            onPress={handleSubmit}
          >
            <Text className="text-primary-foreground text-base font-bold">
              Verify Identity
            </Text>
          </Button>
        )}

        <View className="flex-row items-center justify-center gap-1.5 mt-5">
          <Ionicons
            name="lock-closed-outline"
            size={12}
            color={colors.textMuted}
          />
          <Text className="text-xs text-muted-foreground font-medium">
            Secure verification
          </Text>
        </View>
      </Card>
    </>
  );
};

export default PANVerification;
