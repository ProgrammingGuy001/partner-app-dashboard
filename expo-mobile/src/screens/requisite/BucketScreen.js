import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import EmptyState from '../../components/common/EmptyState';
import BucketItemCard from '../../components/requisite/BucketItemCard';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { ROUTES } from '../../util/constants';

const BucketScreen = ({ navigation }) => {
  const bucket = useRequisiteStore((state) => state.bucket);
  const { colors } = useTheme();
  const onPrimary = colors.primaryForeground;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View className="flex-1 px-5">
        {/* Header */}
        <View className="flex-row items-center gap-3 pt-4 mb-6">
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync().catch(() => {}); navigation.goBack(); }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="w-11 h-11 rounded-full bg-surface items-center justify-center border border-border"
            style={colors.shadowSm}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xs font-bold text-muted-foreground uppercase">
              BOM BUCKET
            </Text>
            <Text className="text-xl font-extrabold text-foreground">
              My Selection ({bucket.length})
            </Text>
          </View>
          <TouchableOpacity
            disabled={!bucket.length}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); navigation.navigate(ROUTES.SUBMIT); }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Proceed to submit"
            accessibilityState={{ disabled: !bucket.length }}
            className="h-11 px-4 rounded-xl items-center justify-center"
            style={{
              backgroundColor: colors.primary,
              opacity: bucket.length ? 1 : 0.4
            }}
          >
            <Text className="font-bold text-[13px]" style={{ color: onPrimary }}>Submit</Text>
          </TouchableOpacity>
        </View>

        {!bucket.length ? (
          <View className="flex-1 items-center justify-center pb-[100px]">
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
            contentContainerStyle={{ gap: 16, paddingBottom: 40 }}
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
