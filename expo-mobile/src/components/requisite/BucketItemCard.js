import React, { useState } from 'react';
import { Alert, View, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';

export const DEPARTMENTS = [
  { value: 'design', label: 'Design' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'quality', label: 'Quality' },
  { value: 'sale', label: 'Sale' },
  { value: 'fulfillment', label: 'Fulfillment' },
  { value: 'other', label: 'Other' },
];

/**
 * One item in the requisite bucket, editable in place.
 *
 * Shared by BucketScreen and ReviewScreen so the two never drift: the review step
 * has to offer the same edits as the bucket step, which is what the web client
 * gets for free by rendering BucketPage inside its review page.
 */
const BucketItemCard = ({ item, index }) => {
  const { colors } = useTheme();
  const onPrimary = colors.primaryForeground;
  const removeFromBucket = useRequisiteStore((state) => state.removeFromBucket);
  const updateBucketItem = useRequisiteStore((state) => state.updateBucketItem);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    quantity: '1',
    issue_description: '',
    responsible_department: null,
    component_status: null,
  });

  const startEdit = () => {
    setEditForm({
      quantity: String(item.quantity || 1),
      issue_description: item.issue_description || '',
      responsible_department: item.responsible_department || null,
      component_status: item.component_status || null,
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    const quantity = Number(editForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert('Invalid quantity', 'Quantity must be greater than zero.');
      return;
    }
    updateBucketItem(item.product_name, {
      quantity,
      issue_description: editForm.issue_description,
      responsible_department: editForm.responsible_department,
      component_status: editForm.component_status,
    });
    setIsEditing(false);
  };

  const confirmRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert('Remove item?', `Remove "${item.product_name}" from bucket?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeFromBucket(item.product_name),
      },
    ]);
  };

  return (
    <View className="bg-surface rounded-2xl p-5 border border-border" style={colors.shadowSm}>
      <View className="flex-row items-center gap-2.5 mb-3">
        <View className="w-6 h-6 rounded-xl bg-primary-light items-center justify-center">
          <Text className="text-xs font-extrabold text-primary">{index + 1}</Text>
        </View>
        <Text className="flex-1 text-base font-bold text-foreground">{item.product_name}</Text>
      </View>

      {isEditing ? (
        <View className="gap-3">
          <View className="gap-1.5">
            <Text className="text-[11px] font-bold text-muted-foreground uppercase">Quantity</Text>
            <Input
              value={editForm.quantity}
              onChangeText={(text) => setEditForm((prev) => ({ ...prev, quantity: text }))}
              keyboardType="decimal-pad"
              accessibilityLabel={`Quantity for ${item.product_name}`}
              className="h-11 rounded-xl bg-background px-3"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-[11px] font-bold text-muted-foreground uppercase">Component Status</Text>
            <Input
              value={editForm.component_status || ''}
              onChangeText={(text) => setEditForm((prev) => ({ ...prev, component_status: text }))}
              placeholder="e.g. damaged or missing"
              maxLength={100}
              accessibilityLabel={`Component status for ${item.product_name}`}
              className="h-11 rounded-xl bg-background px-3"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-[11px] font-bold text-muted-foreground uppercase">Department</Text>
            <View className="flex-row flex-wrap gap-2">
              {DEPARTMENTS.map((dept) => {
                const selected = editForm.responsible_department === dept.value;
                return (
                  <TouchableOpacity
                    key={dept.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Responsible department ${dept.label}`}
                    accessibilityState={{ selected }}
                    onPress={() =>
                      setEditForm((prev) => ({
                        ...prev,
                        responsible_department: selected ? null : dept.value,
                      }))
                    }
                    className="px-3 py-1.5 rounded-xl border"
                    style={{
                      backgroundColor: selected ? colors.primary : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: selected ? onPrimary : colors.textSecondary }}
                    >
                      {dept.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-[11px] font-bold text-muted-foreground uppercase">Issue Description</Text>
            <Input
              value={editForm.issue_description}
              onChangeText={(text) => setEditForm((prev) => ({ ...prev, issue_description: text }))}
              multiline
              textAlignVertical="top"
              accessibilityLabel={`Issue description for ${item.product_name}`}
              className="min-h-[80px] rounded-xl bg-background pt-2.5 px-3"
            />
          </View>

          <View className="flex-row gap-2.5 mt-2">
            <TouchableOpacity
              onPress={() => setIsEditing(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel editing"
              className="flex-1 h-11 rounded-xl items-center justify-center bg-muted"
            >
              <Text className="font-bold text-muted-foreground">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={saveEdit}
              accessibilityRole="button"
              accessibilityLabel="Save changes"
              className="flex-1 h-11 rounded-xl items-center justify-center bg-primary"
            >
              <Text className="font-bold text-primary-foreground">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View>
          <View className="flex-row gap-5 mb-3">
            <View>
              <Text className="text-[10px] font-bold text-muted-foreground uppercase">QTY</Text>
              <Text className="text-sm font-bold text-foreground">{item.quantity || 1}</Text>
            </View>
            {item.responsible_department && (
              <View>
                <Text className="text-[10px] font-bold text-muted-foreground uppercase">DEPT</Text>
                <View className="px-2 py-0.5 rounded-lg" style={{ backgroundColor: colors.primary + '20' }}>
                  <Text className="text-xs font-bold capitalize" style={{ color: colors.primary }}>
                    {item.responsible_department}
                  </Text>
                </View>
              </View>
            )}
            {item.component_status && (
              <View>
                <Text className="text-[10px] font-bold text-muted-foreground uppercase">STATUS</Text>
                <Text className="text-sm font-bold text-foreground capitalize">{item.component_status}</Text>
              </View>
            )}
          </View>

          <Text className="text-[10px] font-bold text-muted-foreground uppercase mb-1">ISSUE DESCRIPTION</Text>
          <Text className="text-sm text-muted-foreground font-medium leading-5 mb-4">
            {item.issue_description || 'Not specified'}
          </Text>

          <View className="flex-row gap-2.5">
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                startEdit();
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.product_name}`}
              className="flex-1 h-11 rounded-xl flex-row items-center justify-center gap-1.5 border border-border bg-muted"
            >
              <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
              <Text className="text-[13px] font-bold text-muted-foreground">Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmRemove}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.product_name}`}
              className="flex-1 h-11 rounded-xl flex-row items-center justify-center gap-1.5 border"
              style={{ backgroundColor: colors.danger + '10', borderColor: colors.danger + '20' }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text className="text-[13px] font-bold text-destructive-muted-foreground">Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default React.memo(BucketItemCard);
