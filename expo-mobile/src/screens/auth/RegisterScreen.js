import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Input, Text } from "@/components/ui";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { validators } from "../../util/validators";
import Ionicons from "@react-native-vector-icons/ionicons";

const FieldError = ({ msg, colors }) =>
  msg ? (
    <View className="flex-row items-center gap-1 mt-1 ml-0.5">
      <Ionicons name="alert-circle" size={13} color={colors.danger} />
      <Text className="text-[11px] font-semibold text-destructive-muted-foreground">
        {msg}
      </Text>
    </View>
  ) : null;

const SectionLabel = ({ children, colors }) => (
  <Text className="text-[11px] font-bold text-muted-foreground uppercase mb-2 ml-0.5">
    {children}
  </Text>
);

const REGISTER_DRAFT_KEY = "register-form-draft";

const RegisterScreen = ({ navigation }) => {
  const { register } = useAuth();
  const { maxCardWidth, isTablet } = useResponsive();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    phoneNumber: "",
    firstName: "",
    lastName: "",
    city: "",
    pincode: "",
    isInternal: false,
  });
  const [errors, setErrors] = useState({});
  const saveTimerRef = useRef(null);

  // Restore draft on mount
  useEffect(() => {
    AsyncStorage.getItem(REGISTER_DRAFT_KEY).then((saved) => {
      if (!saved) return;
      try {
        setFormData((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch {}
    });
  }, []);

  // Debounce-persist form on every change
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(formData)).catch(
        () => {},
      );
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [formData]);

  const updateField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    const phoneV = validators.phone(formData.phoneNumber);
    if (!phoneV.valid) newErrors.phoneNumber = phoneV.message;
    const firstV = validators.name(formData.firstName);
    if (!firstV.valid) newErrors.firstName = firstV.message;
    const lastV = validators.name(formData.lastName);
    if (!lastV.valid) newErrors.lastName = lastV.message;
    if (!formData.city.trim()) newErrors.city = "City is required";
    const pinV = validators.pincode(formData.pincode);
    if (!pinV.valid) newErrors.pincode = pinV.message;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    const result = await register(formData);
    setLoading(false);
    if (result.success) {
      AsyncStorage.removeItem(REGISTER_DRAFT_KEY).catch(() => {});
      navigation.navigate("OTP");
    }
  };

  const inputFieldClass = "h-[58px] rounded-2xl border-[1.5px] bg-surface";

  return (
    <View className="flex-1">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Full-screen brand gradient */}
      <LinearGradient
        colors={colors.brandGradient}
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
            className="flex-row items-center gap-4 px-8 pb-8"
            style={{ paddingTop: insets.top + 28 }}
          >
            <Image
              source={require("../../../assets/icon.png")}
              className="w-11 h-11 rounded-xl"
              resizeMode="contain"
            />
            <View>
              <Text className="text-[22px] font-black text-white">
                Partner Registration
              </Text>
              <Text className="text-[13px] text-white/55 mt-0.5">
                Join our professional network
              </Text>
            </View>
          </View>

          {/* Floating form card */}
          <View
            className="flex-1 bg-background rounded-t-[36px] px-6 pt-8"
            style={{
              paddingBottom: insets.bottom + 40,
              alignItems: isTablet ? "center" : "stretch",
            }}
          >
            <View
              className="w-full gap-5"
              style={{ maxWidth: maxCardWidth ?? "100%" }}
            >
              {/* Phone */}
              <View>
                <SectionLabel colors={colors}>Mobile Number</SectionLabel>
                <View
                  className="flex-row items-center bg-surface rounded-2xl border-[1.5px] px-4 h-[58px]"
                  style={{
                    borderColor: errors.phoneNumber
                      ? colors.danger
                      : colors.border,
                  }}
                >
                  <Text className="text-[15px] font-bold text-foreground mr-3">
                    +91
                  </Text>
                  <View className="w-[1px] h-5 bg-border mr-3" />
                  <Input
                    value={formData.phoneNumber}
                    onChangeText={(t) => updateField("phoneNumber", t)}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="9876543210"
                    accessibilityLabel="Mobile number"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    className="flex-1 text-base font-semibold border-0 bg-transparent"
                  />
                </View>
                <FieldError msg={errors.phoneNumber} colors={colors} />
              </View>

              {/* Name row */}
              <View>
                <SectionLabel colors={colors}>Full Name</SectionLabel>
                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Input
                      value={formData.firstName}
                      onChangeText={(t) => updateField("firstName", t)}
                      placeholder="First name"
                      accessibilityLabel="First name"
                      textContentType="givenName"
                      autoComplete="given-name"
                      className={`${inputFieldClass} ${errors.firstName ? "border-destructive" : "border-border"}`}
                    />
                    <FieldError msg={errors.firstName} colors={colors} />
                  </View>
                  <View className="flex-1">
                    <Input
                      value={formData.lastName}
                      onChangeText={(t) => updateField("lastName", t)}
                      placeholder="Last name"
                      accessibilityLabel="Last name"
                      textContentType="familyName"
                      autoComplete="family-name"
                      className={`${inputFieldClass} ${errors.lastName ? "border-destructive" : "border-border"}`}
                    />
                    <FieldError msg={errors.lastName} colors={colors} />
                  </View>
                </View>
              </View>

              {/* Location row */}
              <View>
                <SectionLabel colors={colors}>Location</SectionLabel>
                <View className="flex-row gap-2.5">
                  <View className="flex-[1.6]">
                    <Input
                      value={formData.city}
                      onChangeText={(t) => updateField("city", t)}
                      placeholder="City"
                      accessibilityLabel="City"
                      className={`${inputFieldClass} ${errors.city ? "border-destructive" : "border-border"}`}
                    />
                    <FieldError msg={errors.city} colors={colors} />
                  </View>
                  <View className="flex-1">
                    <Input
                      value={formData.pincode}
                      onChangeText={(t) => updateField("pincode", t)}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="Pincode"
                      accessibilityLabel="Pincode"
                      autoComplete="postal-code"
                      className={`${inputFieldClass} ${errors.pincode ? "border-destructive" : "border-border"}`}
                    />
                    <FieldError msg={errors.pincode} colors={colors} />
                  </View>
                </View>
              </View>

              {/* Employee Checkbox */}
              <TouchableOpacity
                onPress={() => updateField("isInternal", !formData.isInternal)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: formData.isInternal }}
                accessibilityLabel="I am a Modula employee"
                className="flex-row items-center bg-surface rounded-2xl border-[1.5px] border-border px-4 py-4 gap-3"
              >
                <View
                  className="w-6 h-6 rounded-lg border-2 items-center justify-center"
                  style={{
                    borderColor: formData.isInternal
                      ? colors.primary
                      : colors.border,
                    backgroundColor: formData.isInternal
                      ? colors.primary
                      : "transparent",
                  }}
                >
                  {formData.isInternal && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={colors.primaryForeground}
                    />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-bold text-foreground">
                    I am a Modula employee
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    Check this if you're an internal team member
                  </Text>
                </View>
              </TouchableOpacity>

              {/* CTA */}
              <TouchableOpacity
                onPress={handleSubmit}
                activeOpacity={0.82}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Create account"
                accessibilityState={{ busy: loading, disabled: loading }}
                className="mt-1"
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="h-[62px] rounded-[18px] items-center justify-center"
                  style={colors.shadowMd}
                >
                  {loading ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primaryForeground}
                    />
                  ) : (
                    <Text
                      className="text-[17px] font-extrabold"
                      style={{ color: colors.primaryForeground }}
                    >
                      Create Account
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Sign-in link */}
              <View className="flex-row justify-center items-center gap-1.5">
                <Text className="text-sm text-muted-foreground">
                  Already have an account?
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                  <Text className="text-sm font-extrabold text-primary">
                    Sign in
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default RegisterScreen;
