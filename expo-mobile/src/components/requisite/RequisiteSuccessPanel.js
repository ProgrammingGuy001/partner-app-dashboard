import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import useRequisiteStore from '../../store/requisiteStore';
import { ROUTES } from '../../util/constants';
import { Card, Notice } from '../common/Primitives';

/** Shown after a requisite is created, from either the submit or the review flow. */
const RequisiteSuccessPanel = ({ navigation }) => {
  const clearBucket = useRequisiteStore((state) => state.clearBucket);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center items-center px-6">
        <Card elevated className="items-center w-full">
          <Notice tone="success" title="Requisite submitted" message="Your request was created and saved to history." className="mb-6 w-full" />
          <Text className="text-2xl font-extrabold text-foreground text-center mb-2">Submitted!</Text>
          <Text className="text-base text-muted-foreground text-center mb-8 leading-6">
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
            <Button
              variant="ghost"
              accessibilityRole="button"
              accessibilityLabel="Create new request"
              onPress={() => {
                clearBucket();
                navigation.navigate(ROUTES.SITE_REQUISITE);
              }}
            >
              <Text>Create New Request</Text>
            </Button>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
};

export default RequisiteSuccessPanel;
