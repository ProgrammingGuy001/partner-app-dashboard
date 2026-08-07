import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, Image, TouchableOpacity, Alert, TextInput, Linking, Modal, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../hooks/useTheme';
import { dashboardApi } from '../../api/dashboardApi';
import { compressImageUri, compressPickedImage, fileSizeBytes } from '../../util/image';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useDashboardStore } from '../../store/dashboardStore';

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
// Local date, not toISOString() — that is UTC and rolls the day over early in IST.
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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

const DailyAttendance = () => {
  const toast = useToast();
  const { colors, isDark } = useTheme();
  const onPrimary = isDark ? colors.background : '#fff';
  const jobs = useDashboardStore((state) => state.jobs);
  const activeJobs = jobs.filter((job) => job.status === 'in_progress');

  const [expanded, setExpanded] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('back');
  const [manualLocation, setManualLocation] = useState('');
  const [attendanceType, setAttendanceType] = useState('check_in');
  const [jobId, setJobId] = useState(null);
  const [reportFile, setReportFile] = useState(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState([]);
  const [missingReports, setMissingReports] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreRecords, setHasMoreRecords] = useState(false);
  const [recordsError, setRecordsError] = useState('');
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
      setSundayRequest(today);
      if (new Date().getDay() === 0) {
        setSundayBlocked(!today || today.status !== 'approved');
      }
    } catch {
      toast.error('Failed to load Sunday requests');
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
      const message = error.message || 'Failed to load attendance records';
      if (!loadingNextPage) setRecordsError(message);
      toast.error(message);
    } finally {
      if (loadingNextPage) setLoadingMore(false);
      else setLoadingRecords(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

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
        toast.error('Daily Installation Report must be 10 MB or smaller');
        return;
      }
      setReportFile(file || null);
    }
  };

  const handleSubmit = async () => {
    if (!photoUri) {
      toast.error('Photo is required for attendance');
      return;
    }
    if (!manualLocation.trim()) {
      toast.error('Site location is required for attendance');
      return;
    }
    if (attendanceType === 'check_out' && !reportFile) {
      toast.error('Upload the completed Daily Installation Report');
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
      await dashboardApi.recordAttendance({
        jobId,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        manualLocation,
        photoUri,
        attendanceType,
        reportFile: attendanceType === 'check_out' ? reportFile : null,
      });

      toast.success(attendanceType === 'check_in' ? 'Check-in recorded' : 'Check-out and report submitted');
      setPhotoUri(null);
      setManualLocation('');
      setReportFile(null);
      fetchRecords();
    } catch (err) {
      if (err.status === 403 && /sunday/i.test(err.message || '')) {
        setSundayBlocked(true);
        await fetchSundayRequests();
      }
      toast.error(err.message || 'Failed to record attendance');
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
      toast.error(err.message || 'Failed to submit Sunday work request');
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
    <View
      className="bg-surface rounded-2xl border border-border overflow-hidden"
      style={colors.shadowSm}
    >
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityLabel="Daily attendance"
        accessibilityState={{ expanded }}
        className="flex-row items-center justify-between p-4"
      >
        <View className="flex-row items-center gap-3 flex-1">
          <View className="w-9 h-9 rounded-xl bg-primary-light items-center justify-center">
            <Ionicons name="finger-print-outline" size={18} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-bold text-foreground">Daily Attendance</Text>
            <Text className="text-[12px] text-muted-foreground">
              {records.length} record{records.length === 1 ? '' : 's'} · tap to {expanded ? 'hide' : 'mark'}
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded ? (
      <>
      <View className="px-5 pb-5">
      <View className="gap-3 mb-5">
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
                  style={{ color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10 }}
                />
                <Button disabled={sundaySubmitting} onPress={submitSundayRequest}>
                  <Text>{sundaySubmitting ? 'Sending...' : 'Request Sunday work'}</Text>
                </Button>
              </>
            )}
          </View>
      ) : null}
        <TouchableOpacity
          onPress={() => {
             setRequestDate(nextSundayISO());
             fetchSundayRequests();
             setSundayModalVisible(true);
          }}
          className="mb-3 flex-row items-center justify-between rounded-xl border border-border bg-background p-3"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text className="text-sm font-semibold text-foreground">Manage Sunday Work Requests</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
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
            Job (Optional)
          </Text>
          <TouchableOpacity
            onPress={() => setJobId(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: jobId === null }}
            className={`min-h-11 flex-row items-center justify-between rounded-xl border p-3 ${jobId === null ? 'border-primary bg-primary-light' : 'border-border bg-background'}`}
          >
            <Text className="flex-1 text-sm font-semibold text-foreground">No job / General attendance</Text>
            {jobId === null ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
          </TouchableOpacity>
          {activeJobs.length === 0 ? (
            <Text className="text-xs text-muted-foreground">No in-progress jobs are available.</Text>
          ) : activeJobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              onPress={() => setJobId(job.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: jobId === job.id }}
              className={`min-h-11 flex-row items-center justify-between rounded-xl border p-3 ${jobId === job.id ? 'border-primary bg-primary-light' : 'border-border bg-background'}`}
            >
              <Text className="flex-1 text-sm font-semibold text-foreground">{job.name || `Job ${job.id}`} · ID {job.id}</Text>
              {jobId === job.id ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
            </TouchableOpacity>
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
            <TouchableOpacity
              onPress={handleCapturePhoto}
              className="absolute bottom-2 right-2 bg-black/60 rounded-full p-2"
            >
              <Ionicons name="camera-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
              className="absolute bottom-2 left-2 bg-black/60 rounded-full p-2"
            >
              <Ionicons name="camera-reverse-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View className="rounded-xl border-2 border-dashed border-border bg-background h-36 items-center justify-center gap-2">
            <TouchableOpacity
              onPress={handleCapturePhoto}
              className="items-center gap-2"
            >
              <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
              <Text className="text-sm text-muted-foreground font-medium">Tap to capture photo</Text>
              <Text className="text-xs text-muted-foreground">Required for attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
              style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.primaryMuted,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Ionicons name="camera-reverse-outline" size={14} color={colors.primary} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>
                {cameraFacing === 'back' ? 'Front' : 'Back'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {attendanceType === 'check_out' ? (
          <View className="gap-3 rounded-xl border border-border p-3">
            <Text className="text-xs font-semibold text-muted-foreground uppercase">
              Daily Installation Report <Text className="text-destructive">*</Text>
            </Text>
            <TouchableOpacity
              onPress={handlePickReport}
              accessibilityRole="button"
              accessibilityLabel={reportFile ? `Replace ${reportFile.name}` : 'Upload completed Daily Installation Report'}
              className="min-h-11 rounded-lg border border-border bg-background p-3"
            >
              <Text className="text-sm font-semibold text-foreground">
                {reportFile?.name || 'Tap to upload completed report'}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                {reportFile ? 'Tap to replace · ' : ''}PDF, JPG, PNG, DOC or DOCX · maximum 10 MB
              </Text>
            </TouchableOpacity>
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
        </View>

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
        ) : recordsError ? (
          <View className="items-start gap-2">
            <Text className="text-sm text-destructive">Could not load attendance records.</Text>
            <Button variant="outline" size="sm" onPress={() => fetchRecords(0)}><Text>Retry</Text></Button>
          </View>
        ) : records.length === 0 ? (
          <Text className="text-sm text-muted-foreground">No attendance recorded yet.</Text>
        ) : (
          <View className="gap-2">
            {records.map((r) => (
              <View
                key={r.id}
                className="rounded-xl border border-border bg-background p-3 gap-1"
              >
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="call-outline" size={13} color={colors.textMuted} />
                  <Text className="text-[13px] font-semibold text-foreground">{r.phone}</Text>
                </View>
                <Text className="text-[12px] font-semibold text-primary">
                  {r.attendance_type === 'check_out' ? 'Check Out' : 'Check In'}
                </Text>
                <Text className="text-[12px] text-foreground">
                  Job: {r.job_id ? (jobs.find((job) => job.id === r.job_id)?.name || `#${r.job_id}`) : 'None'}
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                  <Text className="text-[12px] text-muted-foreground">
                    {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                  </Text>
                </View>
                {r.manual_location ? (
                  <Text className="text-[12px] text-muted-foreground">
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
                  <TouchableOpacity onPress={() => Linking.openURL(r.report_document_url)}>
                    <Text className="text-[12px] font-semibold text-primary underline">Download Daily Installation Report</Text>
                  </TouchableOpacity>
                ) : null}
                {r.report_status === 'submitted_late' ? (
                  <Text className="text-[12px] font-bold text-destructive">Submitted late</Text>
                ) : null}
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                  <Text className="text-[12px] text-muted-foreground">
                    {formatDateTime(r.recorded_at)}
                  </Text>
                </View>
              </View>
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
            <TouchableOpacity onPress={() => setSundayModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
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
                style={{ color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, height: 48 }}
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
                    style={{ color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, height: 48 }}
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
                  <View key={req.id} className="rounded-xl border border-border p-3 gap-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-foreground">{req.request_date}</Text>
                      <Text className={`text-xs font-bold ${req.status === 'approved' ? 'text-green-600' : req.status === 'rejected' ? 'text-destructive' : 'text-orange-500'}`}>
                        {req.status.toUpperCase()}
                      </Text>
                    </View>
                    {req.reason ? <Text className="text-xs text-muted-foreground mt-1">Reason: {req.reason}</Text> : null}
                    {req.review_notes ? <Text className="text-xs text-muted-foreground mt-1">Notes: {req.review_notes}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
      </>
      ) : null}
    </View>
  );
};

export default DailyAttendance;
