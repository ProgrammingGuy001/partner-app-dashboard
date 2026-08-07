import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddToBucketModal from '../../components/AddToBucketModal';
import BOMTreeNode from '../../components/BOMTreeNode';
import ScreenHeader from '../../components/common/ScreenHeader';
import { Notice } from '../../components/common/Primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { SkeletonBlock } from '../../components/common/EmptyState';
import { bomAPI } from '../../api/bomApi';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { useResponsive } from '../../hooks/useResponsive';
import { ROUTES } from '../../util/constants';
import Ionicons from '@react-native-vector-icons/ionicons';

const SiteRequisiteScreen = ({ navigation, route }) => {
  const [salesOrder, setSalesOrder] = useState(route.params?.salesOrder || '');
  const [cabinetPosition, setCabinetPosition] = useState('');
  const [allCabinets, setAllCabinets] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailsError, setDetailsError] = useState('');
  const { colors } = useTheme();
  const { px } = useResponsive();

  const {
    bomData,
    salesOrder: loadedSalesOrder,
    cabinetPosition: loadedCabinetPosition,
    setBOMData,
    addToBucket,
    bucket,
    soDetails,
    clearBucket,
  } = useRequisiteStore();

  useEffect(() => {
    const requestedSalesOrder = route.params?.salesOrder?.trim();
    if (!requestedSalesOrder) return;
    setSalesOrder(requestedSalesOrder);
    navigation.setParams({ salesOrder: undefined });
  }, [navigation, route.params?.salesOrder]);

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

  const loadBOM = async (normalizedSalesOrder, resolvedCabinetPosition) => {
    setLoading(true);
    setError('');
    setDetailsError('');

    try {
      const [bomResult, soResult] = await Promise.allSettled([
        bomAPI.fetchBOM(normalizedSalesOrder, resolvedCabinetPosition),
        bomAPI.lookupSO(normalizedSalesOrder),
      ]);

      if (bomResult.status === 'rejected') {
        throw bomResult.reason;
      }

      const resolvedDetails = soResult.status === 'fulfilled' ? soResult.value : null;
      setBOMData(bomResult.value, normalizedSalesOrder, resolvedCabinetPosition, resolvedDetails);

      if (soResult.status === 'rejected') {
        setDetailsError(soResult.reason?.message || 'Failed to fetch sales order details from Odoo.');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch BOM data');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchBOM = () => {
    const normalizedSalesOrder = salesOrder.trim();
    const resolvedCabinetPosition = allCabinets ? 'ALL' : cabinetPosition.trim();

    if (!normalizedSalesOrder || !resolvedCabinetPosition) {
      setError('Sales order and cabinet position are required');
      return;
    }

    const changesBucketContext = bucket.length > 0 && (
      loadedSalesOrder !== normalizedSalesOrder || loadedCabinetPosition !== resolvedCabinetPosition
    );
    if (changesBucketContext) {
      Alert.alert(
        'Start a new requisite?',
        'The bucket belongs to a different sales order or cabinet. Clear it before loading this material list.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear & Continue',
            style: 'destructive',
            onPress: () => {
              clearBucket();
              void loadBOM(normalizedSalesOrder, resolvedCabinetPosition);
            },
          },
        ],
      );
      return;
    }

    void loadBOM(normalizedSalesOrder, resolvedCabinetPosition);
  };

  const contextMatches = loadedSalesOrder === salesOrder.trim()
    && loadedCabinetPosition === (allCabinets ? 'ALL' : cabinetPosition.trim());

  const filteredBomData = React.useMemo(() => {
    if (!contextMatches) return [];
    if (!searchInput.trim() || !bomData.length) return bomData;
    const searchLower = searchInput.toLowerCase();

    const filterTree = (nodes) => {
      const result = [];
      for (const node of nodes) {
        if (node.product_name.toLowerCase().includes(searchLower)) {
          result.push(node);
        } else {
          const filteredChildren = filterTree(node.children || []);
          if (filteredChildren.length > 0) {
            result.push({ ...node, children: filteredChildren });
          }
        }
      }
      return result;
    };

    return filterTree(bomData);
  }, [bomData, contextMatches, searchInput]);

  const deliveryAddress = contextMatches && soDetails
    ? [soDetails.address_line_1, soDetails.address_line_2, soDetails.city, soDetails.state, soDetails.pincode]
      .filter(Boolean).join(', ')
    : '';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Site Requisite"
          subtitle="Create a material request"
          className="mb-5"
          right={
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => navigation.navigate(ROUTES.HISTORY)}
                accessibilityRole="button"
                accessibilityLabel="Requisite history"
                className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface"
              >
                <Ionicons name="time-outline" size={20} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate(ROUTES.BUCKET)}
                accessibilityRole="button"
                accessibilityLabel={`Open bucket, ${bucket.length} items`}
                className="h-11 flex-row items-center gap-2 rounded-xl bg-primary px-3"
              >
                <Ionicons name="basket-outline" size={20} color={colors.primaryForeground} />
                <Text className="font-bold text-[13px]" style={{ color: colors.primaryForeground }}>
                  {bucket.length}
                </Text>
              </TouchableOpacity>
            </View>
          }
        />

        <View className="mb-6 rounded-2xl border border-border bg-surface p-4">
          <View className="mb-4">
            <Text className="text-lg font-extrabold text-foreground">Select order</Text>
            <Text className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
              Choose the sales order and cabinet scope.
            </Text>
          </View>

          <View className="gap-4">
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
                  className={`min-h-11 flex-row items-center gap-1.5 rounded-xl border px-3 ${allCabinets ? 'border-primary bg-primary-light' : 'border-border bg-background'}`}
                >
                  <Ionicons
                    name={allCabinets ? 'checkbox' : 'square-outline'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text className={`text-xs font-bold ${allCabinets ? 'text-primary' : 'text-muted-foreground'}`}>All cabinets</Text>
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
             <Notice tone="danger" message={error} className="mt-4" />
          ) : null}

          {detailsError && contextMatches ? (
             <Notice
               tone="warning"
               title="SO details not available yet"
               message={`${detailsError} Fetch the SO details successfully before submitting the site requisite.`}
               className="mt-4"
             />
          ) : null}

          <Button
            className="mt-4 h-12 w-full rounded-xl bg-primary"
            loading={loading}
            onPress={handleFetchBOM}
          >
            <Text className="text-sm font-bold" style={{ color: colors.primaryForeground }}>
              Load materials
            </Text>
          </Button>
        </View>

        {contextMatches && soDetails && (soDetails.customer_name || soDetails.project_name || soDetails.address_line_1) && (
          <View className="mb-6 rounded-2xl border border-border bg-surface p-4">
            <Text className="text-[11px] font-bold uppercase text-muted-foreground">Loaded order</Text>
            <Text className="mt-1 text-base font-extrabold text-foreground">
              {soDetails.project_name || soDetails.customer_name || loadedSalesOrder}
            </Text>
            {soDetails.project_name && soDetails.customer_name ? (
              <Text className="mt-1 text-[13px] font-medium text-muted-foreground">{soDetails.customer_name}</Text>
            ) : null}
            <View className="mt-3 flex-row flex-wrap gap-2">
              {soDetails.order_state ? (
                <View className="rounded-lg bg-primary-light px-2.5 py-1.5">
                  <Text className="text-[11px] font-bold text-primary">{formatOrderState(soDetails.order_state)}</Text>
                </View>
              ) : null}
              {soDetails.client_order_ref ? (
                <View className="rounded-lg border border-border bg-background px-2.5 py-1.5">
                  <Text className="text-[11px] font-semibold text-muted-foreground">POC · {soDetails.client_order_ref}</Text>
                </View>
              ) : null}
            </View>
            {deliveryAddress ? (
              <View className="mt-3 flex-row items-start gap-2 border-t border-border pt-3">
                <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                <Text className="flex-1 text-[12px] leading-[17px] text-muted-foreground">{deliveryAddress}</Text>
              </View>
            ) : null}
          </View>
        )}

        {contextMatches && bomData.length ? (
          <View>
            <View className="mb-3">
              <Text className="text-lg font-extrabold text-foreground">Materials</Text>
              <Text className="mt-1 text-[13px] text-muted-foreground">Tap + to add an item to your bucket.</Text>
            </View>
            <Input
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search materials"
              accessibilityLabel="Search materials"
              className="mb-3 h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground"
            />
            <View className="gap-1 rounded-2xl border border-border bg-surface p-2">
              {filteredBomData.length > 0 ? (
                filteredBomData.map((item, index) => (
                  <BOMTreeNode key={`${item.product_name}-${index}`} node={item} onAddToBucket={setSelectedItem} />
                ))
              ) : (
                <View className="items-center py-8">
                  <Ionicons name="search-outline" size={22} color={colors.textMuted} />
                  <Text className="mt-2 text-sm font-semibold text-foreground">No matching materials</Text>
                  <Text className="mt-1 text-xs text-muted-foreground">Try a different product name.</Text>
                </View>
              )}
            </View>
          </View>
        ) : loading ? (
          <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
            <SkeletonBlock height={24} width="50%" />
            <SkeletonBlock height={48} width="100%" borderRadius={12} />
            <SkeletonBlock height={48} width="90%" borderRadius={12} />
            <SkeletonBlock height={48} width="95%" borderRadius={12} />
          </View>
        ) : null}
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
