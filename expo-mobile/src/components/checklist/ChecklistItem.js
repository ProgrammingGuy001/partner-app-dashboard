import React, { useState } from "react";
import { Alert, Linking, View } from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button, Input, Text } from "@/components/ui";
import useChecklistStore from "../../store/checklistStore";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useTheme } from "../../hooks/useTheme";
import { getApiErrorMessage } from "../../api/apiErrors";
import { Card, IconButton, Notice, StatusBadge } from "../common/Primitives";

const STATUS = {
  pending: { label: "Pending", tone: "neutral" },
  checked: { label: "Under review", tone: "warning" },
  is_approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

const ChecklistItem = ({ item }) => {
  const { colors } = useTheme();
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [commentValue, setCommentValue] = useState(item.comment || "");
  const [isUploading, setIsUploading] = useState(false);
  const toggleCheckbox = useChecklistStore((state) => state.toggleCheckbox);
  const updateComment = useChecklistStore((state) => state.updateComment);
  const uploadDocument = useChecklistStore((state) => state.uploadDocument);
  const { handleFileSelect, file, clearFile } = useFileUpload();

  React.useEffect(() => setCommentValue(item.comment || ""), [item.comment]);

  const statusKey = item.review_status === "approved"
    ? "is_approved"
    : item.review_status === "rejected"
      ? "rejected"
      : item.checked ? "checked" : "pending";
  const status = STATUS[statusKey];

  const handleToggle = () => {
    if (!item.checked && !item.document_link) {
      Alert.alert("Photo required", "Please upload a photo before marking this item complete.");
      return;
    }
    if (!item.checked && !item.comment?.trim()) {
      Alert.alert("Notes required", "Please add notes before marking this item complete.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    toggleCheckbox(item.id);
  };

  const handleUpload = async () => {
    if (!file || isUploading) return;
    setIsUploading(true);
    try {
      await uploadDocument(item.id, file);
      clearFile();
    } catch (error) {
      Alert.alert("Upload failed", getApiErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const saveComment = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    updateComment(item.id, commentValue);
    setIsEditingComment(false);
  };

  return (
    <View className="flex-row gap-3 border-b border-border px-3 py-4">
      <Button
        variant="ghost"
        size="icon"
        onPress={handleToggle}
        accessibilityRole="checkbox"
        accessibilityLabel={`Mark ${item.text} complete`}
        accessibilityState={{ checked: Boolean(item.checked) }}
      >
        <Ionicons
          name={item.checked ? "checkmark-circle" : "ellipse-outline"}
          size={26}
          color={item.checked ? colors.success : colors.borderStrong}
        />
      </Button>

      <View className="flex-1 gap-3">
        <View className="flex-row items-start justify-between gap-2">
          <Text className={`flex-1 text-sm font-semibold ${item.checked ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {item.text}
          </Text>
          <StatusBadge label={status.label} tone={status.tone} />
        </View>

        {file ? (
          <Card className="flex-row items-center gap-2 bg-primary-muted p-3">
            <Ionicons name="document-attach-outline" size={16} color={colors.primary} />
            <Text className="flex-1 text-xs font-semibold text-foreground" numberOfLines={1}>{file.name || "Selected file"}</Text>
            <Button size="sm" loading={isUploading} onPress={handleUpload}><Text>Upload</Text></Button>
            <IconButton icon="close" label="Remove selected evidence" tone="danger" onPress={clearFile} />
          </Card>
        ) : null}

        <View className="flex-row flex-wrap gap-2">
          {item.document_link ? (
            <Button variant="ghost" size="sm" onPress={() => Linking.openURL(item.document_link)} accessibilityRole="link">
              <Ionicons name="document-text-outline" size={14} color={colors.primary} />
              <Text>View evidence</Text>
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onPress={handleFileSelect}>
            <Ionicons name="camera-outline" size={14} color={colors.textSecondary} />
            <Text>{item.document_link ? "Replace evidence" : "Attach photo"}</Text>
          </Button>
        </View>

        {isEditingComment ? (
          <View className="gap-3">
            <Input
              value={commentValue}
              onChangeText={setCommentValue}
              multiline
              textAlignVertical="top"
              placeholder="Add notes or comments..."
              accessibilityLabel={`Notes for ${item.text}`}
              className="min-h-20 rounded-xl bg-background text-sm"
            />
            <View className="flex-row gap-2">
              <Button className="flex-1" size="sm" onPress={saveComment}><Text>Save note</Text></Button>
              <Button variant="outline" size="sm" onPress={() => { setCommentValue(item.comment || ""); setIsEditingComment(false); }}><Text>Cancel</Text></Button>
            </View>
          </View>
        ) : item.comment ? (
          <Button
            variant="outline"
            onPress={() => setIsEditingComment(true)}
            accessibilityRole="button"
            accessibilityLabel={`Edit note for ${item.text}`}
            className="h-auto w-full flex-col items-start border-dashed bg-background p-3"
          >
            <Text className="text-xs font-bold uppercase text-muted-foreground">Your note</Text>
            <Text className="mt-1 text-sm italic text-muted-foreground">“{item.comment}”</Text>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="self-start" onPress={() => setIsEditingComment(true)}>
            <Ionicons name="add-circle-outline" size={14} color={colors.textMuted} />
            <Text>Add notes</Text>
          </Button>
        )}

        {item.admin_comment ? (
          <Notice
            tone="danger"
            title="Admin feedback"
            message={`${item.admin_comment}${item.review_status === "rejected" ? " Update the note or photo, then check this item again." : ""}`}
          />
        ) : null}
      </View>
    </View>
  );
};

export default React.memo(ChecklistItem);
