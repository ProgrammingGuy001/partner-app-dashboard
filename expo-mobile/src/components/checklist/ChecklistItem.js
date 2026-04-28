import React, { useRef, useState } from "react";
import { Linking, View, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button, Input, Text } from "@/components/ui";
import useChecklistStore from "../../store/checklistStore";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useTheme } from "../../hooks/useTheme";

// Stable selectors — avoid re-creating subscriptions on each render
const selectToggle = (s) => s.toggleCheckbox;
const selectUpdateComment = (s) => s.updateComment;
const selectUploadDocument = (s) => s.uploadDocument;

const ChecklistItem = ({ item }) => {
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [commentValue, setCommentValue] = useState(item.comment || "");
  const [isUploading, setIsUploading] = useState(false);
  const { colors } = useTheme();

  // Sync commentValue when item.comment changes from external update
  React.useEffect(() => {
    setCommentValue(item.comment || "");
  }, [item.comment]);

  const toggleCheckbox = useChecklistStore(selectToggle);
  const updateComment = useChecklistStore(selectUpdateComment);
  const uploadDocument = useChecklistStore(selectUploadDocument);

  const statusConfig = {
    pending: {
      label: "Pending",
      color: colors.textMuted,
      bg: colors.background,
    },
    checked: {
      label: "Under Review",
      color: colors.warning,
      bg: colors.warning + "15",
    },
    is_approved: {
      label: "Approved",
      color: colors.success,
      bg: colors.success + "15",
    },
    rejected: {
      label: "Rejected",
      color: colors.danger,
      bg: colors.danger + "15",
    },
  };

  const { handleFileSelect, file, clearFile } = useFileUpload();

  const handleUploadConfirm = async () => {
    if (!file || isUploading) return;
    
    setIsUploading(true);
    try {
      await uploadDocument(item.id, file);
      clearFile();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusKey = () => {
    if (item.is_approved) return "is_approved";
    if (item.checked) return "checked";
    if (item.admin_comment) return "rejected";
    return "pending";
  };

  const status = statusConfig[getStatusKey()];

  const handleToggle = () => {
    // Prevent checking if photo or notes are missing
    if (!item.checked) {
      if (!item.document_link) {
        alert('⚠️ Please upload a photo before marking this item complete.');
        return;
      }
      if (!item.comment || item.comment.trim() === '') {
        alert('⚠️ Please add notes/comment before marking this item complete.');
        return;
      }
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleCheckbox(item.id);
  };

  const handleSaveComment = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateComment(item.id, commentValue);
    setIsEditingComment(false);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
      }}
    >
      <TouchableOpacity onPress={handleToggle} style={{ marginTop: 2 }}>
        <Ionicons
          name={item.checked ? "checkmark-circle" : "ellipse-outline"}
          size={26}
          color={
            item.checked ? colors.success : colors.borderStrong
          }
        />
      </TouchableOpacity>

      <View style={{ flex: 1, gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: "600",
              color: item.checked ? colors.textMuted : colors.text,
              textDecorationLine: item.checked ? "line-through" : "none",
              lineHeight: 20,
            }}
          >
            {item.text}
          </Text>
          <View
            style={{
              backgroundColor: status.bg,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: status.color + "20",
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "800",
                color: status.color,
                textTransform: "uppercase",
              }}
            >
              {status.label}
            </Text>
          </View>
        </View>

        {/* File selected — show confirmation before upload */}
        {file ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: colors.primaryMuted,
              borderRadius: 12,
              padding: 10,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="document-attach-outline" size={16} color={colors.primary} />
            <Text
              style={{ flex: 1, fontSize: 12, fontWeight: "600", color: colors.text }}
              numberOfLines={1}
            >
                {file.name || "Selected file"}
            </Text>
            <TouchableOpacity
              onPress={handleUploadConfirm}
              disabled={isUploading}
              style={{
                backgroundColor: isUploading ? colors.textMuted : colors.primary,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 6,
                opacity: isUploading ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                {isUploading ? "Uploading..." : "Upload"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                clearFile();
              }}
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

        <View style={{ flexDirection: "row", gap: 16 }}>
          {item.document_link ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                Linking.openURL(item.document_link);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color={colors.primary}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: colors.primary,
                }}
              >
                View Evidence
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleFileSelect();
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons
              name="camera-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.textSecondary,
              }}
            >
              {item.document_link ? "Replace" : "Attach Photo"}
            </Text>
          </TouchableOpacity>
        </View>

        {isEditingComment ? (
          <View style={{ gap: 10, marginTop: 4 }}>
            <Input
              value={commentValue}
              onChangeText={setCommentValue}
              multiline
              textAlignVertical="top"
              placeholder="Add notes or comments..."
              style={{
                minHeight: 80,
                borderRadius: 12,
                backgroundColor: colors.background,
                fontSize: 14,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                className="flex-1 bg-primary h-10 rounded-xl"
                onPress={handleSaveComment}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  Save Note
                </Text>
              </Button>
              <Button
                className="h-10 rounded-xl"
                variant="ghost"
                onPress={() => {
                  Haptics.selectionAsync();
                  setCommentValue(item.comment || "");
                  setIsEditingComment(false);
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </Text>
              </Button>
            </View>
          </View>
        ) : item.comment ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setIsEditingComment(true);
            }}
            style={{
              backgroundColor: colors.background,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderStyle: "dashed",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <Ionicons
                name="chatbox-ellipses-outline"
                size={12}
                color={colors.textSecondary}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: colors.textSecondary,
                  textTransform: "uppercase",
                }}
              >
                Your Note
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                fontStyle: "italic",
              }}
            >
              "{item.comment}"
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setIsEditingComment(true);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Ionicons
              name="add-circle-outline"
              size={14}
              color={colors.textMuted}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.textMuted,
              }}
            >
              Add notes
            </Text>
          </TouchableOpacity>
        )}

        {item.admin_comment ? (
          <View
            style={{
              backgroundColor: colors.danger + "10",
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.danger + "25",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: colors.danger,
                textTransform: "uppercase",
              }}
            >
              Admin Feedback
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontSize: 13,
                lineHeight: 18,
                color: colors.danger,
              }}
            >
              {item.admin_comment}
            </Text>
            {!item.checked && !item.is_approved ? (
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  lineHeight: 16,
                  color: colors.textSecondary,
                }}
              >
                Update the note or photo, then check this item again to send it back for review.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default React.memo(ChecklistItem);
