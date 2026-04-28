import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { formatters } from '../../util/formatters';

const FileUpload = ({ file, onFileSelect, onClear, error, disabled = false, label = 'Upload File' }) => {
  return (
    <View className="mb-3.5">
      {label ? <Text className="mb-2 text-sm font-medium text-foreground">{label}</Text> : null}

      {!file ? (
        <Pressable
          disabled={disabled}
          onPress={onFileSelect}
          className={`items-center rounded-xl border border-dashed bg-muted/50 p-4 ${error ? 'border-destructive' : 'border-border'} ${disabled ? 'opacity-60' : 'active:opacity-85'}`}
        >
          <Ionicons name="cloud-upload-outline" size={34} color={error ? '#e11d48' : '#7c685f'} />
          <Text className="mt-2 text-sm font-semibold text-foreground">Tap to choose a file</Text>
          <Text className="mt-1 text-xs text-muted-foreground">JPG, PNG, PDF (Max 5MB)</Text>
        </Pressable>
      ) : (
        <View className="flex-row items-center justify-between rounded-xl border border-border bg-muted/50 p-3">
          <View className="mr-2 flex-1 flex-row items-center">
            <Ionicons name="document-outline" size={22} color="#7c685f" />
            <View className="ml-2 flex-1">
              <Text numberOfLines={1} className="text-sm font-medium text-foreground">
                {file.name}
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">{formatters.fileSize(file.size)}</Text>
            </View>
          </View>
          <Pressable onPress={onClear} className="p-1">
            <Ionicons name="close" size={20} color="#7c685f" />
          </Pressable>
        </View>
      )}

      {error ? <Text className="mt-1.5 text-xs text-destructive">{error}</Text> : null}
    </View>
  );
};

export default FileUpload;
