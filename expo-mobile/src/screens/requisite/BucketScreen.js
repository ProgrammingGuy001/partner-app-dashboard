import React, { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, ScrollView, View, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { ROUTES } from '../../util/constants';

const DEPARTMENTS = [
  { value: 'design', label: 'Design' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'quality', label: 'Quality' },
  { value: 'sale', label: 'Sale' },
  { value: 'fulfillment', label: 'Fulfillment' },
  { value: 'other', label: 'Other' },
];

const BucketScreen = ({ navigation }) => {
  const { bucket, removeFromBucket, updateBucketItem, salesOrder, cabinetPosition } = useRequisiteStore();
  const { colors } = useTheme();

  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    quantity: '1',
    issue_description: '',
    responsible_department: null,
  });

  const startEdit = (item) => {
    setEditingItem(item.product_name);
    setEditForm({
      quantity: String(item.quantity || 1),
      issue_description: item.issue_description || '',
      responsible_department: item.responsible_department || null,
    });
  };

  const saveEdit = (productName) => {
    updateBucketItem(productName, {
      quantity: parseFloat(editForm.quantity) || 0,
      issue_description: editForm.issue_description,
      responsible_department: editForm.responsible_department,
    });
    setEditingItem(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View className="flex-1 px-5">
        {/* Header */}
        <View className="flex-row items-center gap-3 pt-4 mb-6">
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="w-11 h-11 rounded-full bg-surface items-center justify-center border border-border"
            style={colors.shadowSm}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              BOM BUCKET
            </Text>
            <Text className="text-xl font-extrabold text-foreground tracking-tight">
              My Selection ({bucket.length})
            </Text>
          </View>
          <TouchableOpacity
            disabled={!bucket.length}
            onPress={() => { Haptics.selectionAsync(); navigation.navigate(ROUTES.SUBMIT); }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Proceed to submit"
            className="h-11 px-4 rounded-xl items-center justify-center"
            style={{
              backgroundColor: colors.primary,
              opacity: bucket.length ? 1 : 0.4
            }}
          >
            <Text className="text-white font-bold text-[13px]">Submit</Text>
          </TouchableOpacity>
        </View>

        {!bucket.length ? (
          <View className="flex-1 items-center justify-center pb-[100px]">
             <View className="w-20 h-20 rounded-[40px] bg-muted items-center justify-center mb-5">
               <Ionicons name="basket-outline" size={40} color={colors.textMuted} />
             </View>
             <Text className="text-xl font-extrabold text-foreground mb-2">Your bucket is empty</Text>
             <Text className="text-sm text-muted-foreground text-center mb-6 px-10">
               Add items from the material hierarchy to create a site requisite request.
             </Text>
             <Button className="rounded-xl px-8" onPress={() => navigation.goBack()}>
               <Text className="text-white font-bold">Browse Materials</Text>
             </Button>
          </View>
        ) : (
          <FlatList
            data={bucket}
            keyExtractor={(item) => item.product_name}
            contentContainerStyle={{ gap: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
               <View 
                className="bg-surface rounded-[20px] p-5 border border-border"
                style={colors.shadowSm}
               >
                 <View className="flex-row items-center gap-2.5 mb-3">
                   <View className="w-6 h-6 rounded-xl bg-primary-light items-center justify-center">
                     <Text className="text-xs font-extrabold text-primary">{index + 1}</Text>
                   </View>
                   <Text className="flex-1 text-base font-bold text-foreground">{item.product_name}</Text>
                 </View>

                 {editingItem === item.product_name ? (
                   <View className="gap-3">
                     <View className="gap-1.5">
                       <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Quantity</Text>
                       <Input
                         value={editForm.quantity}
                         onChangeText={(text) => setEditForm((prev) => ({ ...prev, quantity: text }))}
                         keyboardType="decimal-pad"
                         className="h-11 rounded-[10px] bg-background px-3"
                       />
                     </View>

                     <View className="gap-1.5">
                       <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Department</Text>
                       <View className="flex-row flex-wrap gap-2">
                         {DEPARTMENTS.map((dept) => {
                           const selected = editForm.responsible_department === dept.value;
                           return (
                             <TouchableOpacity
                               key={dept.value}
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
                                 style={{ color: selected ? '#fff' : colors.textSecondary }}
                               >
                                 {dept.label}
                               </Text>
                             </TouchableOpacity>
                           );
                         })}
                       </View>
                     </View>

                     <View className="gap-1.5">
                       <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Issue Description</Text>
                       <Input
                         value={editForm.issue_description}
                         onChangeText={(text) => setEditForm((prev) => ({ ...prev, issue_description: text }))}
                         multiline
                         textAlignVertical="top"
                         className="min-h-[80px] rounded-[10px] bg-background pt-2.5 px-3"
                       />
                     </View>

                     <View className="flex-row gap-2.5 mt-2">
                       <TouchableOpacity
                         onPress={() => setEditingItem(null)}
                         className="flex-1 h-11 rounded-xl items-center justify-center bg-muted"
                       >
                         <Text className="font-bold text-muted-foreground">Cancel</Text>
                       </TouchableOpacity>
                       <TouchableOpacity
                         onPress={() => saveEdit(item.product_name)}
                         className="flex-1 h-11 rounded-xl items-center justify-center bg-primary"
                       >
                         <Text className="font-bold text-white">Save Changes</Text>
                       </TouchableOpacity>
                     </View>
                   </View>
                 ) : (
                   <View>
                     <View className="flex-row gap-5 mb-3">
                        <View>
                           <Text className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">QTY</Text>
                           <Text className="text-sm font-bold text-foreground">{item.quantity || 1}</Text>
                        </View>
                        {item.responsible_department && (
                          <View>
                            <Text className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">DEPT</Text>
                            <View
                              className="px-2 py-0.5 rounded-lg"
                              style={{ backgroundColor: colors.primary + '20' }}
                            >
                              <Text
                                className="text-xs font-bold capitalize"
                                style={{ color: colors.primary }}
                              >
                                {item.responsible_department}
                              </Text>
                            </View>
                          </View>
                        )}
                     </View>

                     <Text className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">ISSUE DESCRIPTION</Text>
                     <Text className="text-sm text-muted-foreground font-medium leading-5 mb-4">{item.issue_description || 'Not specified'}</Text>

                     <View className="flex-row gap-2.5">
                       <TouchableOpacity
                         onPress={() => { Haptics.selectionAsync(); startEdit(item); }}
                         accessible={true}
                         accessibilityRole="button"
                         accessibilityLabel={`Edit ${item.product_name}`}
                         className="flex-1 h-11 rounded-[10px] flex-row items-center justify-center gap-1.5 border border-border bg-muted"
                       >
                         <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                         <Text className="text-[13px] font-bold text-muted-foreground">Edit</Text>
                       </TouchableOpacity>
                       <TouchableOpacity
                         onPress={() => {
                           Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                           Alert.alert('Remove item?', `Remove "${item.product_name}" from bucket?`, [
                             { text: 'Cancel', style: 'cancel' },
                             {
                               text: 'Remove',
                               style: 'destructive',
                               onPress: () => removeFromBucket(item.product_name),
                             },
                           ]);
                         }}
                         accessible={true}
                         accessibilityRole="button"
                         accessibilityLabel={`Remove ${item.product_name}`}
                         className="flex-1 h-11 rounded-[10px] flex-row items-center justify-center gap-1.5 border"
                         style={{ backgroundColor: colors.danger + '10', borderColor: colors.danger + '20' }}
                       >
                         <Ionicons name="trash-outline" size={16} color={colors.danger} />
                         <Text className="text-[13px] font-bold text-danger">Remove</Text>
                       </TouchableOpacity>
                     </View>
                   </View>
                 )}
               </View>
            )}
          />
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default BucketScreen;
