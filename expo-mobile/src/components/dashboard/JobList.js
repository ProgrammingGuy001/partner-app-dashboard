import React, { useCallback } from 'react';
import { View, FlatList, Platform } from 'react-native';
import JobCard from './JobCard';
import EmptyState from '../common/EmptyState';
import { useDashboardStore } from '../../store/dashboardStore';
import { useResponsive } from '../../hooks/useResponsive';
import { spacing } from '../../theme/designSystem';

const EmptyJobs = React.memo(() => (
  <EmptyState
    icon="briefcase-outline"
    title="No jobs found"
    subtitle="There are no jobs matching the selected filter."
  />
));

const MemoizedJobCard = React.memo(JobCard);

const JobList = ({ onJobPress, ...props }) => {
  const jobs = useDashboardStore((state) => state.jobs);
  const activeFilter = useDashboardStore((state) => state.activeFilter);
  const { isTablet, gap } = useResponsive();

  const filteredJobs = React.useMemo(
    () =>
      activeFilter === 'all'
        ? jobs
        : jobs.filter((job) => job.status === activeFilter),
    [jobs, activeFilter]
  );

  const handleJobPress = useCallback((item) => {
    onJobPress(item);
  }, [onJobPress]);

  const renderItem = useCallback(({ item }) => (
    <MemoizedJobCard job={item} onPress={() => handleJobPress(item)} />
  ), [handleJobPress]);

  const renderTabletItem = useCallback(({ item }) => (
    <View style={{ flex: 1, maxWidth: '50%' }}>
      <MemoizedJobCard job={item} onPress={() => handleJobPress(item)} />
    </View>
  ), [handleJobPress]);

  const keyExtractor = useCallback((item) => String(item.id), []);

  if (isTablet) {
    return (
      <FlatList
        data={filteredJobs}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ gap, paddingBottom: spacing.xl * 4 }}
        renderItem={renderTabletItem}
        ListEmptyComponent={EmptyJobs}
        contentInsetAdjustmentBehavior="automatic"
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
      contentContainerStyle={{ gap: spacing.xxs, paddingBottom: spacing.xl * 4 }}
      ListEmptyComponent={EmptyJobs}
      contentInsetAdjustmentBehavior="automatic"
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
