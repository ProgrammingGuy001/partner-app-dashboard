import React, { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';
import BucketItemCard from '../../components/requisite/BucketItemCard';
import RequisiteSubmitForm from '../../components/requisite/RequisiteSubmitForm';
import RequisiteSuccessPanel from '../../components/requisite/RequisiteSuccessPanel';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { useResponsive } from '../../hooks/useResponsive';
import { ROUTES } from '../../util/constants';

/**
 * Review the bucket and submit, in one pass — the mobile counterpart of the web
 * client's /site-requisite/review, which renders its bucket and submit pages
 * together. Editing an item and confirming the request no longer means walking
 * two separate screens.
 */
const ReviewScreen = ({ navigation }) => {
  const bucket = useRequisiteStore((state) => state.bucket);
  const { colors } = useTheme();
  const { px } = useResponsive();
  const [success, setSuccess] = useState(false);

  // Nothing to review with an empty bucket. The web page redirects for the same
  // reason; on a stack, replace so Back does not land here again.
  const isEmpty = bucket.length === 0;
  useEffect(() => {
    if (isEmpty && !success) {
      navigation.replace(ROUTES.SITE_REQUISITE);
    }
  }, [isEmpty, navigation, success]);

  if (success) {
    return <RequisiteSuccessPanel navigation={navigation} />;
  }

  if (isEmpty) {
    return null;
  }

  const renderHeader = () => (
    <>
      <View className="flex-row items-center gap-3 pt-4 mb-6">
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            navigation.navigate(ROUTES.SITE_REQUISITE);
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Back to component selection"
          className="w-11 h-11 rounded-full bg-surface items-center justify-center border border-border"
          style={colors.shadowSm}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xs font-bold text-muted-foreground uppercase">SITE REQUISITE</Text>
          <Text className="text-xl font-extrabold text-foreground">Review Site Requisite</Text>
          <Text className="text-[12px] text-muted-foreground font-medium mt-0.5">
            Complete each component and submit the request.
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-extrabold text-foreground">Components</Text>
        <View className="bg-primary-light px-2 py-1 rounded-lg">
          <Text className="text-xs font-extrabold text-primary">{bucket.length} Total</Text>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          data={bucket}
          keyExtractor={(item) => item.product_name}
          renderItem={({ item, index }) => <BucketItemCard item={item} index={index} />}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={
            <View className="mt-6">
              <RequisiteSubmitForm onSubmitted={() => setSuccess(true)} />
            </View>
          }
          ItemSeparatorComponent={() => <View className="h-4" />}
          contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ReviewScreen;
