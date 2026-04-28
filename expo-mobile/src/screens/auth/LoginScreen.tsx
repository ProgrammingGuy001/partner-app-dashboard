import * as React from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { validators } from "../../util/validators";
import { ROUTES } from "../../util/constants";
import Ionicons from "@react-native-vector-icons/ionicons";

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const { maxCardWidth, isTablet, height } = useResponsive();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const validation = validators.phone(phoneNumber);
    if (!validation.valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(validation.message);
      return;
    }
    setLoading(true);
    const result = await login(phoneNumber);
    setLoading(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate(ROUTES.OTP);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error || "Login failed");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-screen brand gradient */}
      <LinearGradient
        colors={["#1a0a0a", "#3D1D1C", "#6b4b41"]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top branding section */}
          <View
            style={{
              paddingTop: insets.top + 36,
              paddingHorizontal: 32,
              paddingBottom: 40,
            }}
          >
            <Image
              source={require("../../../assets/icon.png")}
              style={{ width: 52, height: 52, borderRadius: 14, marginBottom: 28 }}
              resizeMode="contain"
            />
            <Text
              style={{
                fontSize: 38,
                fontWeight: "900",
                color: "#fff",
                letterSpacing: -1.5,
                lineHeight: 44,
              }}
            >
              Modula{"\n"}Partner
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.55)",
                marginTop: 10,
                lineHeight: 22,
              }}
            >
              Your professional workspace
            </Text>
          </View>

          {/* Floating form card */}
          <View
            style={{
              flex: 1,
              backgroundColor: colors.background,
              borderTopLeftRadius: 40,
              borderTopRightRadius: 40,
              paddingHorizontal: 28,
              paddingTop: 36,
              paddingBottom: insets.bottom + 48,
              minHeight: height * 0.55,
              alignItems: isTablet ? "center" : "stretch",
            }}
          >
            <View style={{ width: "100%", maxWidth: maxCardWidth ?? "100%" }}>

              {/* Form heading */}
              <View style={{ marginBottom: 28 }}>
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: "800",
                    color: colors.text,
                    letterSpacing: -0.5,
                    marginBottom: 6,
                  }}
                >
                  Welcome back 👋
                </Text>
                <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22 }}>
                  Enter your number to receive a login code
                </Text>
              </View>

              {/* Phone input */}
              <View style={{ marginBottom: 8 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                    marginBottom: 8,
                    marginLeft: 2,
                  }}
                >
                  Mobile Number
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.surface,
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: error ? colors.danger : colors.border,
                    paddingHorizontal: 18,
                    height: 66,
                    ...colors.shadowSm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginRight: 14,
                      paddingRight: 14,
                      borderRightWidth: 1,
                      borderRightColor: colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>🇮🇳</Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: colors.text,
                        marginLeft: 6,
                      }}
                    >
                      +91
                    </Text>
                  </View>
                  <Input
                    placeholder="9876543210"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={(text) => {
                      setPhoneNumber(text);
                      setError("");
                    }}
                    maxLength={10}
                    style={{
                      flex: 1,
                      fontSize: 20,
                      fontWeight: "700",
                      color: colors.text,
                      letterSpacing: 1.5,
                      backgroundColor: "transparent",
                      borderWidth: 0,
                    }}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {error ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 8,
                      marginLeft: 2,
                    }}
                  >
                    <Ionicons name="alert-circle" size={15} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "600" }}>
                      {error}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* CTA */}
              <TouchableOpacity
                onPress={handleSubmit}
                activeOpacity={0.82}
                disabled={loading}
                style={{ marginTop: 32 }}
              >
                <LinearGradient
                  colors={["#6b4b41", "#3D1D1C"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    height: 62,
                    borderRadius: 18,
                    justifyContent: "center",
                    alignItems: "center",
                    flexDirection: "row",
                    gap: 10,
                    ...colors.shadowMd,
                  }}
                >
                  {loading ? (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2.5,
                        borderColor: "rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                      }}
                    />
                  ) : (
                    <>
                      <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
                        Get Access Code
                      </Text>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: "rgba(255,255,255,0.18)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                      </View>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Register link */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  marginTop: 28,
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 15, color: colors.textSecondary }}>
                  New to Modula?
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate(ROUTES.REGISTER)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 14,
                    backgroundColor: colors.primaryLight,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "800", color: colors.primary }}>
                    Join Now
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Trust line */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  marginTop: 36,
                  gap: 6,
                  opacity: 0.45,
                }}
              >
                <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                <Text style={{ fontSize: 12, color: colors.textMuted, letterSpacing: 0.3 }}>
                  Secured by SSL • Trusted by 5,000+ partners
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default LoginScreen;
