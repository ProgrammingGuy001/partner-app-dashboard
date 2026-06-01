import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../hooks/useTheme';
import { dailyUpdateApi } from '../../api/dailyUpdateApi';
import Ionicons from '@react-native-vector-icons/ionicons';

const MAX_PHOTOS = 5;

const compressPhoto = async (uri) => {
  const manipulator = ImageManipulator.manipulate(uri);
  manipulator.resize({ width: 1024 });
  const ref = await manipulator.renderAsync();
  const result = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return result.uri;
};

const todayISO = () => new Date().toISOString().split('T')[0];

const DailyJobUpdate = ({ jobId }) => {
  const toast = useToast();
  const { colors } = useTheme();

  const [photoUris, setPhotoUris] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updates, setUpdates] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchUpdates = useCallback(async () => {
    try {
      const data = await dailyUpdateApi.getUpdates(jobId);
      setUpdates(data.updates || []);
    } catch {
      // non-critical
    } finally {
      setLoadingHistory(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const handleAddPhoto = async () => {
    if (photoUris.length >= MAX_PHOTOS) {
      toast.error(`Maximum ${MAX_PHOTOS} photos per update`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
      exif: false,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const compressed = await compressPhoto(result.assets[0].uri);
      setPhotoUris((prev) => [...prev, compressed]);
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (photoUris.length === 0) {
      toast.error('At least one photo is required');
      return;
    }

    setSubmitting(true);
    try {
      await dailyUpdateApi.submit({
        jobId,
        notes,
        updateDate: todayISO(),
        photoUris,
      });
      toast.success('Daily update submitted');
      setPhotoUris([]);
      setNotes('');
      fetchUpdates();
    } catch (err) {
      toast.error(err.message || 'Failed to submit update');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <View className="bg-surface rounded-2xl p-5 border border-border" style={colors.shadowSm}>
      <Text className="text-base font-extrabold text-foreground tracking-tight mb-4">
        Daily Update
      </Text>

      {/* Photo grid */}
      <View className="mb-3">
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Photos <Text className="text-destructive">*</Text>
          <Text className="normal-case font-normal"> ({photoUris.length}/{MAX_PHOTOS})</Text>
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {photoUris.map((uri, index) => (
            <View key={uri + index} className="relative">
              <Image
                source={{ uri }}
                className="w-20 h-20 rounded-xl"
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => handleRemovePhoto(index)}
                className="absolute -top-1.5 -right-1.5 bg-destructive rounded-full w-5 h-5 items-center justify-center"
              >
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}

          {photoUris.length < MAX_PHOTOS && (
            <TouchableOpacity
              onPress={handleAddPhoto}
              disabled={submitting}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-background items-center justify-center"
            >
              <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
              <Text className="text-[10px] text-muted-foreground mt-1">Add photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Notes */}
      <View className="mb-4">
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Notes (optional)
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Describe today's progress, issues, or observations…"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          maxLength={2000}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />
      </View>

      <Button
        className="w-full h-12 rounded-xl"
        disabled={submitting || photoUris.length === 0}
        onPress={handleSubmit}
      >
        {submitting ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator color="#fff" size="small" />
            <Text className="text-white font-bold text-sm">Submitting…</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
            <Text className="text-white font-bold text-sm">Submit Update</Text>
          </View>
        )}
      </Button>

      {/* History */}
      <View className="mt-6">
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Past Updates ({updates.length})
        </Text>

        {loadingHistory ? (
          <ActivityIndicator color={colors.primary} />
        ) : updates.length === 0 ? (
          <Text className="text-sm text-muted-foreground">No updates submitted yet.</Text>
        ) : (
          <View className="gap-3">
            {updates.map((update) => (
              <View
                key={update.id}
                className="rounded-xl border border-border bg-background p-3 gap-2"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                    <Text className="text-xs font-semibold text-foreground">
                      {formatDate(update.update_date)}
                    </Text>
                  </View>
                  <Text className="text-[11px] text-muted-foreground">
                    {formatTime(update.created_at)}
                  </Text>
                </View>

                {update.notes ? (
                  <Text className="text-xs text-foreground leading-relaxed">{update.notes}</Text>
                ) : null}

                {update.photos?.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
                    <View className="flex-row gap-2">
                      {update.photos.map((photo) => (
                        <Image
                          key={photo.id}
                          source={{ uri: photo.photo_url }}
                          className="w-24 h-24 rounded-lg"
                          resizeMode="cover"
                        />
                      ))}
                    </View>
                  </ScrollView>
                )}

                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="images-outline" size={12} color={colors.textMuted} />
                  <Text className="text-[11px] text-muted-foreground">
                    {update.photos?.length ?? 0} photo{update.photos?.length !== 1 ? 's' : ''}
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

export default DailyJobUpdate;
