import React, { useCallback } from 'react';
import { View, FlatList, Platform } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui';
import JobCard from './JobCard';
import { useDashboardStore } from '../../store/dashboardStore';
import { useResponsive } from '../../hooks/useResponsive';

const EmptyJobs = React.memo(() => (
  <View className="items-center rounded-2xl border border-border bg-card p-9 gap-2.5">
    <View className="bg-primary-light rounded-full p-4 mb-1">
      <Ionicons name="briefcase-outline" size={36} color="#9a8b84" />
    </View>
    <Text className="text-[15px] font-bold text-foreground">No Jobs Found</Text>
    <Text className="text-[13px] text-muted-foreground text-center leading-[18px]">
      There are no jobs matching the selected filter.
    </Text>
  </View>
));

const MemoizedJobCard = React.memo(JobCard);

const JobList = ({ onJobPress, ...props }) => {
  const jobs = useDashboardStore((state) => state.jobs);
  const activeFilter = useDashboardStore((state) => state.activeFilter);
  const { isTablet, gap } = useResponsive();

  const filteredJobs = React.useMemo(
    () => jobs.filter((job) => job.status === activeFilter),
    [jobs, activeFilter]
  );

  const handleJobPress = useCallback((item) => {
    onJobPress(item);
  }, [onJobPress]);

  const renderItem = useCallback(({ item }) => (
    <MemoizedJobCard job={item} onPress={() => handleJobPress(item)} />
  ), [handleJobPress]);

  const keyExtractor = useCallback((item) => String(item.id), []);

  if (isTablet) {
    return (
      <FlatList
        data={filteredJobs}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ gap, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: '50%' }}>
            <MemoizedJobCard job={item} onPress={() => handleJobPress(item)} />
          </View>
        )}
        ListEmptyComponent={EmptyJobs}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        showsVerticalScrollIndicator={false}
        {...props}
      />
    );
  }

  return (
    <FlatList
      data={filteredJobs}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={{ gap: 0, paddingBottom: 120 }}
      ListEmptyComponent={EmptyJobs}
      initialNumToRender={6}
      maxToRenderPerBatch={5}
      windowSize={5}
      removeClippedSubviews={Platform.OS === 'android'}
      showsVerticalScrollIndicator={false}
      {...props}
    />
  );
};

export default React.memo(JobList);
