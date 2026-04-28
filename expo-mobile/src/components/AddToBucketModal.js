import React, { useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useTheme } from '../hooks/useTheme';

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
  const [formData, setFormData] = useState({
    quantity: '1',
    issue_description: '',
    responsible_department: null,
  });

  const handleSubmit = () => {
    onSave({
      product_name: item.product_name,
      quantity: parseFloat(formData.quantity) || 0,
      issue_description: formData.issue_description,
      responsible_department: formData.responsible_department,
    });
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-black/45 px-4">
        <View
          className="bg-surface rounded-3xl p-6 border border-border"
          style={colors.shadowMd}
        >
          <Text className="mb-5 text-xl font-extrabold text-foreground tracking-tight">Add to Bucket</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2 mt-1">Product Name</Text>
            <Input
              value={item.product_name}
              editable={false}
              className="h-[52px] rounded-xl bg-muted px-4 border-0 font-semibold text-muted-foreground"
            />

            <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Quantity</Text>
            <Input
              value={formData.quantity}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, quantity: text }))}
              keyboardType="decimal-pad"
              className="h-[52px] rounded-xl bg-background border px-4"
            />

            <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Department</Text>
            <View className="flex-row flex-wrap gap-2 mb-1">
              {DEPARTMENTS.map((dept) => {
                const selected = formData.responsible_department === dept.value;
                return (
                  <TouchableOpacity
                    key={dept.value}
                    onPress={() =>
                      setFormData((prev) => ({
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
                      style={{ color: selected ? '#fff' : colors.textSecondary }}
                    >
                      {dept.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Issue Description</Text>
            <Input
              value={formData.issue_description}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, issue_description: text }))}
              multiline
              textAlignVertical="top"
              className="min-h-[80px] rounded-xl bg-background border pt-3 px-4"
            />
          </ScrollView>

          <View className="mt-6 flex-row gap-3">
            <Button className="flex-1 h-14 rounded-2xl bg-muted border border-border" onPress={onClose}>
              <Text className="text-foreground font-bold">Cancel</Text>
            </Button>
            <Button className="flex-1 h-14 rounded-2xl bg-primary" onPress={handleSubmit}>
              <Text className="text-white font-bold">Add</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AddToBucketModal;
