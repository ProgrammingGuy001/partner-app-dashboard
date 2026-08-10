import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { ROUTES } from '../../util/constants';

/** Shown after a requisite is created, from either the submit or the review flow. */
const RequisiteSuccessPanel = ({ navigation }) => {
  const { colors } = useTheme();
  const clearBucket = useRequisiteStore((state) => state.clearBucket);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center items-center px-6">
        <View
          className="bg-surface rounded-2xl p-8 items-center w-full border border-border"
          style={colors.shadowMd}
        >
          <View
            className="w-20 h-20 rounded-[40px] items-center justify-center mb-6"
            style={{ backgroundColor: colors.success + '15' }}
          >
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text className="text-2xl font-extrabold text-foreground text-center mb-2">Submitted!</Text>
          <Text className="text-[15px] text-muted-foreground text-center mb-8 leading-[22px]">
            Your site requisite request has been successfully created and saved to history.
          </Text>

          <View className="w-full gap-3">
            <Button
              className="h-14 rounded-2xl bg-primary"
              onPress={() => {
                clearBucket();
                navigation.navigate(ROUTES.HISTORY);
              }}
            >
              <Text className="text-primary-foreground font-bold">View Requisite History</Text>
            </Button>
            <TouchableOpacity
              className="h-[56px] items-center justify-center rounded-2xl"
              accessibilityRole="button"
              accessibilityLabel="Create new request"
              onPress={() => {
                clearBucket();
                navigation.navigate(ROUTES.SITE_REQUISITE);
              }}
            >
              <Text className="text-primary font-bold">Create New Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default RequisiteSuccessPanel;
