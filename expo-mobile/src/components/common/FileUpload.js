import React from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { formatters } from '../../util/formatters';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '@/components/ui/button';
import { IconButton } from './Primitives';

const FileUpload = ({ file, onFileSelect, onClear, error, disabled = false, label = 'Upload File' }) => {
  const { colors } = useTheme();

  return (
    <View className="mb-3.5">
      {label ? <Text className="mb-2 text-sm font-medium text-foreground">{label}</Text> : null}

      {!file ? (
        <Button
          variant="outline"
          disabled={disabled}
          onPress={onFileSelect}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Choose a file from this device"
          accessibilityState={{ disabled }}
          className={`h-auto w-full flex-col border-dashed bg-muted/50 p-5 ${error ? 'border-destructive' : 'border-border'}`}
        >
          <View className="h-14 w-14 rounded-2xl bg-primary-light items-center justify-center">
            <Ionicons name="cloud-upload-outline" size={28} color={error ? colors.danger : colors.primary} />
          </View>
          <Text className="mt-2 text-sm font-semibold text-foreground">Tap to choose a file</Text>
          <Text className="mt-1 text-xs text-muted-foreground">JPG, PNG, PDF (Max 5MB)</Text>
        </Button>
      ) : (
        <View className="flex-row items-center justify-between rounded-2xl border border-border bg-muted/50 p-3">
          <View className="mr-2 flex-1 flex-row items-center">
            <View className="h-10 w-10 rounded-xl bg-primary-light items-center justify-center">
              <Ionicons name="document-outline" size={20} color={colors.primary} />
            </View>
            <View className="ml-2 flex-1">
              <Text numberOfLines={1} className="text-sm font-medium text-foreground">
                {file.name}
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">{formatters.fileSize(file.size)}</Text>
            </View>
          </View>
          <IconButton
            icon="close"
            label="Remove selected file"
            onPress={onClear}
          />
        </View>
      )}

      {error ? <Text className="mt-1.5 text-xs text-destructive">{error}</Text> : null}
    </View>
  );
};

export default FileUpload;
