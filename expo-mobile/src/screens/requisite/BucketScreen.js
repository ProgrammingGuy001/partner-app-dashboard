import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import EmptyState from '../../components/common/EmptyState';
import BucketItemCard from '../../components/requisite/BucketItemCard';
import useRequisiteStore from '../../store/requisiteStore';
import { ROUTES } from '../../util/constants';
import ScreenHeader from '../../components/common/ScreenHeader';
import { IconButton } from '../../components/common/Primitives';
import { spacing } from '../../theme/designSystem';

const BucketScreen = ({ navigation }) => {
  const bucket = useRequisiteStore((state) => state.bucket);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View className="flex-1 px-5">
        <ScreenHeader
          eyebrow="BOM bucket"
          title={`My selection (${bucket.length})`}
          right={bucket.length ? <Button size="sm" onPress={() => navigation.navigate(ROUTES.SUBMIT)}>Submit</Button> : null}
        />
        <IconButton icon="arrow-back" label="Go back" onPress={() => navigation.goBack()} className="mb-4" />

        {!bucket.length ? (
          <View className="flex-1 items-center justify-center pb-10">
             <EmptyState
               icon="basket-outline"
               title="Your bucket is empty"
               subtitle="Add items from the material hierarchy to create a site requisite request."
             />
             <Button className="rounded-xl px-8 mt-6" onPress={() => navigation.goBack()}>
               <Text className="text-primary-foreground font-bold">Browse Materials</Text>
             </Button>
          </View>
        ) : (
          <FlatList
            data={bucket}
            keyExtractor={(item) => item.product_name}
            contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl + spacing.xs }}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => <BucketItemCard item={item} index={index} />}
          />
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default BucketScreen;
