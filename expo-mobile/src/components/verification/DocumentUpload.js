import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import FileUpload from "../common/FileUpload";
import { verificationApi } from "../../api/verificationApi";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useToast } from "../../hooks/useToast";
import { useTheme } from "../../hooks/useTheme";
import { useVerificationStore } from "../../store/verificationStore";

const DocumentUpload = ({ canProceed, isDocumentUploaded, onDone }) => {
  const toast = useToast();
  const { colors } = useTheme();
  const setDocumentUploaded = useVerificationStore((state) => state.setDocumentUploaded);

  const { file, error, handleFileSelect, clearFile } = useFileUpload();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(isDocumentUploaded);

  useEffect(() => {
    setUploaded(isDocumentUploaded);
  }, [isDocumentUploaded]);

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);
    try {
      await verificationApi.uploadDocument(file);
      await onDone?.();
      setDocumentUploaded(true);
      toast.success("ID document submitted for approval");
      setUploaded(true);
      clearFile();
    } catch (err) {
      toast.error(err.message || "Document upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!canProceed) {
    return (
      <View className="bg-surface rounded-2xl p-8 items-center opacity-60 border border-border border-dashed">
        <View className="w-16 h-16 rounded-[32px] bg-background items-center justify-center mb-4">
          <Ionicons name="lock-closed" size={28} color={colors.textMuted} />
        </View>
        <Text className="text-lg font-bold text-foreground mb-2">
          Step Locked
        </Text>
        <Text className="text-sm text-muted-foreground text-center leading-5">
          Please complete the PAN and bank details verification first.
        </Text>
      </View>
    );
  }

  if (uploaded) {
    return (
      <View
        className="bg-surface rounded-2xl p-8 items-center border border-border"
        style={colors.shadowSm}
      >
        <View
          className="w-20 h-20 rounded-[40px] items-center justify-center mb-5"
          style={{ backgroundColor: colors.primaryLight }}
        >
          <Ionicons name="checkmark-circle" size={40} color={colors.primary} />
        </View>
        <Text className="text-xl font-extrabold text-foreground mb-2">
          Document Uploaded
        </Text>
        <Text className="text-sm text-muted-foreground text-center leading-5 mb-6">
          Your ID document is waiting for admin approval.
        </Text>
        <Button className="w-full h-14 rounded-2xl bg-primary" onPress={onDone}>
          <Text className="text-primary-foreground text-base font-bold">
            Refresh Status
          </Text>
        </Button>
      </View>
    );
  }

  return (
    <View
      className="bg-surface rounded-2xl p-6 border border-border"
      style={colors.shadowSm}
    >
      <View className="mb-5">
        <Text className="text-lg font-extrabold text-foreground mb-1.5">
          Upload ID Document
        </Text>
        <Text className="text-[13px] text-muted-foreground leading-[18px]">
          Submit a government-issued ID as JPEG, PNG, or PDF. Admin approval is required before dashboard access.
        </Text>
      </View>

      <View className="mb-6">
        <FileUpload
          file={file}
          onFileSelect={handleFileSelect}
          onClear={clearFile}
          error={error}
          label="ID Document"
        />
      </View>

      <View>
        <Button
          className="w-full h-14 rounded-2xl bg-primary"
          loading={uploading}
          disabled={!file}
          onPress={handleUpload}
        >
          <Text className="text-primary-foreground font-bold text-[15px]">
            Submit for Approval
          </Text>
        </Button>
      </View>
    </View>
  );
};

export default DocumentUpload;
