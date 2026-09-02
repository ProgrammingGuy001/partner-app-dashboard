import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from '@/components/ui/text';
import RequisiteSubmitForm from '../../components/requisite/RequisiteSubmitForm';
import RequisiteSuccessPanel from '../../components/requisite/RequisiteSuccessPanel';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { useResponsive } from '../../hooks/useResponsive';
import EmptyState from '../../components/common/EmptyState';
import ScreenHeader from '../../components/common/ScreenHeader';
import { Card, IconButton, StatusBadge } from '../../components/common/Primitives';
import { Button } from '@/components/ui/button';
import { spacing, typography } from '../../theme/designSystem';

const SubmitScreen = ({ navigation }) => {
  const bucket = useRequisiteStore((state) => state.bucket);
  const { colors } = useTheme();
  const { px } = useResponsive();

  const [success, setSuccess] = useState(false);

  if (success) {
    return <RequisiteSuccessPanel navigation={navigation} />;
  }

  if (!bucket.length) {
    return (
      <SafeAreaView className="flex-1 bg-background px-5 items-center justify-center">
        <EmptyState icon="basket-outline" title="Nothing to submit" subtitle="Add at least one material before confirming the requisite." />
        <Button variant="outline" className="mt-5" onPress={() => navigation.goBack()}>Back to materials</Button>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
        <>
          {/* Header */}
          <ScreenHeader eyebrow="Final step" title="Confirm Requisite" subtitle="Review the request before submission." />
          <IconButton icon="arrow-back" label="Go back" onPress={() => navigation.goBack()} className="mb-4" />

          <RequisiteSubmitForm onSubmitted={() => setSuccess(true)} />

          <View className="flex-row items-center justify-between mb-4 mt-2">
            <Text className="text-base font-extrabold text-foreground">Items Summary</Text>
            <StatusBadge label={`${bucket.length} total`} tone="primary" />
          </View>
        </>
      );

      const renderItem = ({ item, index }) => (
        <Card className="mb-3">
          <Text className="text-sm font-bold text-foreground">{index + 1}. {item.product_name}</Text>
          <View className="flex-row mt-2 items-center gap-3 flex-wrap">
             <View className="flex-row items-center gap-1">
                <Ionicons name="layers-outline" size={typography.caption.fontSize} color={colors.textSecondary} />
                <Text className="text-xs text-muted-foreground">
                  <Text className="font-bold">Qty:</Text> {item.quantity}
                </Text>
             </View>
             {item.responsible_department && (
               <StatusBadge label={item.responsible_department} tone="primary" icon="business-outline" />
             )}
             {item.component_status && (
               <StatusBadge label={item.component_status} />
             )}
          </View>
        </Card>
      );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          data={bucket}
          keyExtractor={(item) => item.product_name}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingHorizontal: px, paddingBottom: spacing.xl * 4 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SubmitScreen;
