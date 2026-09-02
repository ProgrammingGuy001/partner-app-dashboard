import * as React from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Input, Text } from "@/components/ui";
import { FieldLabel, Notice } from "../../components/common/Primitives";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { radii, spacing } from "../../theme/designSystem";
import { validators } from "../../util/validators";
import { ROUTES } from "../../util/constants";

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const { maxCardWidth, isTablet, height } = useResponsive();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const validation = validators.phone(phoneNumber);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(phoneNumber);
    setLoading(false);
    if (result.success) navigation.navigate(ROUTES.OTP);
    else setError(result.fieldErrors?.phone_number || result.error);
  };

  return (
    <View className="flex-1">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={colors.brandGradient as [string, string, string]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
          <View style={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl + spacing.xs }}>
            <Image
              source={require("../../../assets/icon.png")}
              style={{ width: spacing.xl + spacing.xl / 2, height: spacing.xl + spacing.xl / 2, borderRadius: radii.lg, marginBottom: spacing.lg }}
              resizeMode="contain"
            />
            <Text className="text-3xl font-extrabold" style={{ color: colors.primaryForeground }}>Modula{"\n"}Partner</Text>
            <Text className="mt-1 text-base font-medium" style={{ color: colors.primaryForeground }}>Your professional workspace</Text>
          </View>

          <View
            className="flex-1 bg-background rounded-t-3xl"
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.xl,
              paddingBottom: insets.bottom + spacing.xl,
              minHeight: height * 0.55,
              alignItems: isTablet ? "center" : "stretch",
            }}
          >
            <View style={{ width: "100%", maxWidth: maxCardWidth ?? "100%" }}>
              <View className="mb-6">
                <Text className="text-3xl font-extrabold text-foreground">Welcome back</Text>
                <Text className="mt-1 text-base font-medium text-muted-foreground">Enter your number to receive a login code</Text>
              </View>

              <FieldLabel>Mobile number</FieldLabel>
              <View className={`h-16 flex-row items-center rounded-2xl border bg-surface px-4 ${error ? "border-destructive" : "border-border"}`} style={colors.shadowSm}>
                <Text className="mr-3 text-base font-bold text-foreground">+91</Text>
                <View className="h-6 w-px bg-border mr-3" />
                <Input
                  placeholder="9876543210"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  accessibilityLabel="Mobile number"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  onChangeText={(text) => { setPhoneNumber(text); setError(""); }}
                  maxLength={10}
                  className="flex-1 border-0 bg-transparent text-xl font-bold text-foreground"
                />
              </View>
              {error ? <Notice tone="danger" title="Login not started" message={error} icon="alert-circle-outline" className="mt-3" /> : null}

              <Button size="lg" loading={loading} onPress={handleSubmit} accessibilityLabel="Get access code" className="mt-6">
                Get access code
              </Button>

              <View className="mt-6 flex-row items-center justify-center gap-2">
                <Text className="text-base font-medium text-muted-foreground">New to Modula?</Text>
                <Button variant="ghost" size="sm" onPress={() => navigation.navigate(ROUTES.REGISTER)}>Join now</Button>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default LoginScreen;
