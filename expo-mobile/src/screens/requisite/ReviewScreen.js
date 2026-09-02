import React, { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import BucketItemCard from '../../components/requisite/BucketItemCard';
import RequisiteSubmitForm from '../../components/requisite/RequisiteSubmitForm';
import RequisiteSuccessPanel from '../../components/requisite/RequisiteSuccessPanel';
import useRequisiteStore from '../../store/requisiteStore';
import { useResponsive } from '../../hooks/useResponsive';
import { ROUTES } from '../../util/constants';
import ScreenHeader from '../../components/common/ScreenHeader';
import { IconButton, StatusBadge } from '../../components/common/Primitives';
import { spacing } from '../../theme/designSystem';

/**
 * Review the bucket and submit, in one pass — the mobile counterpart of the web
 * client's /site-requisite/review, which renders its bucket and submit pages
 * together. Editing an item and confirming the request no longer means walking
 * two separate screens.
 */
const ReviewScreen = ({ navigation }) => {
  const bucket = useRequisiteStore((state) => state.bucket);
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
      <ScreenHeader eyebrow="Site requisite" title="Review Site Requisite" subtitle="Complete each component and submit the request." />
      <IconButton icon="arrow-back" label="Back to component selection" onPress={() => navigation.navigate(ROUTES.SITE_REQUISITE)} className="mb-4" />

      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-extrabold text-foreground">Components</Text>
        <StatusBadge label={`${bucket.length} total`} tone="primary" />
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
          contentContainerStyle={{ paddingHorizontal: px, paddingBottom: spacing.xl * 4 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ReviewScreen;
