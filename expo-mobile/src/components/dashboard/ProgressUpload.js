import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import FileUpload from '../common/FileUpload';
import { dashboardApi } from '../../api/dashboardApi';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../hooks/useTheme';

const ProgressUpload = ({ jobId, onUploadSuccess }) => {
  const toast = useToast();
  const { colors } = useTheme();
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);

  const { file, error: fileError, handleFileSelect, clearFile, reset: resetFile } = useFileUpload();

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);
    try {
      const response = await dashboardApi.uploadProgress(jobId, file, comment.trim());
      toast.success('Progress uploaded successfully!');
      setComment('');
      resetFile();
      onUploadSuccess?.(response);
    } catch (error) {
      toast.error(error.message || 'Failed to upload progress');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View 
      className="bg-surface rounded-2xl p-5 border border-border"
      style={colors.shadowSm}
    >
      <View className="mb-4">
        <Text className="text-base font-extrabold text-foreground tracking-tight">Upload Progress</Text>
      </View>
      <View className="gap-3">
        <FileUpload
          file={file}
          onFileSelect={handleFileSelect}
          onClear={clearFile}
          error={fileError}
          label="Upload Document or Image"
        />

        <Text className="text-xs text-muted-foreground font-semibold">Comment or Notes</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Add notes or updates..."
          placeholderTextColor="#9a8b84"
          multiline
          textAlignVertical="top"
          className="min-h-[96px] rounded-xl border border-border bg-background px-3 py-2.5 text-[15px] font-medium text-foreground"
        />
        <Text className="text-[11px] text-muted-foreground">{comment.length} characters</Text>

        <Button className="w-full h-12 rounded-xl mt-1" loading={uploading} disabled={!file} onPress={handleSubmit}>
          <Text className="text-white font-bold text-sm">Upload Progress</Text>
        </Button>
      </View>
    </View>
  );
};

export default ProgressUpload;
