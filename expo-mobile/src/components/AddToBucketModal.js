import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useTheme } from '../hooks/useTheme';
import { Card, FieldLabel } from './common/Primitives';
import { spacing } from '../theme/designSystem';

const DEPARTMENTS = [
  { value: 'design', label: 'Design' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'quality', label: 'Quality' },
  { value: 'sale', label: 'Sale' },
  { value: 'fulfillment', label: 'Fulfillment' },
  { value: 'other', label: 'Other' },
];

const AddToBucketModal = ({ visible, item, onSave, onClose }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState({
    quantity: '1',
    issue_description: '',
    responsible_department: null,
    component_status: null,
  });
  const [quantityError, setQuantityError] = useState('');

  useEffect(() => {
    if (!visible || !item) return;
    setFormData({
      quantity: '1',
      issue_description: '',
      responsible_department: null,
      component_status: null,
    });
    setQuantityError('');
  }, [visible, item]);

  const handleSubmit = () => {
    const quantity = Number(formData.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setQuantityError('Quantity must be greater than zero');
      return;
    }
    onSave({
      product_name: item.product_name,
      quantity,
      issue_description: formData.issue_description,
      responsible_department: formData.responsible_department,
      component_status: formData.component_status,
    });
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <View className="flex-1 justify-end px-4" style={{ backgroundColor: colors.overlay, paddingBottom: insets.bottom + spacing.sm }}>
        <Card elevated>
          <Text className="mb-5 text-xl font-extrabold text-foreground">Add to Bucket</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <FieldLabel className="mt-1">Product name</FieldLabel>
            <Input
              value={item.product_name}
              editable={false}
              accessibilityLabel="Product name"
              className="h-14 rounded-xl bg-muted px-4 border-0 font-semibold text-muted-foreground"
            />

            <FieldLabel className="mt-4">Quantity</FieldLabel>
            <Input
              value={formData.quantity}
              onChangeText={(text) => {
                setFormData((prev) => ({ ...prev, quantity: text }));
                setQuantityError('');
              }}
              keyboardType="decimal-pad"
              accessibilityLabel="Quantity"
              className="h-14 rounded-xl bg-background border px-4"
            />
            {quantityError ? (
              <Text accessibilityRole="alert" className="mt-1 text-xs font-semibold text-destructive">
                {quantityError}
              </Text>
            ) : null}

            <FieldLabel className="mt-4">Department</FieldLabel>
            <View className="flex-row flex-wrap gap-2 mb-1">
              {DEPARTMENTS.map((dept) => {
                const selected = formData.responsible_department === dept.value;
                return (
                  <Button
                    key={dept.value}
                    variant={selected ? 'default' : 'outline'}
                    size="sm"
                    accessibilityRole="button"
                    accessibilityLabel={`Responsible department ${dept.label}`}
                    accessibilityState={{ selected }}
                    onPress={() =>
                      setFormData((prev) => ({
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

            <FieldLabel className="mt-4">Component status</FieldLabel>
            <Input
              value={formData.component_status || ''}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, component_status: text }))}
              placeholder="e.g. damaged or missing"
              maxLength={100}
              accessibilityLabel="Component status"
              className="h-14 rounded-xl bg-background border px-4"
            />

            <FieldLabel className="mt-4">Issue description</FieldLabel>
            <Input
              value={formData.issue_description}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, issue_description: text }))}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Issue description"
              className="min-h-20 rounded-xl bg-background border pt-3 px-4"
            />
          </ScrollView>

          <View className="mt-6 flex-row gap-3">
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <Text>Cancel</Text>
            </Button>
            <Button className="flex-1" onPress={handleSubmit}>
              <Text>Add</Text>
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
};

export default AddToBucketModal;
