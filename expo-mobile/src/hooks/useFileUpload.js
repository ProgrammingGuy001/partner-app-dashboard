import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { validators } from '../util/validators';
import { compressPickedImage } from '../util/image';
import { useToast } from './useToast';

export const useFileUpload = ({ pickerTypes, allowedTypes, allowedExtensions } = {}) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  const handleFileSelect = async () => {
    setError(null);

    const result = await DocumentPicker.getDocumentAsync({
      type: pickerTypes || ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;

    // Compress first, then validate: a 9MB camera photo shrinks to a few hundred KB
    // and passes, where validating the original would have rejected it outright.
    const selectedFile = await compressPickedImage(result.assets?.[0]);
    const validation = validators.file(selectedFile, { allowedTypes, allowedExtensions });
    if (!validation.valid) {
      setError(validation.message);
      toast.error(validation.message);
      return;
    }

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
