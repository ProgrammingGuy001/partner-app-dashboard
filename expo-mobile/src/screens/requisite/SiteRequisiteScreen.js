import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddToBucketModal from '../../components/AddToBucketModal';
import BOMTreeNode from '../../components/BOMTreeNode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { bomAPI } from '../../api/bomApi';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { ROUTES } from '../../util/constants';
import Ionicons from '@react-native-vector-icons/ionicons';

const SiteRequisiteScreen = ({ navigation }) => {
  const [salesOrder, setSalesOrder] = useState('');
  const [cabinetPosition, setCabinetPosition] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailsError, setDetailsError] = useState('');
  const { colors, isDark } = useTheme();

  const { bomData, setBOMData, addToBucket, bucket, soDetails } = useRequisiteStore();

  const formatOrderState = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return '';

    const labels = {
      draft: 'Quotation',
      sent: 'Quotation Sent',
      sale: 'Confirmed',
      done: 'Locked',
      cancel: 'Cancelled',
    };

    return labels[normalized] || normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const handleFetchBOM = async () => {
    if (!salesOrder.trim() || !cabinetPosition.trim()) {
      setError('Sales order and cabinet position are required');
      return;
    }

    setLoading(true);
    setError('');
    setDetailsError('');

    try {
      const [bomResult, soResult] = await Promise.allSettled([
        bomAPI.fetchBOM(salesOrder.trim(), cabinetPosition.trim()),
        bomAPI.lookupSO(salesOrder.trim()),
      ]);

      if (bomResult.status === 'rejected') {
        throw bomResult.reason;
      }

      const resolvedDetails = soResult.status === 'fulfilled' ? soResult.value : null;
      setBOMData(bomResult.value, salesOrder.trim(), cabinetPosition.trim(), resolvedDetails);

      if (soResult.status === 'rejected') {
        setDetailsError(soResult.reason?.message || 'Failed to fetch sales order details from Odoo.');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch BOM data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Premium Header */}
        <View className="flex-row justify-between items-center pt-5 mb-6">
          <View>
            <Text className="text-2xl font-extrabold text-foreground tracking-tight">Site Requisite</Text>
            <Text className="text-[13px] text-muted-foreground font-medium mt-1">Manage project materials</Text>
          </View>
          <View className="flex-row gap-2.5">
            <TouchableOpacity 
              onPress={() => navigation.navigate(ROUTES.HISTORY)}
              className="w-10 h-10 rounded-xl bg-surface items-center justify-center border border-border"
              style={colors.shadowSm}
            >
              <Ionicons name="time-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => navigation.navigate(ROUTES.BUCKET)}
              className="h-10 rounded-xl bg-primary flex-row items-center gap-2 px-3"
              style={colors.shadowSm}
            >
              <Ionicons name="basket-outline" size={20} color={isDark ? colors.background : "#fff"} />
              <Text className="font-bold text-[13px]" style={{ color: isDark ? colors.background : "#fff" }}>
                {bucket.length}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Card */}
        <View 
          className="bg-surface rounded-3xl p-6 mb-6 border border-border"
          style={colors.shadowMd}
        >
          <Text className="text-[17px] font-extrabold text-foreground mb-4">Search Inventory</Text>
          
          <View className="gap-4 mb-6">
            <View className="gap-2">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Sales Order</Text>
              <Input
                value={salesOrder}
                onChangeText={setSalesOrder}
                placeholder="SO-XXXXX"
                className="h-[52px] rounded-xl bg-background border border-border px-4 text-base font-semibold text-foreground"
              />
            </View>

            <View className="gap-2">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Cabinet Position</Text>
              <Input
                value={cabinetPosition}
                onChangeText={setCabinetPosition}
                placeholder="Enter position"
                className="h-[52px] rounded-xl bg-background border border-border px-4 text-base font-semibold text-foreground"
              />
            </View>
          </View>

          {error ? (
             <View className="flex-row items-center gap-1.5 mb-4 p-3 bg-danger-muted rounded-[10px] border border-danger-muted/20">
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text className="text-danger text-[12px] font-semibold">{error}</Text>
             </View>
          ) : null}

          {detailsError ? (
             <View className="flex-row items-start gap-1.5 mb-4 p-3 rounded-[10px] border border-amber-300/60 bg-amber-50">
                <Ionicons name="warning-outline" size={16} color="#92400e" style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text style={{ color: '#78350f' }} className="text-[12px] font-bold">SO details not available yet</Text>
                  <Text style={{ color: '#92400e' }} className="text-[12px] font-medium mt-1">
                    {detailsError} Fetch the SO details successfully before submitting the site requisite.
                  </Text>
                </View>
             </View>
          ) : null}

          <Button 
            className="w-full h-14 rounded-2xl bg-primary" 
            loading={loading} 
            onPress={handleFetchBOM}
          >
            <Text className="text-base font-bold" style={{ color: isDark ? colors.background : "#fff" }}>
              Fetch Material List
            </Text>
          </Button>
        </View>

        {soDetails && (soDetails.customer_name || soDetails.project_name || soDetails.address_line_1) && (
          <View
            className="bg-surface rounded-3xl p-5 mb-6 border border-border"
            style={colors.shadowSm}
          >
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Sales Order Details</Text>
            {soDetails.customer_name ? (
              <View className="flex-row items-start gap-2 mb-2">
                <Ionicons name="business-outline" size={15} color={colors.primary} />
                <View>
                  <Text className="text-[10px] text-muted-foreground uppercase tracking-wide">Customer</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.customer_name}</Text>
                </View>
              </View>
            ) : null}
            {soDetails.project_name ? (
              <View className="flex-row items-start gap-2 mb-2">
                <Ionicons name="folder-outline" size={15} color={colors.primary} />
                <View>
                  <Text className="text-[10px] text-muted-foreground uppercase tracking-wide">Project</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.project_name}</Text>
                </View>
              </View>
            ) : null}
            {soDetails.client_order_ref ? (
              <View className="flex-row items-start gap-2 mb-2">
                <Ionicons name="person-outline" size={15} color={colors.primary} />
                <View>
                  <Text className="text-[10px] text-muted-foreground uppercase tracking-wide">SO POC</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.client_order_ref}</Text>
                </View>
              </View>
            ) : null}
            {soDetails.order_state ? (
              <View className="flex-row items-start gap-2 mb-2">
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
                <View>
                  <Text className="text-[10px] text-muted-foreground uppercase tracking-wide">Order Status</Text>
                  <Text className="text-sm font-semibold text-foreground">{formatOrderState(soDetails.order_state)}</Text>
                </View>
              </View>
            ) : null}
            {soDetails.address_line_1 || soDetails.city ? (
              <View className="flex-row items-start gap-2">
                <Ionicons name="location-outline" size={15} color={colors.primary} />
                <View className="flex-1">
                  <Text className="text-[10px] text-muted-foreground uppercase tracking-wide">Delivery Address</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {[soDetails.address_line_1, soDetails.address_line_2, soDetails.city, soDetails.state, soDetails.pincode]
                      .filter(Boolean).join(', ')}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {bomData.length ? (
          <View
            className="bg-surface rounded-3xl p-5 border border-border"
            style={colors.shadowSm}
          >
            <View className="flex-row items-center gap-2 mb-4">
              <Ionicons name="list" size={18} color={colors.primary} />
              <Text className="text-base font-extrabold text-foreground">Material Hierarchy</Text>
            </View>
            <View className="gap-1">
              {bomData.map((item, index) => (
                <BOMTreeNode key={`${item.product_name}-${index}`} node={item} onAddToBucket={setSelectedItem} />
              ))}
            </View>
          </View>
        ) : !loading && (
          <View className="items-center py-[60px] opacity-50">
             <Ionicons name="search-outline" size={48} color={colors.textMuted} />
             <Text className="mt-3 text-sm font-semibold text-muted-foreground">Enter details above to fetch BOM</Text>
          </View>
        )}
      </ScrollView>

      <AddToBucketModal
        visible={Boolean(selectedItem)}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSave={(itemData) => {
          addToBucket(itemData);
          setSelectedItem(null);
        }}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SiteRequisiteScreen;
