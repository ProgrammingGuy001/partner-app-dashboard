import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from './useToast';
import { compressPickedImage, fileSizeBytes } from '../util/image';
import { MAX_PROGRESS_PHOTOS, MAX_PROGRESS_PHOTO_BYTES } from '../util/dailyReport';

/** Progress photo picking, compression and capping for the daily report. */
export const useProgressPhotos = () => {
  const toast = useToast();
  const [photos, setPhotos] = useState([]);

  const pick = async () => {
    const available = MAX_PROGRESS_PHOTOS - photos.length;
    if (available <= 0) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is needed to attach progress photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: available,
      quality: 0.7,
    });
    if (result.canceled) return;
    const files = await Promise.all(result.assets.map((asset) => compressPickedImage({
      uri: asset.uri,
      name: asset.fileName || `progress-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
    })));
    const compressed = files.filter(Boolean);
    const valid = compressed.filter((file) => (file.size ?? fileSizeBytes(file.uri) ?? 0) <= MAX_PROGRESS_PHOTO_BYTES);
    setPhotos((current) => [...current, ...valid].slice(0, MAX_PROGRESS_PHOTOS));
    if (valid.length < compressed.length) {
      toast.error('Each progress photo must be 2 MB or smaller after compression');
    }
  };

  const remove = (index) => setPhotos((current) => current.filter((_, i) => i !== index));
  const reset = () => setPhotos([]);

  return { photos, pick, remove, reset };
};
