import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Text } from '@/components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';
import { useResponsive } from '../../hooks/useResponsive';
import { useTheme } from '../../hooks/useTheme';
import { validators } from '../../util/validators';
import Ionicons from '@react-native-vector-icons/ionicons';

const { width } = Dimensions.get('window');
const OTP_LENGTH = 6;

const OTPScreen = ({ navigation }) => {
  const { verifyOtp, resendOtp } = useAuth();
  const phoneNumber = useAuthStore((state) => state.phoneNumber);
  const { maxCardWidth, isTablet } = useResponsive();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [focused, setFocused] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (!phoneNumber) navigation.navigate('Login');
  }, [phoneNumber, navigation]);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const updated = [...otp];
    updated[index] = value;
    setOtp(updated);
    setError('');
    if (value) {
      Haptics.selectionAsync();
      if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index, key) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const otpValue = otp.join('');
    const validation = validators.otp(otpValue);
    if (!validation.valid) { setError(validation.message); return; }
    setLoading(true);
    const result = await verifyOtp(otpValue);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    await resendOtp();
    setResendLoading(false);
    setTimer(60);
    setOtp(Array(OTP_LENGTH).fill(''));
    setError('');
  };

  const maskedPhone = phoneNumber ? `+91 ••••••${phoneNumber.slice(-4)}` : '';
  const otpComplete = otp.join('').length === OTP_LENGTH;
  
  // Calculate OTP box size - constrain to maxCardWidth on tablets
  const containerWidth = isTablet ? Math.min(maxCardWidth || 500, width - 48) : width - 48;
  const BOX_SIZE = Math.floor((containerWidth - 40) / 6);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
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
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              className="w-11 h-11 rounded-[14px] bg-surface items-center justify-center border border-border"
              style={colors.shadowSm}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View
            className="flex-1 justify-center px-6"
            style={{ alignItems: isTablet ? 'center' : 'stretch' }}
          >
            <View className="w-full" style={{ maxWidth: maxCardWidth ?? '100%' }}>

              {/* Shield badge */}
              <View className="self-center mb-8">
                <View className="w-[88px] h-[88px] rounded-[44px] bg-primary-light justify-center items-center">
                  <View className="w-[60px] h-[60px] rounded-[30px] bg-primary justify-center items-center">
                    <Ionicons name="shield-checkmark" size={30} color="#fff" />
                  </View>
                </View>
              </View>

              {/* Title */}
              <Text className="text-[30px] font-black text-foreground text-center tracking-[-1px] mb-2.5">
                Verify it's you
              </Text>
              <Text className="text-[15px] text-muted-foreground text-center leading-[22px] mb-10">
                We sent a 6-digit code to{'\n'}
                <Text className="font-extrabold text-foreground">{maskedPhone}</Text>
              </Text>

              {/* OTP boxes */}
              <View className="flex-row justify-center flex-wrap mb-2" style={{ gap: isTablet ? 12 : 8 }}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    value={digit}
                    onChangeText={(value) => handleChange(index, value)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                    onFocus={() => setFocused(index)}
                    onBlur={() => setFocused(null)}
                    maxLength={1}
                    keyboardType="number-pad"
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
                      borderRadius: 16,
                      backgroundColor: digit
                        ? colors.primaryLight
                        : focused === index
                        ? colors.surface
                        : colors.surface,
                      textAlign: 'center',
                      fontSize: 24,
                      fontWeight: '800',
                      color: digit ? colors.primary : colors.text,
                    }}
                  />
                ))}
              </View>

              {error ? (
                <View className="flex-row items-center justify-center gap-1.5 mb-6 mt-2">
                  <Ionicons name="alert-circle" size={15} color={colors.danger} />
                  <Text className="text-danger text-[13px] font-semibold">{error}</Text>
                </View>
              ) : (
                <View className="h-10" />
              )}

              {/* Verify CTA */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!otpComplete || loading}
                activeOpacity={0.82}
              >
                <LinearGradient
                  colors={otpComplete ? ['#6b4b41', '#3D1D1C'] : [colors.border, colors.borderStrong || '#d1d5db']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="h-[62px] rounded-[18px] items-center justify-center"
                  style={colors.shadowMd}
                >
                  {loading ? (
                    <View className="w-[22px] h-[22px] rounded-full border-[2.5px] border-white/30 border-t-white" />
                  ) : (
                    <Text className="text-white text-[17px] font-extrabold">
                      Verify & Continue
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Resend / timer */}
              <View className="items-center mt-7">
                {timer > 0 ? (
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm text-muted-foreground">Resend code in</Text>
                    <View className="px-2.5 py-1 bg-primary-light rounded-lg">
                      <Text className="text-sm text-primary font-extrabold">
                        {String(Math.floor(timer / 60)).padStart(2, '0')}:{String(timer % 60).padStart(2, '0')}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleResend}
                    disabled={resendLoading}
                    className="py-2.5 px-5 bg-primary-light rounded-xl"
                  >
                    <Text className="text-sm font-extrabold text-primary">
                      {resendLoading ? 'Sending…' : 'Resend Code'}
                    </Text>
                  </TouchableOpacity>
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