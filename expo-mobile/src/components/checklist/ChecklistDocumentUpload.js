import React, { useState } from "react";
import { Alert, View, TouchableOpacity, Linking, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Text } from "@/components/ui";
import useChecklistStore from "../../store/checklistStore";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useTheme } from "../../hooks/useTheme";
import { checklistApi } from "../../api/checklistApi";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_MIME = "application/pdf";

const ChecklistDocumentUpload = ({ checklistId, jobId }) => {
  const { colors, isDark } = useTheme();
  const onPrimary = isDark ? colors.background : "#fff";
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const checklist = useChecklistStore((state) => state.checklist);
  const checklistDocumentLink = checklist?.document_link;
  const isIsmChecklist = checklist?.template_available === true;
  const uploadChecklistDocument = useChecklistStore(
    (state) => state.uploadChecklistDocument
  );
  
  const { handleFileSelect, file, clearFile } = useFileUpload(
    isIsmChecklist
      ? { pickerTypes: [XLSX_MIME, PDF_MIME], allowedTypes: [XLSX_MIME, PDF_MIME], allowedExtensions: [".xlsx", ".pdf"] }
      : undefined
  );

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await checklistApi.downloadChecklistTemplate(jobId, checklistId);
    } catch (error) {
      Alert.alert("Download failed", error?.message || "Could not download the checklist workbook.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUploadConfirm = async () => {
    if (!file || isUploading) return;

    setIsUploading(true);
    try {
      await uploadChecklistDocument(jobId, checklistId, file);
      clearFile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Upload failed:", error);
      Alert.alert("Upload failed", "Failed to upload checklist document. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View
      className="mt-6 bg-surface rounded-2xl overflow-hidden border border-border"
      style={colors.shadowSm}
    >
      <View className="px-5 bg-card border-b border-border flex-row items-center gap-2 py-3.5">
        <Ionicons name="document-text-outline" size={18} color={colors.primary} />
        <Text className="text-base font-extrabold text-foreground">
          {isIsmChecklist ? "ISM Excel Checklist" : "Checklist Document"}
        </Text>
      </View>

      <View className="p-5 gap-4">
        {isIsmChecklist ? (
          <View
            style={{
              gap: 12,
              backgroundColor: colors.warning + "10",
              borderColor: colors.warning + "35",
              borderWidth: 1,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.text, fontWeight: "600" }}>
              01 Download workbook  →  02 Fill the ISM Checklist tab  →  03 Upload it back
            </Text>
            <TouchableOpacity
              onPress={handleDownload}
              disabled={isDownloading}
              accessibilityRole="button"
              accessibilityLabel="Download ISM checklist workbook"
              accessibilityState={{ disabled: isDownloading, busy: isDownloading }}
              style={{
                minHeight: 44,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                opacity: isDownloading ? 0.6 : 1,
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                {isDownloading ? "Downloading…" : "Download workbook"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* File selected — show confirmation before upload */}
        {file ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: colors.primaryMuted,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons
              name="document-attach-outline"
              size={16}
              color={colors.primary}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: "600",
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {file.name || "Selected file"}
            </Text>
            <TouchableOpacity
              onPress={handleUploadConfirm}
              disabled={isUploading}
              accessibilityRole="button"
              accessibilityLabel="Upload selected checklist document"
              accessibilityState={{ disabled: isUploading, busy: isUploading }}
              style={{
                backgroundColor: isUploading
                  ? colors.textMuted
                  : colors.primary,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 6,
                opacity: isUploading ? 0.6 : 1,
              }}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={onPrimary} />
              ) : (
                <Text
                  style={{
                    color: onPrimary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Upload
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                clearFile();
              }}
              accessibilityRole="button"
              accessibilityLabel="Remove selected checklist document"
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.danger + "15",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={14} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Existing document link */}
        {checklistDocumentLink ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: colors.success + "10",
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.success + "25",
            }}
          >
            <Ionicons
              name="document-text"
              size={20}
              color={colors.success}
            />
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                Linking.openURL(checklistDocumentLink);
              }}
              accessibilityRole="link"
              accessibilityLabel="View checklist document"
              style={{ flex: 1 }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: colors.success,
                }}
              >
                View Checklist Document
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "500",
                  color: colors.success + "99",
                  marginTop: 2,
                }}
              >
                Tap to view the uploaded document
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Upload button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            handleFileSelect();
          }}
          accessibilityRole="button"
          accessibilityLabel={checklistDocumentLink ? "Replace checklist document" : "Upload checklist document"}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: colors.primary + "15",
            borderRadius: 12,
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: colors.primary,
            paddingVertical: 16,
          }}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={20}
            color={colors.primary}
          />
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: colors.primary,
            }}
          >
            {checklistDocumentLink ? "Replace Document" : isIsmChecklist ? "Choose completed file" : "Upload Checklist"}
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 11,
            fontWeight: "500",
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          {isIsmChecklist ? ".xlsx or .pdf" : "PDF, JPG, PNG, or DOCX"} • Max 10MB
        </Text>
      </View>
    </View>
  );
};

export default React.memo(ChecklistDocumentUpload);
