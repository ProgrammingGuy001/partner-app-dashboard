import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, Image, TouchableOpacity, Alert, TextInput } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../hooks/useTheme';
import { dashboardApi } from '../../api/dashboardApi';
import Ionicons from '@react-native-vector-icons/ionicons';

const LOCATION_TIMEOUT_MS = 8000;
const LOCATION_FALLBACK_TIMEOUT_MS = 12000;

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
  const { colors } = useTheme();

  const [photoUri, setPhotoUri] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('back');
  const [manualLocation, setManualLocation] = useState('');
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  const fetchRecords = useCallback(async () => {
    try {
      const data = await dashboardApi.getAttendance();
      setRecords(data.records || []);
    } catch {
      // non-critical
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

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
      const manipulator = ImageManipulator.manipulate(result.assets[0].uri);
      manipulator.resize({ width: 1024 });
      const ref = await manipulator.renderAsync();
      const compressed = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
      setPhotoUri(compressed.uri);
    }
  };

  const handleSubmit = async () => {
    if (!photoUri) {
      toast.error('Photo is required for attendance');
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
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        manualLocation,
        photoUri,
      });

      toast.success('Attendance recorded');
      setPhotoUri(null);
      setManualLocation('');
      fetchRecords();
    } catch (err) {
      toast.error(err.message || 'Failed to record attendance');
    } finally {
      setSubmitting(false);
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

  return (
    <View
      className="bg-surface rounded-2xl p-5 border border-border"
      style={colors.shadowSm}
    >
      <Text className="text-base font-extrabold text-foreground tracking-tight mb-4">
        Daily Attendance
      </Text>

      <View className="gap-3 mb-5">
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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

        <View className="gap-2">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Manual Location
          </Text>
          <TextInput
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
              <ActivityIndicator color="#fff" size="small" />
              <Text className="text-white font-bold text-sm">
                {locating ? 'Getting location…' : 'Saving…'}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons name="location-outline" size={16} color="#fff" />
              <Text className="text-white font-bold text-sm">Mark Attendance</Text>
            </View>
          )}
        </Button>
      </View>

      <View>
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Records ({records.length})
        </Text>

        {loadingRecords ? (
          <ActivityIndicator color={colors.primary} />
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
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                  <Text className="text-[12px] text-muted-foreground">
                    {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                  </Text>
                </View>
                {r.manual_location ? (
                  <Text className="text-[12px] text-muted-foreground">
                    Manual: {r.manual_location}
                  </Text>
                ) : null}
                {r.photo_url && (
                  <Image
                    source={{ uri: r.photo_url }}
                    className="w-full h-28 rounded-lg mt-1"
                    resizeMode="cover"
                  />
                )}
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                  <Text className="text-[12px] text-muted-foreground">
                    {formatDateTime(r.recorded_at)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

export default DailyAttendance;
