import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
  StatusBar,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Text } from "@/components/ui";
import { useAuth } from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { validators } from "../../util/validators";
import Ionicons from "@react-native-vector-icons/ionicons";
import { IconButton, Notice, StatusBadge } from '../../components/common/Primitives';
import { radii, spacing, typography } from '../../theme/designSystem';

const OTP_LENGTH = 6;

const OTPScreen = ({ navigation }) => {
  const { verifyOtp, resendOtp } = useAuth();
  const phoneNumber = useAuthStore((state) => state.phoneNumber);
  const { maxCardWidth, isTablet, width } = useResponsive();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [focused, setFocused] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (!phoneNumber) navigation.navigate("Login");
  }, [phoneNumber, navigation]);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (index, value) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      const updated = [...otp];
      updated[index] = "";
      setOtp(updated);
      setError("");
      return;
    }

    const updated = [...otp];
    digits
      .slice(0, OTP_LENGTH - index)
      .split("")
      .forEach((digit, offset) => {
        updated[index + offset] = digit;
      });
    setOtp(updated);
    setError("");

    Haptics.selectionAsync().catch(() => {});
    const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleKeyPress = (index, key) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const otpValue = otp.join("");
    const validation = validators.otp(otpValue);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setLoading(true);
    const result = await verifyOtp(otpValue);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    const result = await resendOtp();
    setResendLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setTimer(60);
    setOtp(Array(OTP_LENGTH).fill(""));
    setError("");
  };

  const maskedPhone = phoneNumber ? `+91 ••••••${phoneNumber.slice(-4)}` : "";
  const otpComplete = otp.join("").length === OTP_LENGTH;

  // Calculate OTP box size - constrain to maxCardWidth on tablets
  const containerWidth = isTablet
    ? Math.min(maxCardWidth || width, width - spacing.lg * 2)
    : width - spacing.lg * 2;
  const BOX_SIZE = Math.min(spacing.xl + spacing.lg, Math.floor((containerWidth - spacing.xl - spacing.xs) / OTP_LENGTH));

  return (
    <View className="flex-1 bg-background">
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Back button */}
          <View className="px-6 mb-2">
            <IconButton
              icon="chevron-back"
              label="Back to login"
              onPress={() => navigation.navigate("Login")}
            />
          </View>

          <View
            className="flex-1 justify-center px-6"
            style={{ alignItems: isTablet ? "center" : "stretch" }}
          >
            <View
              className="w-full"
              style={{ maxWidth: maxCardWidth ?? "100%" }}
            >
              {/* Shield badge */}
              <View className="self-center mb-8">
                <View className="w-20 h-20 rounded-full bg-primary-light justify-center items-center">
                  <View className="w-16 h-16 rounded-full bg-primary justify-center items-center">
                    <Ionicons
                      name="shield-checkmark"
                      size={typography.title1.fontSize}
                      color={colors.primaryForeground}
                    />
                  </View>
                </View>
              </View>

              {/* Title */}
              <Text style={typography.title1} className="text-foreground text-center mb-2.5">
                Verify it's you
              </Text>
              <Text style={typography.callout} className="text-muted-foreground text-center mb-10">
                We sent a 6-digit code to{"\n"}
                <Text className="font-extrabold text-foreground">
                  {maskedPhone}
                </Text>
              </Text>

              {/* OTP boxes */}
              <View
                className="flex-row justify-center flex-wrap mb-2"
                style={{ gap: isTablet ? 12 : 8 }}
              >
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    value={digit}
                    onChangeText={(value) => handleChange(index, value)}
                    onKeyPress={({ nativeEvent }) =>
                      handleKeyPress(index, nativeEvent.key)
                    }
                    onFocus={() => setFocused(index)}
                    onBlur={() => setFocused(null)}
                    maxLength={OTP_LENGTH}
                    keyboardType="number-pad"
                    textContentType={index === 0 ? "oneTimeCode" : "none"}
                    autoComplete={index === 0 ? "sms-otp" : "off"}
                    accessibilityLabel={`Verification code digit ${index + 1}`}
                    style={{
                      width: BOX_SIZE,
                      height: BOX_SIZE + 8,
                      borderWidth: 2,
                      borderColor: error
                        ? colors.danger
                        : focused === index
                          ? colors.primary
                          : digit
                            ? colors.primary
                            : colors.border,
                      borderRadius: radii.lg,
                      backgroundColor: digit
                        ? colors.primaryLight
                        : focused === index
                          ? colors.surface
                          : colors.surface,
                      textAlign: "center",
                      ...typography.title2,
                      color: digit ? colors.primary : colors.text,
                    }}
                  />
                ))}
              </View>

              {error ? (
                <Notice tone="danger" message={error} className="mb-6 mt-2" />
              ) : (
                <View className="h-10" />
              )}

              {/* Verify CTA */}
              <Button
                onPress={handleSubmit}
                disabled={!otpComplete || loading}
                loading={loading}
                accessibilityRole="button"
                accessibilityLabel="Verify and continue"
                accessibilityState={{
                  disabled: !otpComplete || loading,
                  busy: loading,
                }}
                size="lg"
              >
                <Text>Verify &amp; Continue</Text>
              </Button>

              {/* Resend / timer */}
              <View className="items-center mt-7">
                {timer > 0 ? (
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm text-muted-foreground">
                      Resend code in
                    </Text>
                    <StatusBadge label={`${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`} tone="primary" />
                  </View>
                ) : (
                  <Button
                    variant="ghost"
                    onPress={handleResend}
                    loading={resendLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Resend verification code"
                    accessibilityState={{
                      disabled: resendLoading,
                      busy: resendLoading,
                    }}
                  >
                    <Text>Resend code</Text>
                  </Button>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default OTPScreen;
