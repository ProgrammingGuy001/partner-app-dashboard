import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { Card, FieldLabel, StatusBadge } from '../common/Primitives';
import { typography } from '../../theme/designSystem';

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
    <Card>
      <View className="flex-row items-center gap-2.5 mb-3">
        <View className="w-6 h-6 rounded-xl bg-primary-light items-center justify-center">
          <Text className="text-xs font-extrabold text-primary">{index + 1}</Text>
        </View>
        <Text className="flex-1 text-base font-bold text-foreground">{item.product_name}</Text>
      </View>

      {isEditing ? (
        <View className="gap-3">
          <View className="gap-1.5">
            <FieldLabel>Quantity</FieldLabel>
            <Input
              value={editForm.quantity}
              onChangeText={(text) => setEditForm((prev) => ({ ...prev, quantity: text }))}
              keyboardType="decimal-pad"
              accessibilityLabel={`Quantity for ${item.product_name}`}
              className="h-11 rounded-xl bg-background px-3"
            />
          </View>

          <View className="gap-1.5">
            <FieldLabel>Component status</FieldLabel>
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
            <FieldLabel>Department</FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {DEPARTMENTS.map((dept) => {
                const selected = editForm.responsible_department === dept.value;
                return (
                  <Button
                    key={dept.value}
                    variant={selected ? 'default' : 'outline'}
                    size="sm"
                    accessibilityRole="button"
                    accessibilityLabel={`Responsible department ${dept.label}`}
                    accessibilityState={{ selected }}
                    onPress={() =>
                      setEditForm((prev) => ({
                        ...prev,
                        responsible_department: selected ? null : dept.value,
                      }))
                    }
                    className="h-auto px-3 py-2"
                  >
                    <Text>{dept.label}</Text>
                  </Button>
                );
              })}
            </View>
          </View>

          <View className="gap-1.5">
            <FieldLabel>Issue description</FieldLabel>
            <Input
              value={editForm.issue_description}
              onChangeText={(text) => setEditForm((prev) => ({ ...prev, issue_description: text }))}
              multiline
              textAlignVertical="top"
              accessibilityLabel={`Issue description for ${item.product_name}`}
              className="min-h-20 rounded-xl bg-background pt-2.5 px-3"
            />
          </View>

          <View className="flex-row gap-2.5 mt-2">
            <Button
              variant="outline"
              onPress={() => setIsEditing(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel editing"
              className="flex-1"
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              onPress={saveEdit}
              accessibilityRole="button"
              accessibilityLabel="Save changes"
              className="flex-1"
            >
              <Text>Save changes</Text>
            </Button>
          </View>
        </View>
      ) : (
        <View>
          <View className="flex-row gap-5 mb-3">
            <View>
                <Text style={typography.micro} className="text-muted-foreground uppercase">Qty</Text>
              <Text className="text-sm font-bold text-foreground">{item.quantity || 1}</Text>
            </View>
            {item.responsible_department && (
              <View>
                <Text style={typography.micro} className="text-muted-foreground uppercase">Dept</Text>
                <StatusBadge label={item.responsible_department} tone="primary" />
              </View>
            )}
            {item.component_status && (
              <View>
                <Text style={typography.micro} className="text-muted-foreground uppercase">Status</Text>
                <Text className="text-sm font-bold text-foreground capitalize">{item.component_status}</Text>
              </View>
            )}
          </View>

          <Text style={typography.micro} className="text-muted-foreground uppercase mb-1">Issue description</Text>
          <Text className="text-sm text-muted-foreground font-medium leading-5 mb-4">
            {item.issue_description || 'Not specified'}
          </Text>

          <View className="flex-row gap-2.5">
            <Button
              variant="outline"
              onPress={() => {
                startEdit();
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.product_name}`}
              className="flex-1"
            >
              <Ionicons name="create-outline" size={typography.body.fontSize} color={colors.textSecondary} />
              <Text>Edit</Text>
            </Button>
            <Button
              variant="destructive"
              onPress={confirmRemove}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.product_name}`}
              className="flex-1"
            >
              <Ionicons name="trash-outline" size={typography.body.fontSize} color={colors.primaryForeground} />
              <Text>Remove</Text>
            </Button>
          </View>
        </View>
      )}
    </Card>
  );
};

export default React.memo(BucketItemCard);
