import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ActivityIndicator, Image, Alert, TextInput, Linking, Modal, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useToast } from '../../hooks/useToast';
import { todayISO } from '../../util/isoDate';
import { checkOutReportLabel } from '../../util/jobDocuments';
import { useTheme } from '../../hooks/useTheme';
import { dashboardApi } from '../../api/dashboardApi';
import { compressImageUri, compressPickedImage, fileSizeBytes } from '../../util/image';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useDashboardStore } from '../../store/dashboardStore';
import { Card, IconButton, Notice, StatusBadge } from '../common/Primitives';
import { getApiErrorMessage, getApiFieldErrors } from '../../api/apiErrors';
import { radii, spacing, typography } from '../../theme/designSystem';

const LOCATION_TIMEOUT_MS = 8000;
const LOCATION_FALLBACK_TIMEOUT_MS = 12000;
const MAX_ATTENDANCE_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024;

function nextSundayISO() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
const withTimeout = (promise, timeoutMs) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Location request timed out')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const getAttendanceLocation = async () => {
  try {
    return await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      LOCATION_TIMEOUT_MS
    );
  } catch {
    return withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      LOCATION_FALLBACK_TIMEOUT_MS
    );
  }
};

// One IP on one job for one day is a single visit however many slots it spans:
// attendance is marked once, in the first half, and runs to the last slot's end.
const collapseRosterVisits = (entries) => {
  const byJob = new Map();
  entries.forEach((entry) => {
    const current = byJob.get(entry.job_id);
    if (!current || entry.slot_number < current.slot_number) byJob.set(entry.job_id, entry);
  });
  return [...byJob.values()].map((entry) => {
    const slots = entries.filter((item) => item.job_id === entry.job_id);
    return {
      ...entry,
      span_end: slots.reduce((latest, item) => (item.slot_end > latest ? item.slot_end : latest), entry.slot_end),
      span_slots: slots.length,
    };
  });
};

const DailyAttendance = ({ openWith = null }) => {
  const toast = useToast();
  const { colors } = useTheme();
  const onPrimary = colors.primaryForeground;
  const jobs = useDashboardStore((state) => state.jobs);

  const [expanded, setExpanded] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('back');
  const [manualLocation, setManualLocation] = useState('');
  const [attendanceType, setAttendanceType] = useState('check_in');
  const [jobId, setJobId] = useState(null);
  const [rosterEntryId, setRosterEntryId] = useState(null);
  const [todayRoster, setTodayRoster] = useState([]);
  const [reportFile, setReportFile] = useState(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState([]);
  const [missingReports, setMissingReports] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreRecords, setHasMoreRecords] = useState(false);
  const [recordsError, setRecordsError] = useState('');
  const [rosterError, setRosterError] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [sundayError, setSundayError] = useState('');
  const [sundayBlocked, setSundayBlocked] = useState(false);
  const [sundayModalVisible, setSundayModalVisible] = useState(false);
  const [sundayRequests, setSundayRequests] = useState([]);
  const [requestDate, setRequestDate] = useState(nextSundayISO());
  const [sundayRequest, setSundayRequest] = useState(null);
  const [sundayReason, setSundayReason] = useState('');
  const [sundaySubmitting, setSundaySubmitting] = useState(false);

  const fetchSundayRequests = useCallback(async () => {
    try {
      const existing = await dashboardApi.getSundayRequests();
      const requests = existing || [];
      const today = requests.find((request) => request.request_date === todayISO()) || null;
      setSundayRequests(requests);
      setSundayError('');
      setSundayRequest(today);
      if (new Date().getDay() === 0) {
        setSundayBlocked(!today || today.status !== 'approved');
      }
    } catch (error) {
      const message = getApiErrorMessage(error);
      setSundayError(message);
      toast.error(message);
    }
  }, [toast]);

  const fetchRecords = useCallback(async (offset = 0) => {
    const loadingNextPage = offset > 0;
    if (loadingNextPage) setLoadingMore(true);
    else {
      setLoadingRecords(true);
      setRecordsError('');
    }
    try {
      const data = await dashboardApi.getAttendance(offset, 50);
      const nextRecords = data.records || [];
      setRecords((current) => loadingNextPage ? [...current, ...nextRecords] : nextRecords);
      setHasMoreRecords(nextRecords.length === 50);
      setMissingReports(data.missing_reports || []);
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (!loadingNextPage) setRecordsError(message);
      toast.error(message);
    } finally {
      if (loadingNextPage) setLoadingMore(false);
      else setLoadingRecords(false);
    }
  }, [toast]);

  // The selected slot decides which report closes the day.
  const rosterVisits = useMemo(() => collapseRosterVisits(todayRoster), [todayRoster]);
  const selectedEntry = todayRoster.find((entry) => entry.id === rosterEntryId);
  const selectedJobType = selectedEntry?.job?.type;
  const reportLabel = checkOutReportLabel(selectedJobType);

  // Arriving from the Today card: expand, and preselect the slot it named.
  useEffect(() => {
    if (!openWith) return;
    setExpanded(true);
    setAttendanceType(openWith.attendanceType || 'check_in');
    setRosterEntryId(openWith.rosterEntryId ?? null);
    setJobId(openWith.jobId ?? null);
  }, [openWith]);

  const fetchRoster = useCallback(async () => {
    try {
      const data = await dashboardApi.getRoster({ dateFrom: todayISO(), dateTo: todayISO() });
      setTodayRoster(data.entries || []);
      setRosterError('');
    } catch (error) {
      setRosterError(getApiErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchRoster();
  }, [fetchRecords, fetchRoster]);

  useEffect(() => {
    if (new Date().getDay() === 0) fetchSundayRequests();
  }, [fetchSundayRequests]);

  const handleCapturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to capture attendance photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.65,
      allowsEditing: false,
      exif: false,
      cameraType: cameraFacing,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = await compressImageUri(result.assets[0].uri);
      if ((fileSizeBytes(uri) ?? 0) > MAX_ATTENDANCE_PHOTO_BYTES) {
        toast.error('Attendance photo must be 5 MB or smaller');
        return;
      }
      setPhotoUri(uri);
    }
  };

  const handlePickReport = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });
    // An uploaded report is often a photo of a paper form — compress it like any other image.
    if (!result.canceled) {
      const file = await compressPickedImage(result.assets?.[0]);
      if ((file?.size ?? fileSizeBytes(file?.uri) ?? 0) > MAX_REPORT_FILE_BYTES) {
        setReportFile(null);
        toast.error(`${reportLabel} must be 10 MB or smaller`);
        return;
      }
      setReportFile(file || null);
    }
  };

  const handleSubmit = async () => {
    setFormError('');
    setFieldErrors({});
    if (!photoUri) {
      setFieldErrors({ photo: 'Photo is required for attendance' });
      return;
    }
    if (!manualLocation.trim()) {
      setFieldErrors({ manual_location: 'Site location is required for attendance' });
      return;
    }
    if (attendanceType === 'check_out' && !reportFile) {
      setFieldErrors({ report_file: `Upload the completed ${reportLabel}` });
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Location permission denied');
      return;
    }

    setLocating(true);
    let loc;
    try {
      loc = await getAttendanceLocation();
    } catch {
      toast.error('Could not get location. Please check GPS and location access.');
      setLocating(false);
      return;
    } finally {
      setLocating(false);
    }

    setSubmitting(true);
    try {
      const result = await dashboardApi.recordAttendance({
        jobId,
        rosterEntryId,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        manualLocation,
        photoUri,
        attendanceType,
        reportFile: attendanceType === 'check_out' ? reportFile : null,
        sundayReason: sundayReason.trim() || undefined,
      });

      // Sunday: the attempt was filed for approval instead of recorded. The photo and
      // GPS travelled with it, so there is nothing to submit again once it is granted.
      if (result?.status === 'pending_approval') {
        toast.success(result.message || 'Approval request sent to superadmin');
        setPhotoUri(null);
        setManualLocation('');
        setSundayReason('');
        setSundayBlocked(true);
        await fetchSundayRequests();
        return;
      }

      toast.success(attendanceType === 'check_in' ? 'Check-in recorded' : 'Check-out and report submitted');
      // The report is filed either way; an unfinished checklist is a heads-up, not a block.
      if (result?.warning) toast.warning(result.warning);
      setPhotoUri(null);
      setManualLocation('');
      setReportFile(null);
      fetchRecords();
      fetchRoster();
    } catch (err) {
      // 409 covers a request already waiting on the superadmin, 403 a rejected one.
      if ((err.status === 403 || err.status === 409) && /sunday/i.test(err.message || '')) {
        setSundayBlocked(true);
        await fetchSundayRequests();
      }
      const message = getApiErrorMessage(err);
      setFormError(message);
      setFieldErrors(getApiFieldErrors(err));
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitSundayRequest = async (isModal = false) => {
    const selectedDate = isModal ? requestDate : todayISO();
    setSundaySubmitting(true);
    try {
      const created = await dashboardApi.createSundayRequest({
        requestDate: selectedDate,
        reason: sundayReason,
      });
      setSundayRequests((current) => [created, ...current.filter((request) => request.id !== created.id)]);
      if (selectedDate === todayISO()) {
        setSundayRequest(created);
        setSundayBlocked(created.status !== 'approved');
      }
      setSundayReason('');
      toast.success('Request sent for superadmin approval');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSundaySubmitting(false);
    }
  };

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const selectedSundayRequest = sundayRequests.find((request) => request.request_date === requestDate);

  return (
    <Card padded={false} className="overflow-hidden bg-surface">
      <Button
        variant="ghost"
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityLabel="Daily attendance"
        accessibilityState={{ expanded }}
        className="h-auto w-full flex-row justify-between rounded-none p-4"
      >
        <View className="flex-row items-center gap-3 flex-1">
          <View className="w-9 h-9 rounded-xl bg-primary-light items-center justify-center">
            <Ionicons name="finger-print-outline" size={18} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: typography.callout.fontSize, lineHeight: typography.callout.lineHeight }} className="font-bold text-foreground">Daily Attendance</Text>
            <Text className="text-xs text-muted-foreground">
              {records.length} record{records.length === 1 ? '' : 's'} · tap to {expanded ? 'hide' : 'mark'}
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </Button>

      {expanded ? (
      <>
      <View className="px-5 pb-5">
      <View className="gap-3 mb-5">
        {formError ? <Notice tone="danger" title="Attendance not saved" message={formError} /> : null}
        {sundayError ? <Notice tone="warning" title="Sunday requests unavailable" message={sundayError} /> : null}
        {rosterError ? <Notice tone={todayRoster.length ? 'warning' : 'danger'} title={todayRoster.length ? 'Roster may be incomplete' : 'Roster unavailable'} message={rosterError} /> : null}
        {sundayBlocked ? (
          <View className="gap-2 rounded-lg border border-destructive/40 p-3">
            <Text className="text-sm font-semibold text-destructive">Sunday work needs approval</Text>
            {sundayRequest ? (
              <Text className="text-xs text-muted-foreground">
                {sundayRequest.status === 'pending'
                  ? 'Your request for today is pending superadmin approval.'
                  : `Your request for today was ${sundayRequest.status}.`}
              </Text>
            ) : (
              <>
                <Text className="text-xs text-muted-foreground">
                  Send a request for today and a superadmin will review it.
                </Text>
                <TextInput
                  value={sundayReason}
                  onChangeText={setSundayReason}
                  placeholder="Reason (optional)"
                  placeholderTextColor={colors.textMuted}
                  maxLength={500}
                  className="rounded-lg border border-border p-2.5 text-foreground"
                />
                <Button disabled={sundaySubmitting} onPress={submitSundayRequest}>
                  <Text>{sundaySubmitting ? 'Sending...' : 'Request Sunday work'}</Text>
                </Button>
              </>
            )}
          </View>
      ) : null}
        <Button
          variant="outline"
          onPress={() => {
             setRequestDate(nextSundayISO());
             fetchSundayRequests();
             setSundayModalVisible(true);
          }}
          className="mb-3 w-full justify-between bg-background"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text className="text-sm font-semibold text-foreground">Manage Sunday Work Requests</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Button>
        <View className="flex-row gap-2">
          <Button className="flex-1" variant={attendanceType === 'check_in' ? 'default' : 'outline'} onPress={() => setAttendanceType('check_in')}>
            <Text>Check In</Text>
          </Button>
          <Button className="flex-1" variant={attendanceType === 'check_out' ? 'default' : 'outline'} onPress={() => setAttendanceType('check_out')}>
            <Text>Check Out</Text>
          </Button>
        </View>
        <View className="gap-2">
          <Text className="text-xs font-semibold text-muted-foreground uppercase">
            Today&apos;s Assignment
          </Text>
          <Button
            variant="outline"
            onPress={() => { setJobId(null); setRosterEntryId(null); }}
            accessibilityRole="button"
            accessibilityState={{ selected: jobId === null }}
            className={`h-auto min-h-11 w-full justify-between p-3 ${jobId === null ? 'border-primary bg-primary-light' : 'border-border bg-background'}`}
          >
            <Text className="flex-1 text-sm font-semibold text-foreground">No job / General attendance</Text>
            {jobId === null ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
          </Button>
          {rosterVisits.length === 0 ? (
            <Text className="text-xs text-muted-foreground">No roster assignment for today.</Text>
          ) : rosterVisits.map((entry) => (
            <Button
              variant="outline"
              key={entry.id}
              onPress={() => { setJobId(entry.job_id); setRosterEntryId(entry.id); }}
              disabled={entry.job.status !== 'in_progress'}
              accessibilityRole="button"
              accessibilityState={{ selected: rosterEntryId === entry.id, disabled: entry.job.status !== 'in_progress' }}
              className={`h-auto min-h-11 w-full justify-between p-3 ${rosterEntryId === entry.id ? 'border-primary bg-primary-light' : 'border-border bg-background'}`}
            >
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{entry.span_slots > 1 ? 'Full day' : `Slot ${entry.slot_number}`} · {entry.job.name}</Text>
                <Text className="mt-1 text-xs text-muted-foreground">{entry.slot_start}–{entry.span_end} · {entry.status.replaceAll('_', ' ')}</Text>
              </View>
              {rosterEntryId === entry.id ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
            </Button>
          ))}
        </View>
        <Text className="text-xs font-semibold text-muted-foreground uppercase">
          Attendance Photo <Text className="text-destructive">*</Text>
        </Text>

        {photoUri ? (
          <View className="relative">
            <Image
              source={{ uri: photoUri }}
              className="w-full h-48 rounded-xl"
              resizeMode="cover"
            />
            <IconButton
              icon="camera-outline"
              label="Retake attendance photo"
              tone="primary"
              onPress={handleCapturePhoto}
              className="absolute bottom-2 right-2"
            />
            <IconButton
              icon="camera-reverse-outline"
              label="Switch camera"
              tone="primary"
              onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
              className="absolute bottom-2 left-2"
            />
          </View>
        ) : (
          <View className="rounded-xl border-2 border-dashed border-border bg-background h-36 items-center justify-center gap-2">
            <Button
              variant="ghost"
              onPress={handleCapturePhoto}
              className="h-auto flex-col gap-2"
            >
              <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
              <Text className="text-sm text-muted-foreground font-medium">Tap to capture photo</Text>
              <Text className="text-xs text-muted-foreground">Required for attendance</Text>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
              style={{
                position: 'absolute',
                bottom: spacing.sm,
                right: spacing.sm,
                backgroundColor: colors.primaryMuted,
                borderRadius: radii.sm,
              }}
            >
              <Ionicons name="camera-reverse-outline" size={14} color={colors.primary} />
              <Text style={{ fontSize: typography.micro.fontSize, lineHeight: typography.micro.lineHeight, color: colors.primary }} className="font-semibold">
                {cameraFacing === 'back' ? 'Front' : 'Back'}
              </Text>
            </Button>
          </View>
        )}

        {attendanceType === 'check_out' ? (
          <View className="gap-3 rounded-xl border border-border p-3">
            <Text className="text-xs font-semibold text-muted-foreground uppercase">
              {reportLabel} <Text className="text-destructive">*</Text>
            </Text>
            <Button
              variant="outline"
              onPress={handlePickReport}
              accessibilityRole="button"
              accessibilityLabel={reportFile ? `Replace ${reportFile.name}` : `Upload completed ${reportLabel}`}
              className="h-auto min-h-11 w-full flex-col items-start bg-background p-3"
            >
              <Text className="text-sm font-semibold text-foreground">
                {reportFile?.name || 'Tap to upload completed report'}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                {reportFile ? 'Tap to replace · ' : ''}PDF, JPG, PNG, DOC or DOCX · maximum 10 MB
              </Text>
            </Button>
            {fieldErrors.report_file ? <Text accessibilityRole="alert" className="text-xs text-destructive">{fieldErrors.report_file}</Text> : null}
          </View>
        ) : null}

        <View className="gap-2">
          <Text className="text-xs font-semibold text-muted-foreground uppercase">
            Site Location <Text className="text-destructive">*</Text>
          </Text>
          <TextInput
            accessibilityLabel="Site location"
            value={manualLocation}
            onChangeText={setManualLocation}
            placeholder="Site name, landmark, floor, or area"
            placeholderTextColor={colors.textMuted}
            maxLength={255}
            className="h-12 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          />
          {fieldErrors.manual_location ? <Text accessibilityRole="alert" className="text-xs text-destructive">{fieldErrors.manual_location}</Text> : null}
        </View>
        {fieldErrors.photo ? <Text accessibilityRole="alert" className="text-xs text-destructive">{fieldErrors.photo}</Text> : null}

        <Button
          className="w-full h-12 rounded-xl"
          disabled={locating || submitting || !photoUri}
          onPress={handleSubmit}
        >
          {locating || submitting ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color={onPrimary} size="small" />
              <Text className="font-bold text-sm" style={{ color: onPrimary }}>
                {locating ? 'Getting location…' : 'Saving…'}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons name="location-outline" size={16} color={onPrimary} />
              <Text className="font-bold text-sm" style={{ color: onPrimary }}>
                {attendanceType === 'check_in' ? 'Mark Check In' : 'Mark Check Out'}
              </Text>
            </View>
          )}
        </Button>
      </View>

      <View>
        {missingReports.length > 0 ? (
          <View className="mb-3 rounded-xl border border-destructive bg-destructive/10 p-3">
            <Text className="text-sm font-bold text-destructive">Daily report required</Text>
            <Text className="text-xs text-destructive mt-1">
              {missingReports.map((item) => `${item.job_id ? `Job ${item.job_id}` : 'General attendance'} (${item.attendance_date})`).join(', ')}
            </Text>
          </View>
        ) : null}
        <Text className="text-xs font-semibold text-muted-foreground uppercase mb-3">
          Attendance Records ({records.length})
        </Text>

        {loadingRecords ? (
          <ActivityIndicator color={colors.primary} />
        ) : recordsError && records.length === 0 ? (
          <View className="items-start gap-2">
            <Text className="text-sm text-destructive">{recordsError}</Text>
            <Button variant="outline" size="sm" onPress={() => fetchRecords(0)}><Text>Retry</Text></Button>
          </View>
        ) : records.length === 0 ? (
          <Text className="text-sm text-muted-foreground">No attendance recorded yet.</Text>
        ) : (
          <View className="gap-2">
            {recordsError ? <Notice tone="warning" title="Showing saved records" message={recordsError} /> : null}
            {records.map((r) => (
              <Card
                key={r.id}
                className="gap-1 bg-background p-3"
              >
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="call-outline" size={13} color={colors.textMuted} />
                  <Text style={{ fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }} className="font-semibold text-foreground">{r.phone}</Text>
                </View>
                <Text className="text-xs font-semibold text-primary">
                  {r.attendance_type === 'check_out' ? 'Check Out' : 'Check In'}
                </Text>
                <Text className="text-xs text-foreground">
                  Job: {r.job_id ? (jobs.find((job) => job.id === r.job_id)?.name || `#${r.job_id}`) : 'None'}
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                  <Text className="text-xs text-muted-foreground">
                    {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                  </Text>
                </View>
                {r.manual_location ? (
                  <Text className="text-xs text-muted-foreground">
                    Location: {r.manual_location}
                  </Text>
                ) : null}
                {r.photo_url && (
                  <Image
                    source={{ uri: r.photo_url }}
                    className="w-full h-28 rounded-lg mt-1"
                    resizeMode="cover"
                  />
                )}
                {r.report_document_url ? (
                  <Button variant="link" size="sm" className="h-auto self-start px-0" onPress={() => Linking.openURL(r.report_document_url)}>
                    <Text className="text-xs">Download Daily Installation Report</Text>
                  </Button>
                ) : null}
                {r.report_status === 'submitted_late' ? (
                  <Text className="text-xs font-bold text-destructive">Submitted late</Text>
                ) : null}
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                  <Text className="text-xs text-muted-foreground">
                    {formatDateTime(r.recorded_at)}
                  </Text>
                </View>
              </Card>
            ))}
            {hasMoreRecords ? (
              <Button
                variant="outline"
                size="sm"
                loading={loadingMore}
                disabled={loadingMore}
                onPress={() => fetchRecords(records.length)}
              >
                <Text>{loadingMore ? 'Loading…' : 'Load 50 more'}</Text>
              </Button>
            ) : null}
          </View>
        )}
      </View>
      </View>
      <Modal
        visible={sundayModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSundayModalVisible(false)}
      >
        <View className="flex-1 bg-background pt-12 px-5">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-lg font-bold text-foreground">Sunday Work Requests</Text>
            <IconButton icon="close" label="Close Sunday requests" onPress={() => setSundayModalVisible(false)} />
          </View>
          <ScrollView className="flex-1">
            <View className="gap-2 mb-6">
              <Text className="text-sm font-semibold text-foreground">Request date (YYYY-MM-DD)</Text>
              <TextInput
                value={requestDate}
                onChangeText={setRequestDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                className="h-12 rounded-lg border border-border p-2.5 text-foreground"
              />
              {selectedSundayRequest ? (
                <Text className="text-sm text-muted-foreground">
                  A request for this date is already {selectedSundayRequest.status}.
                </Text>
              ) : (
                <>
                  <TextInput
                    value={sundayReason}
                    onChangeText={setSundayReason}
                    placeholder="Reason (optional)"
                    placeholderTextColor={colors.textMuted}
                    maxLength={500}
                    className="h-12 rounded-lg border border-border p-2.5 text-foreground"
                  />
                  <Button disabled={sundaySubmitting} onPress={() => submitSundayRequest(true)}>
                    <Text>{sundaySubmitting ? 'Sending...' : 'Request Sunday work'}</Text>
                  </Button>
                </>
              )}
            </View>

            <Text className="text-sm font-semibold text-foreground mb-3">Previous Requests</Text>
            {sundayRequests.length === 0 ? (
              <Text className="text-sm text-muted-foreground">No requests found.</Text>
            ) : (
              <View className="gap-3 pb-8">
                {sundayRequests.map((req) => (
                  <Card key={req.id} className="gap-1 p-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-foreground">{req.request_date}</Text>
                      <StatusBadge label={req.status} tone={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'} />
                    </View>
                    {req.reason ? <Text className="text-xs text-muted-foreground mt-1">Reason: {req.reason}</Text> : null}
                    {req.review_notes ? <Text className="text-xs text-muted-foreground mt-1">Notes: {req.review_notes}</Text> : null}
                  </Card>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
      </>
      ) : null}
    </Card>
  );
};

export default DailyAttendance;
