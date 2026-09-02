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

const BankVerification = ({ onSuccess, isBankVerified, canProceed }) => {
  const toast = useToast();
  const { colors } = useTheme();
  const [formData, setFormData] = useState({ accountNumber: "", ifsc: "" });
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
      const status = await verificationApi.verifyBank(formData.accountNumber, formData.ifsc);
      toast.success("Bank details verified successfully!");
      onSuccess?.(status);
    } catch (err) {
      const fieldErrors = getApiFieldErrors(err);
      setErrors((current) => ({
        ...current,
        ...(fieldErrors.account_number ? { accountNumber: fieldErrors.account_number } : {}),
        ...(fieldErrors.ifsc ? { ifsc: fieldErrors.ifsc } : {}),
      }));
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!canProceed) {
    return (
      <Card className="items-center border-dashed p-8 opacity-60">
        <View className="w-16 h-16 rounded-full bg-background items-center justify-center mb-4">
          <Ionicons name="lock-closed" size={28} color={colors.textMuted} />
        </View>
        <Text className="text-lg font-bold text-foreground mb-2">
          Step Locked
        </Text>
        <Text className="text-sm text-muted-foreground text-center leading-5">
          Please complete the PAN verification first to unlock bank details
          verification.
        </Text>
      </Card>
    );
  }

  if (isBankVerified) {
    return (
      <Card className="items-center p-8">
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-5"
          style={{ backgroundColor: colors.primaryLight }}
        >
          <Ionicons name="cash-outline" size={40} color={colors.primary} />
        </View>
        <Text className="text-xl font-extrabold text-foreground mb-2">
          Bank Details Verified
        </Text>
        <Text className="text-sm text-muted-foreground text-center leading-5">
          Your settlement account has been successfully linked and verified.
        </Text>
      </Card>
    );
  }

  return (
    <>
      <KYCConsentModal
        visible={showConsent}
        type="bank"
        onAccept={() => {
          setConsentGiven(true);
          setShowConsent(false);
        }}
        onDecline={() => setShowConsent(false)}
      />
      <Card className="p-6">
        <View className="mb-5">
          <Text className="text-lg font-extrabold text-foreground mb-1.5">
            Bank Details
          </Text>
          <Text className="text-muted-foreground" style={typography.caption}>
            Provide your primary bank account details for payouts.
          </Text>
        </View>

        <View className="gap-4 mb-6">
          <View className="gap-2">
            <Text className="text-xs font-bold text-foreground uppercase">
              Account Number
            </Text>
            <Input
              placeholder="0000 0000 0000"
              value={formData.accountNumber}
              onChangeText={(text) => {
                setFormData((prev) => ({ ...prev, accountNumber: text }));
                setErrors((prev) => ({ ...prev, accountNumber: "" }));
              }}
              keyboardType="number-pad"
              accessibilityLabel="Bank account number"
              autoComplete="off"
              className="h-14 rounded-xl bg-background border px-4 text-base font-semibold text-foreground"
              style={{
                borderColor: errors.accountNumber
                  ? colors.danger
                  : colors.border,
              }}
            />
            {errors.accountNumber && (
              <Text className="text-destructive-muted-foreground text-xs font-medium">
                {errors.accountNumber}
              </Text>
            )}
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold text-foreground uppercase">
              IFSC Code
            </Text>
            <Input
              placeholder="HDFC0001234"
              value={formData.ifsc}
              onChangeText={(text) => {
                setFormData((prev) => ({
                  ...prev,
                  ifsc: formatters.uppercase(text),
                }));
                setErrors((prev) => ({ ...prev, ifsc: "" }));
              }}
              autoCapitalize="characters"
              maxLength={11}
              accessibilityLabel="IFSC code"
              className="h-14 rounded-xl bg-background border px-4 text-base font-semibold text-foreground"
              style={{
                borderColor: errors.ifsc ? colors.danger : colors.border,
              }}
            />
            {errors.ifsc && (
              <Text className="text-destructive-muted-foreground text-xs font-medium">
                {errors.ifsc}
              </Text>
            )}
          </View>
        </View>

        {!consentGiven ? (
          <Button
            className="w-full"
            size="lg"
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
            onPress={handleSubmit}
          >
            <Text className="text-primary-foreground text-base font-bold">
              Verify Bank Account
            </Text>
          </Button>
        )}
      </Card>
    </>
  );
};

export default BankVerification;
