import React from 'react';
import { Modal, View, ScrollView, TouchableOpacity, Linking } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '../../hooks/useTheme';

const PRIVACY_POLICY_URL = 'https://modula.in/privacy-policy';

const DataPoint = ({ icon, label, colors }) => (
  <View className="flex-row items-center gap-3 py-2">
    <View
      className="w-8 h-8 rounded-full items-center justify-center"
      style={{ backgroundColor: colors.primary + '15' }}
    >
      <Ionicons name={icon} size={16} color={colors.primary} />
    </View>
    <Text className="text-sm text-foreground flex-1">{label}</Text>
  </View>
);

const KYCConsentModal = ({ visible, onAccept, onDecline, type = 'pan' }) => {
  const { colors } = useTheme();

  const isPAN = type === 'pan';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDecline}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View className="bg-surface rounded-t-3xl p-6" style={{ maxHeight: '85%' }}>
          <View className="w-10 h-1 rounded-full bg-border self-center mb-6" />

          <View className="flex-row items-center gap-3 mb-4">
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.primary + '15' }}
            >
              <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-foreground">Data Collection Notice</Text>
              <Text className="text-xs text-muted-foreground">Required for KYC verification</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mb-5">
            <Text className="text-sm text-muted-foreground leading-5 mb-4">
              To verify your identity and enable payouts, we need to collect and process the
              following information:
            </Text>

            <View className="bg-background rounded-2xl px-4 py-2 mb-4">
              {isPAN ? (
                <>
                  <DataPoint icon="card-outline" label="PAN number (10-digit identifier)" colors={colors} />
                  <DataPoint icon="person-outline" label="Name as per PAN records" colors={colors} />
                </>
              ) : (
                <>
                  <DataPoint icon="business-outline" label="Bank account number" colors={colors} />
                  <DataPoint icon="code-slash-outline" label="IFSC code" colors={colors} />
                  <DataPoint icon="person-outline" label="Account holder name" colors={colors} />
                </>
              )}
            </View>

            <Text className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">
              How we use this data
            </Text>
            <Text className="text-sm text-muted-foreground leading-5 mb-4">
              {isPAN
                ? 'Your PAN is used solely to verify your identity for regulatory compliance. It is stored securely and used to link your account for tax and payout purposes.'
                : 'Your bank details are used solely for processing payouts to your account. Details are verified via a trusted third-party service and stored securely.'}
            </Text>

            <Text className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">
              Third-party processing
            </Text>
            <Text className="text-sm text-muted-foreground leading-5 mb-4">
              Verification is performed by Attestr Technologies, a licensed KYC provider. Your data
              is transmitted securely over encrypted channels and is not sold or shared for marketing.
            </Text>

            <TouchableOpacity
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              className="flex-row items-center gap-1.5"
            >
              <Ionicons name="open-outline" size={14} color={colors.primary} />
              <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                Read our Privacy Policy
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <Button
            className="w-full h-14 rounded-2xl bg-primary mb-3"
            onPress={onAccept}
          >
            <Text className="text-white text-base font-bold">I Understand &amp; Agree</Text>
          </Button>

          <TouchableOpacity onPress={onDecline} className="items-center py-2">
            <Text className="text-sm text-muted-foreground font-medium">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default KYCConsentModal;
