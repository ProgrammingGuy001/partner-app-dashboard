// The Daily Installation Report fields, shared by the check-out flow in
// DailyAttendance and the standalone generator screen.
import React, { useState } from 'react';
import { Image, TextInput, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { IconButton } from '../common/Primitives';
import {
  addReportRow,
  emptyProgressRow,
  emptyUpcomingRow,
  LIMITS,
  MAX_PROGRESS_PHOTOS,
  MAX_REPORT_ROWS,
} from '../../util/dailyReport';

export const ReportInput = ({
  label,
  value,
  placeholder,
  onChangeText,
  colors,
  maxLength = LIMITS.action,
  keyboardType = 'default',
  multiline = false,
  error,
}) => (
  <View className="gap-1">
    {label ? <Text className="text-xs font-medium text-muted-foreground">{label}</Text> : null}
    <TextInput
      accessibilityLabel={label || placeholder}
      value={value}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      onChangeText={onChangeText}
      maxLength={maxLength}
      keyboardType={keyboardType}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      className={`rounded-xl border border-border bg-background px-3 text-sm text-foreground ${
        multiline ? 'min-h-20 py-2' : 'h-11'
      }`}
      aria-invalid={Boolean(error)}
    />
    {error ? <Text accessibilityRole="alert" className="text-xs text-destructive">{error}</Text> : null}
  </View>
);

const MANPOWER_ROWS = [
  ['IPs', 'num_ips', 'ip_in_time', 'ip_out_time'],
  ['Helpers', 'num_helpers', 'helper_in_time', 'helper_out_time'],
  ['Labour', 'num_labour', 'labour_in_time', 'labour_out_time'],
];

const DailyReportForm = ({
  reportData,
  setReportData,
  colors,
  progressPhotos,
  onPickPhotos,
  onRemovePhoto,
}) => {
  const [visibleManpowerRows, setVisibleManpowerRows] = useState(() =>
    MANPOWER_ROWS.reduce(
      (visible, [, ...fields], index) => fields.some((field) => reportData[field]) ? index + 1 : visible,
      1,
    )
  );

  return <>
    <Text className="text-sm font-semibold text-foreground">Key accomplishments</Text>
    {reportData.accomplishments.map((value, index) => (
      <ReportInput key={index} colors={colors} value={value}
        label={index === 0 ? 'Accomplishment 1 (required)' : `Accomplishment ${index + 1}`}
        placeholder="What was achieved on site today"
        onChangeText={(text) => setReportData((current) => ({ ...current, accomplishments: current.accomplishments.map((item, i) => i === index ? text : item) }))} />
    ))}
    {reportData.accomplishments.length < MAX_REPORT_ROWS ? (
      <Button
        variant="outline"
        onPress={() => setReportData((current) => ({
          ...current,
          accomplishments: addReportRow(current.accomplishments, ''),
        }))}
        accessibilityLabel="Add accomplishment"
        className="w-full"
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text className="text-sm font-semibold text-primary">Add accomplishment</Text>
      </Button>
    ) : null}

    <Text className="text-sm font-semibold text-foreground">Completed work</Text>
    {reportData.completed_work.map((row, index) => (
      <View key={index} className="gap-2 rounded-lg border border-border p-2">
        <ReportInput label={`Action item ${index + 1}`} value={row.action_item} placeholder="Work completed" colors={colors} onChangeText={(text) => setReportData((current) => ({ ...current, completed_work: current.completed_work.map((item, i) => i === index ? { ...item, action_item: text } : item) }))} />
        <ReportInput label="Date" value={row.date} placeholder="DD/MM/YYYY" maxLength={10} keyboardType="numbers-and-punctuation" colors={colors} onChangeText={(text) => setReportData((current) => ({ ...current, completed_work: current.completed_work.map((item, i) => i === index ? { ...item, date: text } : item) }))} />
        <ReportInput label="Challenges faced" value={row.challenges_faced} placeholder="Blockers, delays, rework" maxLength={LIMITS.notes} multiline colors={colors} onChangeText={(text) => setReportData((current) => ({ ...current, completed_work: current.completed_work.map((item, i) => i === index ? { ...item, challenges_faced: text } : item) }))} />
      </View>
    ))}
    {reportData.completed_work.length < MAX_REPORT_ROWS ? (
      <Button
        variant="outline"
        onPress={() => setReportData((current) => ({
          ...current,
          completed_work: addReportRow(current.completed_work, emptyProgressRow()),
        }))}
        accessibilityLabel="Add completed work"
        className="w-full"
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text className="text-sm font-semibold text-primary">Add completed work</Text>
      </Button>
    ) : null}

    <Text className="text-sm font-semibold text-foreground">Manpower</Text>
    {MANPOWER_ROWS.slice(0, visibleManpowerRows).map(([label, count, inTime, outTime]) => (
      <View key={label} className="gap-2 rounded-lg border border-border p-2">
        <Text className="text-xs font-semibold text-foreground">{label}</Text>
        <ReportInput label="Count" value={reportData[count]} placeholder="0" maxLength={LIMITS.short} keyboardType="number-pad" colors={colors} onChangeText={(text) => setReportData((current) => ({ ...current, [count]: text }))} />
        <ReportInput label="In time" value={reportData[inTime]} placeholder="HH:MM" maxLength={5} keyboardType="numbers-and-punctuation" colors={colors} onChangeText={(text) => setReportData((current) => ({ ...current, [inTime]: text }))} />
        <ReportInput label="Out time" value={reportData[outTime]} placeholder="HH:MM" maxLength={5} keyboardType="numbers-and-punctuation" colors={colors} onChangeText={(text) => setReportData((current) => ({ ...current, [outTime]: text }))} />
      </View>
    ))}
    {visibleManpowerRows < MANPOWER_ROWS.length ? (
      <Button
        variant="outline"
        onPress={() => setVisibleManpowerRows((current) => current + 1)}
        accessibilityLabel="Add manpower row"
        className="w-full"
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text className="text-sm font-semibold text-primary">Add manpower row</Text>
      </Button>
    ) : null}
    <ReportInput label="Mandays" value={reportData.mandays} placeholder="0" maxLength={LIMITS.short} keyboardType="decimal-pad" colors={colors} onChangeText={(text) => setReportData((current) => ({ ...current, mandays: text }))} />

    <Text className="text-sm font-semibold text-foreground">Upcoming work for next day</Text>
    {reportData.upcoming_work.map((row, index) => (
      <View key={index} className="gap-2 rounded-lg border border-border p-2">
        <ReportInput label={`Action item ${index + 1}`} value={row.action_item} placeholder="Work planned" colors={colors} onChangeText={(text) => setReportData((current) => ({ ...current, upcoming_work: current.upcoming_work.map((item, i) => i === index ? { ...item, action_item: text } : item) }))} />
        <ReportInput label="Date" value={row.date} placeholder="DD/MM/YYYY" maxLength={10} keyboardType="numbers-and-punctuation" colors={colors} onChangeText={(text) => setReportData((current) => ({ ...current, upcoming_work: current.upcoming_work.map((item, i) => i === index ? { ...item, date: text } : item) }))} />
        <ReportInput label="Potential issues" value={row.potential_issues} placeholder="Risks, dependencies, material gaps" maxLength={LIMITS.notes} multiline colors={colors} onChangeText={(text) => setReportData((current) => ({ ...current, upcoming_work: current.upcoming_work.map((item, i) => i === index ? { ...item, potential_issues: text } : item) }))} />
      </View>
    ))}
    {reportData.upcoming_work.length < MAX_REPORT_ROWS ? (
      <Button
        variant="outline"
        onPress={() => setReportData((current) => ({
          ...current,
          upcoming_work: addReportRow(current.upcoming_work, emptyUpcomingRow()),
        }))}
        accessibilityLabel="Add upcoming work"
        className="w-full"
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text className="text-sm font-semibold text-primary">Add upcoming work</Text>
      </Button>
    ) : null}

    <Text className="text-sm font-semibold text-foreground">
      Progress photos ({progressPhotos.length}/{MAX_PROGRESS_PHOTOS})
    </Text>
    <Text className="text-xs text-muted-foreground">
      Optional images, maximum 2 MB each, are added after the generated report.
    </Text>
    <Button
      variant="outline"
      onPress={onPickPhotos}
      accessibilityLabel="Choose progress photos"
      disabled={progressPhotos.length >= MAX_PROGRESS_PHOTOS}
      className="w-full"
    >
      <Ionicons name="images-outline" size={18} color={colors.primary} />
      <Text className="text-sm font-semibold text-primary">Choose photos</Text>
    </Button>
    {progressPhotos.length > 0 ? (
      <View className="flex-row flex-wrap gap-2">
        {progressPhotos.map((file, index) => (
          <View key={`${file.uri}-${index}`} className="relative h-24 min-w-24 flex-1 overflow-hidden rounded-lg border border-border">
            <Image source={{ uri: file.uri }} className="h-full w-full" resizeMode="cover" />
            <IconButton
              icon="close"
              tone="danger"
              label={`Remove progress photo ${index + 1}`}
              onPress={() => onRemovePhoto(index)}
              className="absolute right-1 top-1"
            />
          </View>
        ))}
      </View>
    ) : null}
  </>
};

export default DailyReportForm;
