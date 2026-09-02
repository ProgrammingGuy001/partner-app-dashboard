import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button, Input, Text } from "@/components/ui";
import { FieldLabel, Notice } from "../../components/common/Primitives";
import { useAuth } from "../../hooks/useAuth";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { spacing, typography } from "../../theme/designSystem";
import { validators } from "../../util/validators";

const REGISTER_DRAFT_KEY = "register-form-draft";
const EMPTY_FORM = { phoneNumber: "", firstName: "", lastName: "", city: "", pincode: "", isInternal: false };
const SERVER_FIELD_NAMES = {
  phone_number: "phoneNumber",
  first_name: "firstName",
  last_name: "lastName",
  city: "city",
  pincode: "pincode",
  is_internal: "isInternal",
};

const FieldError = ({ message }) => message ? <Text accessibilityRole="alert" style={typography.micro} className="mt-1 text-destructive">{message}</Text> : null;

const RegisterScreen = ({ navigation }) => {
  const { register } = useAuth();
  const { maxCardWidth, isTablet } = useResponsive();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const saveTimerRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(REGISTER_DRAFT_KEY).then((saved) => {
      if (!saved) return;
      try { setFormData((current) => ({ ...current, ...JSON.parse(saved) })); } catch {}
    });
  }, []);

  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(formData)).catch(() => {});
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [formData]);

  const updateField = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setSubmitError("");
  };

  const validateForm = () => {
    const next = {};
    const phone = validators.phone(formData.phoneNumber);
    const first = validators.name(formData.firstName);
    const last = validators.name(formData.lastName);
    const pincode = validators.pincode(formData.pincode);
    if (!phone.valid) next.phoneNumber = phone.message;
    if (!first.valid) next.firstName = first.message;
    if (!last.valid) next.lastName = last.message;
    if (!formData.city.trim()) next.city = "City is required";
    if (!pincode.valid) next.pincode = pincode.message;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setSubmitError("");
    const result = await register(formData);
    setLoading(false);
    if (result.success) {
      AsyncStorage.removeItem(REGISTER_DRAFT_KEY).catch(() => {});
      navigation.navigate("OTP");
      return;
    }
    const serverErrors = Object.fromEntries(
      Object.entries(result.fieldErrors || {}).map(([field, message]) => [SERVER_FIELD_NAMES[field] || field, message]),
    );
    setErrors((current) => ({ ...current, ...serverErrors }));
    setSubmitError(result.error);
  };

  const inputClass = "h-14 rounded-2xl bg-surface";

  return (
    <View className="flex-1">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={colors.brandGradient} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
          <View className="flex-row items-center gap-4 px-8 pb-8" style={{ paddingTop: insets.top + spacing.lg }}>
            <Image source={require("../../../assets/icon.png")} className="w-11 h-11 rounded-xl" resizeMode="contain" />
            <View>
              <Text style={[typography.title2, { color: colors.primaryForeground }]}>Partner registration</Text>
              <Text style={[typography.caption, { color: colors.primaryForeground }]} className="mt-1">Join our professional network</Text>
            </View>
          </View>

          <View className="flex-1 bg-background rounded-t-3xl px-6 pt-8" style={{ paddingBottom: insets.bottom + spacing.xl, alignItems: isTablet ? "center" : "stretch" }}>
            <View className="w-full gap-5" style={{ maxWidth: maxCardWidth ?? "100%" }}>
              {submitError ? <Notice tone="danger" title="Registration not completed" message={submitError} /> : null}

              <View>
                <FieldLabel required>Mobile number</FieldLabel>
                <View className={`h-14 flex-row items-center rounded-2xl border bg-surface px-4 ${errors.phoneNumber ? "border-destructive" : "border-border"}`}>
                  <Text style={typography.bodyStrong} className="mr-3 text-foreground">+91</Text>
                  <View className="h-5 w-px bg-border mr-3" />
                  <Input value={formData.phoneNumber} onChangeText={(value) => updateField("phoneNumber", value)} keyboardType="number-pad" maxLength={10} placeholder="9876543210" accessibilityLabel="Mobile number" textContentType="telephoneNumber" autoComplete="tel" className="flex-1 border-0 bg-transparent text-base font-semibold" />
                </View>
                <FieldError message={errors.phoneNumber} />
              </View>

              <View>
                <FieldLabel required>Full name</FieldLabel>
                <View className="flex-row gap-3">
                  <View className="flex-1"><Input value={formData.firstName} onChangeText={(value) => updateField("firstName", value)} placeholder="First name" accessibilityLabel="First name" className={`${inputClass} ${errors.firstName ? "border-destructive" : "border-border"}`} /><FieldError message={errors.firstName} /></View>
                  <View className="flex-1"><Input value={formData.lastName} onChangeText={(value) => updateField("lastName", value)} placeholder="Last name" accessibilityLabel="Last name" className={`${inputClass} ${errors.lastName ? "border-destructive" : "border-border"}`} /><FieldError message={errors.lastName} /></View>
                </View>
              </View>

              <View>
                <FieldLabel required>Location</FieldLabel>
                <View className="flex-row gap-3">
                  <View className="flex-1"><Input value={formData.city} onChangeText={(value) => updateField("city", value)} placeholder="City" accessibilityLabel="City" className={`${inputClass} ${errors.city ? "border-destructive" : "border-border"}`} /><FieldError message={errors.city} /></View>
                  <View className="flex-1"><Input value={formData.pincode} onChangeText={(value) => updateField("pincode", value)} keyboardType="number-pad" maxLength={6} placeholder="Pincode" accessibilityLabel="Pincode" className={`${inputClass} ${errors.pincode ? "border-destructive" : "border-border"}`} /><FieldError message={errors.pincode} /></View>
                </View>
              </View>

              <Button variant={formData.isInternal ? "default" : "outline"} onPress={() => updateField("isInternal", !formData.isInternal)} accessibilityRole="checkbox" accessibilityState={{ checked: formData.isInternal }} accessibilityLabel="I am a Modula employee" className="justify-start">
                <Ionicons name={formData.isInternal ? "checkbox" : "square-outline"} size={typography.body.fontSize} color={formData.isInternal ? colors.primaryForeground : colors.textMuted} />
                I am a Modula employee
              </Button>

              <Button size="lg" loading={loading} onPress={handleSubmit} accessibilityLabel="Create account">Create account</Button>
              <View className="flex-row justify-center items-center gap-2">
                <Text style={typography.caption} className="text-muted-foreground">Already have an account?</Text>
                <Button variant="ghost" size="sm" onPress={() => navigation.navigate("Login")}>Sign in</Button>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default RegisterScreen;
