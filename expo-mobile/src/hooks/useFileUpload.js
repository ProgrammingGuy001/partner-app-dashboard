import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { validators } from '../util/validators';
import { logger } from '../util/helpers';
import { useToast } from './useToast';

const MAX_IMAGE_DIMENSION = 1280;
const IMAGE_COMPRESS_QUALITY = 0.8;

const compressImage = async (file) => {
  if (!file?.mimeType?.startsWith('image/')) return file;
  try {
    const result = await ImageManipulator.manipulateAsync(
      file.uri,
      [{ resize: { width: MAX_IMAGE_DIMENSION } }],
      { compress: IMAGE_COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );
    const compressed = {
      ...file,
      uri: result.uri,
      mimeType: 'image/jpeg',
      name: (file.name?.replace(/\.[^/.]+$/, '') ?? `upload-${Date.now()}`) + '.jpg',
    };
    logger.info('useFileUpload', `Compressed image: ${file.size ?? '?'} bytes → check output`);
    return compressed;
  } catch (err) {
    logger.warn('useFileUpload', `Image compression failed, using original: ${err.message}`);
    return file;
  }
};

export const useFileUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  const handleFileSelect = async () => {
    setError(null);

    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;

    const rawFile = result.assets?.[0];
    const validation = validators.file(rawFile);
    if (!validation.valid) {
      setError(validation.message);
      toast.error(validation.message);
      return;
    }

    const selectedFile = await compressImage(rawFile);
    setFile(selectedFile);
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
  };

  const reset = () => {
    setFile(null);
    setUploading(false);
    setError(null);
  };

  return {
    file,
    uploading,
    error,
    setUploading,
    handleFileSelect,
    clearFile,
    reset,
  };
};
