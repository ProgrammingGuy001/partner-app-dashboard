import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';
import ScreenHeader from '../../components/common/ScreenHeader';
import { Card, IconButton, Notice, StatusBadge } from '../../components/common/Primitives';
import EmptyState from '../../components/common/EmptyState';
import Loader from '../../components/common/Loader';
import { Button } from '../../components/ui/button';
import { getApiErrorMessage } from '../../api/apiErrors';
import { getRoster } from '../../api/rosterApi';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../../theme/designSystem';
import { ROSTER_STATUS_LABEL } from '../../util/constants';

const toIso = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const fromIso = (value) => new Date(`${value}T00:00:00`);
const addDays = (value, days) => {
  const date = fromIso(value);
  date.setDate(date.getDate() + days);
  return toIso(date);
};
const statusTone = {
  scheduled: 'info', blocked: 'neutral', check_in_open: 'warning', checked_in: 'primary',
  report_due: 'warning', completed: 'success', missed: 'danger', auto_closed: 'neutral',
};

export default function RosterScreen() {
  const { colors } = useTheme();
  const [weekStart, setWeekStart] = useState(toIso(new Date()));
  const [selectedDay, setSelectedDay] = useState(toIso(new Date()));
  const [roster, setRoster] = useState({ slots: [], entries: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const weekEnd = addDays(weekStart, 6);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  const loadRoster = useCallback(async () => {
    try {
      const data = await getRoster({ date_from: weekStart, date_to: weekEnd });
      setRoster({ slots: data.slots || [], entries: data.entries || [] });
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    setLoading(true);
    loadRoster().finally(() => setLoading(false));
  }, [loadRoster]);

  const moveWeek = (daysToMove) => {
    const next = addDays(weekStart, daysToMove);
    setWeekStart(next);
    setSelectedDay(next);
  };
  const entries = roster.entries.filter((entry) => entry.work_date === selectedDay);
  const hasAssignments = roster.entries.length > 0;
  const hasRosterData = roster.slots.length > 0 || hasAssignments;
  const fatalError = Boolean(error && !hasRosterData);
  const partial = roster.slots.length !== 2 || Boolean(error && hasRosterData);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await loadRoster(); } finally { setRefreshing(false); } }} tintColor={colors.primary} />}
      >
        <ScreenHeader
          eyebrow="Field operations"
          title="My roster"
          subtitle="Your daily job and attendance status"
          right={<View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary-light"><Ionicons name="calendar-outline" size={22} color={colors.primary} /></View>}
        />

        <View className="mb-4 flex-row items-center justify-between">
          <IconButton icon="chevron-back" label="Previous week" onPress={() => moveWeek(-7)} />
          <Button variant="outline" size="sm" onPress={() => { const today = toIso(new Date()); setWeekStart(today); setSelectedDay(today); }}>
            <Text>Today</Text>
          </Button>
          <IconButton icon="chevron-forward" label="Next week" onPress={() => moveWeek(7)} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.md }}>
          {days.map((day) => {
            const date = fromIso(day);
            const selected = day === selectedDay;
            return (
              <Button
                key={day}
                variant="outline"
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedDay(day)}
                className={`h-16 min-w-16 flex-col rounded-2xl px-3 ${selected ? 'border-primary bg-primary-light' : 'border-border bg-surface'}`}
              >
                <Text className={`text-xs font-bold uppercase ${selected ? 'text-primary' : 'text-muted-foreground'}`}>{date.toLocaleDateString('en-IN', { weekday: 'short' })}</Text>
                <Text className="mt-1 text-lg font-extrabold text-foreground">{date.getDate()}</Text>
              </Button>
            );
          })}
        </ScrollView>

        {loading ? <Loader text="Loading roster" /> : null}
        {!loading && fatalError ? <Notice tone="danger" title="Roster unavailable" message={error} className="mb-3" /> : null}
        {!loading && fatalError ? <Button variant="outline" onPress={loadRoster}><Text>Try again</Text></Button> : null}
        {!loading && !fatalError && partial ? <Notice tone="warning" title="Roster may be incomplete" message={error || 'Assignment times are shown where available.'} className="mb-3" /> : null}

        {!loading && !fatalError && !hasAssignments ? (
          <EmptyState icon="calendar-clear-outline" title="No assignments this week" subtitle="Use the week controls to review another date range." />
        ) : null}

        {!loading && !fatalError && hasAssignments ? (
          <View className="gap-3">
            {[1, 2].map((slotNumber) => {
              const slot = roster.slots.find((item) => item.slot_number === slotNumber);
              const entry = entries.find((item) => item.slot_number === slotNumber);
              return (
                <Card key={slotNumber} elevated>
                  <View className="mb-4 flex-row items-center justify-between">
                    <View>
                      <Text className="text-xs font-extrabold uppercase text-muted-foreground">Slot {slotNumber}</Text>
                      <Text className="mt-1 text-sm font-semibold text-foreground">{entry?.slot_start && entry?.slot_end ? `${entry.slot_start}–${entry.slot_end}` : slot ? `${slot.start_time}–${slot.end_time}` : 'Time pending'}</Text>
                    </View>
                    {entry ? <StatusBadge label={ROSTER_STATUS_LABEL[entry.status] || entry.status} tone={statusTone[entry.status]} /> : null}
                  </View>
                  {entry ? (
                    <View className="border-l-2 border-primary pl-4">
                      <Text className="text-lg font-extrabold text-foreground">{entry.job?.name || 'Job details unavailable'}</Text>
                      <View className="mt-2 flex-row items-center gap-2">
                        <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                        <Text className="flex-1 text-sm text-muted-foreground">{entry.job?.customer_city || 'Location pending'}</Text>
                      </View>
                      <Text className="mt-2 text-sm text-muted-foreground">{entry.job?.type || 'Job'}{entry.job?.status ? ` · ${entry.job.status.replaceAll('_', ' ')}` : ''}</Text>
                      {entry.status === 'blocked' ? <Text className="mt-3 text-xs text-warning">Attendance opens after the admin starts this job.</Text> : null}
                    </View>
                  ) : (
                    <View className="items-center py-5">
                      <Ionicons name="calendar-clear-outline" size={24} color={colors.textMuted} />
                      <Text className="mt-2 text-sm text-muted-foreground">No assignment</Text>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
