import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, FlatList, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from '@/components/ui/text';
import RequisiteSubmitForm from '../../components/requisite/RequisiteSubmitForm';
import RequisiteSuccessPanel from '../../components/requisite/RequisiteSuccessPanel';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { useResponsive } from '../../hooks/useResponsive';

const SubmitScreen = ({ navigation }) => {
  const bucket = useRequisiteStore((state) => state.bucket);
  const { colors } = useTheme();
  const { px } = useResponsive();

  const [success, setSuccess] = useState(false);

  if (success) {
    return <RequisiteSuccessPanel navigation={navigation} />;
  }

  const renderHeader = () => (
        <>
          {/* Header */}
          <View className="flex-row items-center gap-3 pt-4 mb-6">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
              style={colors.shadowSm}
              accessibilityRole="button"
              accessibilityLabel="Go Back"
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <View>
              <Text className="text-xs font-bold text-muted-foreground uppercase">
                FINAL STEP
              </Text>
              <Text className="text-xl font-extrabold text-foreground">
                Confirm Requisite
              </Text>
            </View>
          </View>

          <RequisiteSubmitForm onSubmitted={() => setSuccess(true)} />

          <View className="flex-row items-center justify-between mb-4 mt-2">
            <Text className="text-base font-extrabold text-foreground">Items Summary</Text>
            <View className="bg-primary-light px-2 py-1 rounded-lg">
               <Text className="text-xs font-extrabold text-primary">{bucket.length} Total</Text>
            </View>
          </View>
        </>
      );

      const renderItem = ({ item, index }) => (
        <View
          className="p-4 bg-background rounded-2xl border border-border mb-3 shadow-sm"
        >
          <Text className="text-sm font-bold text-foreground">{index + 1}. {item.product_name}</Text>
          <View className="flex-row mt-2 items-center gap-3 flex-wrap">
             <View className="flex-row items-center gap-1">
                <Ionicons name="layers-outline" size={14} color={colors.textSecondary} />
                <Text className="text-xs text-muted-foreground">
                  <Text className="font-bold">Qty:</Text> {item.quantity}
                </Text>
             </View>
             {item.responsible_department && (
               <View
                 className="px-2 py-0.5 rounded-lg flex-row items-center gap-1"
                 style={{ backgroundColor: colors.primary + '20' }}
               >
                 <Ionicons name="business-outline" size={12} color={colors.primary} />
                 <Text className="text-xs font-bold capitalize" style={{ color: colors.primary }}>
                   {item.responsible_department}
                 </Text>
               </View>
             )}
             {item.component_status && (
               <View className="px-2 py-0.5 rounded-lg bg-muted">
                 <Text className="text-xs font-bold text-foreground capitalize">
                   {item.component_status}
                 </Text>
               </View>
             )}
          </View>
        </View>
      );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          data={bucket}
          keyExtractor={(item) => item.product_name}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SubmitScreen;
