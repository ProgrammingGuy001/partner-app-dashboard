import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddToBucketModal from '../../components/AddToBucketModal';
import BOMTreeNode from '../../components/BOMTreeNode';
import ScreenHeader from '../../components/common/ScreenHeader';
import EmptyState from '../../components/common/EmptyState';
import { Notice } from '../../components/common/Primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { bomAPI } from '../../api/bomApi';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { useResponsive } from '../../hooks/useResponsive';
import { ROUTES } from '../../util/constants';
import Ionicons from '@react-native-vector-icons/ionicons';

const SiteRequisiteScreen = ({ navigation }) => {
  const [salesOrder, setSalesOrder] = useState('');
  const [cabinetPosition, setCabinetPosition] = useState('');
  const [allCabinets, setAllCabinets] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailsError, setDetailsError] = useState('');
  const { colors } = useTheme();
  const { px } = useResponsive();

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
    const resolvedCabinetPosition = allCabinets ? 'ALL' : cabinetPosition.trim();

    if (!salesOrder.trim() || !resolvedCabinetPosition) {
      setError('Sales order and cabinet position are required');
      return;
    }

    setLoading(true);
    setError('');
    setDetailsError('');

    try {
      const [bomResult, soResult] = await Promise.allSettled([
        bomAPI.fetchBOM(salesOrder.trim(), resolvedCabinetPosition),
        bomAPI.lookupSO(salesOrder.trim()),
      ]);

      if (bomResult.status === 'rejected') {
        throw bomResult.reason;
      }

      const resolvedDetails = soResult.status === 'fulfilled' ? soResult.value : null;
      setBOMData(bomResult.value, salesOrder.trim(), resolvedCabinetPosition, resolvedDetails);

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
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* Premium Header */}
        <ScreenHeader
          title="Site Requisite"
          subtitle="Manage project materials"
          right={
            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={() => navigation.navigate(ROUTES.HISTORY)}
                accessibilityRole="button"
                accessibilityLabel="Requisite history"
                className="w-10 h-10 rounded-xl bg-surface items-center justify-center border border-border"
                style={colors.shadowSm}
              >
                <Ionicons name="time-outline" size={20} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate(ROUTES.BUCKET)}
                accessibilityRole="button"
                accessibilityLabel={`Open bucket, ${bucket.length} items`}
                className="h-10 rounded-xl bg-primary flex-row items-center gap-2 px-3"
                style={colors.shadowSm}
              >
                <Ionicons name="basket-outline" size={20} color={colors.primaryForeground} />
                <Text className="font-bold text-[13px]" style={{ color: colors.primaryForeground }}>
                  {bucket.length}
                </Text>
              </TouchableOpacity>
            </View>
          }
        />

        {/* Search Card */}
        <View 
          className="bg-surface rounded-2xl p-6 mb-6 border border-border"
          style={colors.shadowMd}
        >
          <Text className="text-[17px] font-extrabold text-foreground mb-4">Search Inventory</Text>
          
          <View className="gap-4 mb-6">
            <View className="gap-2">
              <Text className="text-xs font-bold text-muted-foreground uppercase">Sales Order</Text>
              <Input
                value={salesOrder}
                onChangeText={setSalesOrder}
                placeholder="SO-XXXXX"
                accessibilityLabel="Sales order"
                className="h-12 rounded-xl bg-background border border-border px-4 text-base font-semibold text-foreground"
              />
            </View>

            <View className="gap-2">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-xs font-bold text-muted-foreground uppercase">Cabinet Position</Text>
                <TouchableOpacity
                  onPress={() => setAllCabinets((prev) => !prev)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: allCabinets }}
                  className="flex-row items-center gap-1.5"
                >
                  <Ionicons
                    name={allCabinets ? 'checkbox' : 'square-outline'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text className="text-xs font-bold text-muted-foreground">All cabinets</Text>
                </TouchableOpacity>
              </View>
              <Input
                value={allCabinets ? 'ALL' : cabinetPosition}
                onChangeText={setCabinetPosition}
                editable={!allCabinets}
                placeholder="Enter position"
                accessibilityLabel="Cabinet position"
                className="h-12 rounded-xl bg-background border border-border px-4 text-base font-semibold text-foreground"
              />
            </View>
          </View>

          {error ? (
             <Notice tone="danger" message={error} className="mb-4" />
          ) : null}

          {detailsError ? (
             <Notice
               tone="warning"
               title="SO details not available yet"
               message={`${detailsError} Fetch the SO details successfully before submitting the site requisite.`}
               className="mb-4"
             />
          ) : null}

          <Button 
            className="w-full h-14 rounded-2xl bg-primary" 
            loading={loading} 
            onPress={handleFetchBOM}
          >
            <Text className="text-base font-bold" style={{ color: colors.primaryForeground }}>
              Fetch Material List
            </Text>
          </Button>
        </View>

        {soDetails && (soDetails.customer_name || soDetails.project_name || soDetails.address_line_1) && (
          <View
            className="bg-surface rounded-2xl p-5 mb-6 border border-border"
            style={colors.shadowSm}
          >
            <Text className="text-xs font-bold text-muted-foreground uppercase mb-3">Sales Order Details</Text>
            {soDetails.customer_name ? (
              <View className="flex-row items-start gap-2 mb-2">
                <Ionicons name="business-outline" size={15} color={colors.primary} />
                <View>
                  <Text className="text-[10px] text-muted-foreground uppercase">Customer</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.customer_name}</Text>
                </View>
              </View>
            ) : null}
            {soDetails.project_name ? (
              <View className="flex-row items-start gap-2 mb-2">
                <Ionicons name="folder-outline" size={15} color={colors.primary} />
                <View>
                  <Text className="text-[10px] text-muted-foreground uppercase">Project</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.project_name}</Text>
                </View>
              </View>
            ) : null}
            {soDetails.client_order_ref ? (
              <View className="flex-row items-start gap-2 mb-2">
                <Ionicons name="person-outline" size={15} color={colors.primary} />
                <View>
                  <Text className="text-[10px] text-muted-foreground uppercase">SO POC</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.client_order_ref}</Text>
                </View>
              </View>
            ) : null}
            {soDetails.order_state ? (
              <View className="flex-row items-start gap-2 mb-2">
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
                <View>
                  <Text className="text-[10px] text-muted-foreground uppercase">Order Status</Text>
                  <Text className="text-sm font-semibold text-foreground">{formatOrderState(soDetails.order_state)}</Text>
                </View>
              </View>
            ) : null}
            {soDetails.address_line_1 || soDetails.city ? (
              <View className="flex-row items-start gap-2">
                <Ionicons name="location-outline" size={15} color={colors.primary} />
                <View className="flex-1">
                  <Text className="text-[10px] text-muted-foreground uppercase">Delivery Address</Text>
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
            className="bg-surface rounded-2xl p-5 border border-border"
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
          <View className="py-[40px]">
            <EmptyState
              icon="search-outline"
              title="Search to fetch BOM"
              subtitle="Enter the sales order and cabinet position to load the material hierarchy."
            />
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
