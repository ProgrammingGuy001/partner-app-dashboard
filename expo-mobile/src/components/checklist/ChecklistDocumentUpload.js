import React, { useState } from "react";
import { Alert, View, Linking } from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui";
import useChecklistStore from "../../store/checklistStore";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useTheme } from "../../hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Card, IconButton, SectionTitle } from "../common/Primitives";
import { getApiErrorMessage } from "../../api/apiErrors";

const ChecklistDocumentUpload = ({ checklistId, jobId }) => {
  const { colors } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const checklist = useChecklistStore((state) => state.checklist);
  const checklistDocumentLink = checklist?.document_link;
  const uploadChecklistDocument = useChecklistStore(
    (state) => state.uploadChecklistDocument
  );
  
  const { handleFileSelect, file, clearFile } = useFileUpload();

  const handleUploadConfirm = async () => {
    if (!file || isUploading) return;

    setIsUploading(true);
    try {
      await uploadChecklistDocument(jobId, checklistId, file);
      clearFile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Upload failed", getApiErrorMessage(error));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="mt-6 gap-4">
      <SectionTitle title="Checklist document" subtitle="Upload the completed on-site copy" />

      <View className="gap-4">
        {/* File selected — show confirmation before upload */}
        {file ? (
          <Card className="flex-row items-center gap-3 bg-primary-muted p-3">
            <Ionicons
              name="document-attach-outline"
              size={16}
              color={colors.primary}
            />
            <Text
              className="flex-1 text-xs font-semibold text-foreground"
              numberOfLines={1}
            >
              {file.name || "Selected file"}
            </Text>
            <Button
              size="sm"
              onPress={handleUploadConfirm}
              disabled={isUploading}
              accessibilityLabel="Upload selected checklist document"
              accessibilityState={{ disabled: isUploading, busy: isUploading }}
              loading={isUploading}
            >
              <Text>Upload</Text>
            </Button>
            <IconButton
              icon="close"
              label="Remove selected checklist document"
              tone="danger"
              onPress={() => {
                Haptics.selectionAsync();
                clearFile();
              }}
            />
          </Card>
        ) : null}

        {/* Existing document link */}
        {checklistDocumentLink ? (
          <Card className="flex-row items-center gap-3 bg-surface-alt p-3">
            <Ionicons
              name="document-text"
              size={20}
              color={colors.success}
            />
            <Button
              variant="ghost"
              className="flex-1 justify-start"
              onPress={() => {
                Haptics.selectionAsync();
                Linking.openURL(checklistDocumentLink);
              }}
              accessibilityRole="link"
              accessibilityLabel="View checklist document"
            >
              <Text>View checklist document</Text>
            </Button>
          </Card>
        ) : null}

        {/* Upload button */}
        <Button
          variant="outline"
          size="lg"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            handleFileSelect();
          }}
          accessibilityLabel={checklistDocumentLink ? "Replace checklist document" : "Upload checklist document"}
          className="w-full border-dashed"
        >
          <Ionicons
            name="cloud-upload-outline"
            size={20}
            color={colors.primary}
          />
          <Text>
            {checklistDocumentLink ? "Replace document" : "Upload completed checklist"}
          </Text>
        </Button>

        <Text className="text-center text-xs font-medium text-muted-foreground">
          PDF, JPG, or PNG • Max 10MB
        </Text>
      </View>
    </Card>
  );
};

export default React.memo(ChecklistDocumentUpload);
