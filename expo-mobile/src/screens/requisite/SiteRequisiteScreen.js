import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddToBucketModal from '../../components/AddToBucketModal';
import BOMTreeNode from '../../components/BOMTreeNode';
import ScreenHeader from '../../components/common/ScreenHeader';
import { Card, IconButton, Notice, StatusBadge } from '../../components/common/Primitives';
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
import EmptyState from '../../components/common/EmptyState';
import { getApiErrorMessage, getApiFieldErrors } from '../../api/apiErrors';
import { spacing, typography } from '../../theme/designSystem';

const SiteRequisiteScreen = ({ navigation, route }) => {
  const [salesOrder, setSalesOrder] = useState(route.params?.salesOrder || '');
  const [cabinetPosition, setCabinetPosition] = useState('');
  const [allCabinets, setAllCabinets] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailsError, setDetailsError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [searched, setSearched] = useState(false);
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
    setFieldErrors({});

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
      setSearched(true);

      if (soResult.status === 'rejected') {
        setDetailsError(getApiErrorMessage(soResult.reason));
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
      setFieldErrors(getApiFieldErrors(err));
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
        contentContainerStyle={{ paddingHorizontal: px, paddingBottom: spacing.xl * 4 }}
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
              <IconButton
                icon="time-outline"
                label="Requisite history"
                onPress={() => navigation.navigate(ROUTES.HISTORY)}
              />
              <Button
                size="sm"
                onPress={() => navigation.navigate(ROUTES.REVIEW)}
                accessibilityLabel={`Review requisite, ${bucket.length} items`}
              >
                <Ionicons name="basket-outline" size={typography.title3.fontSize} color={colors.primaryForeground} />
                <Text>{bucket.length}</Text>
              </Button>
            </View>
          }
        />

        <Card className="mb-6">
          <View className="mb-4">
            <Text className="text-lg font-extrabold text-foreground">Select order</Text>
            <Text style={typography.caption} className="mt-1 text-muted-foreground">
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
              {fieldErrors.sales_order ? <Text className="text-xs text-destructive">{fieldErrors.sales_order}</Text> : null}
            </View>

            <View className="gap-2">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-xs font-bold text-muted-foreground uppercase">Cabinet Position</Text>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setAllCabinets((prev) => !prev)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: allCabinets }}
                  className={allCabinets ? 'border-primary bg-primary-light' : 'border-border bg-background'}
                >
                  <Ionicons
                    name={allCabinets ? 'checkbox' : 'square-outline'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text className={`text-xs font-bold ${allCabinets ? 'text-primary' : 'text-muted-foreground'}`}>All cabinets</Text>
                </Button>
              </View>
              <Input
                value={allCabinets ? 'ALL' : cabinetPosition}
                onChangeText={setCabinetPosition}
                editable={!allCabinets}
                placeholder="Enter position"
                accessibilityLabel="Cabinet position"
                className="h-12 rounded-xl bg-background border border-border px-4 text-base font-semibold text-foreground"
              />
              {fieldErrors.cabinet_position ? <Text className="text-xs text-destructive">{fieldErrors.cabinet_position}</Text> : null}
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
        </Card>

        {contextMatches && soDetails && (soDetails.customer_name || soDetails.project_name || soDetails.address_line_1) && (
          <Card className="mb-6">
            <Text style={typography.micro} className="uppercase text-muted-foreground">Loaded order</Text>
            <Text className="mt-1 text-base font-extrabold text-foreground">
              {soDetails.project_name || soDetails.customer_name || loadedSalesOrder}
            </Text>
            {soDetails.project_name && soDetails.customer_name ? (
              <Text style={typography.caption} className="mt-1 text-muted-foreground">{soDetails.customer_name}</Text>
            ) : null}
            <View className="mt-3 flex-row flex-wrap gap-2">
              {soDetails.order_state ? (
                <StatusBadge label={formatOrderState(soDetails.order_state)} tone="primary" />
              ) : null}
              {soDetails.client_order_ref ? (
                <StatusBadge label={`POC · ${soDetails.client_order_ref}`} />
              ) : null}
            </View>
            {deliveryAddress ? (
              <View className="mt-3 flex-row items-start gap-2 border-t border-border pt-3">
                <Ionicons name="location-outline" size={typography.body.fontSize} color={colors.textMuted} />
                <Text className="flex-1 text-xs text-muted-foreground" style={{ lineHeight: typography.caption.lineHeight }}>{deliveryAddress}</Text>
              </View>
            ) : null}
          </Card>
        )}

        {contextMatches && bomData.length ? (
          <View>
            <View className="mb-3">
              <Text className="text-lg font-extrabold text-foreground">Materials</Text>
              <Text style={typography.caption} className="mt-1 text-muted-foreground">Tap + to add an item to your bucket.</Text>
            </View>
            <Input
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search materials"
              accessibilityLabel="Search materials"
              className="mb-3 h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground"
            />
            <Card padded={false} className="gap-1 p-2">
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
            </Card>
          </View>
        ) : searched && contextMatches && !loading && !error ? (
          <Card><EmptyState icon="cube-outline" title="No materials found" subtitle="Try another cabinet position or load all cabinets." /></Card>
        ) : loading ? (
          <Card className="gap-3">
            <SkeletonBlock height={24} width="50%" />
            <SkeletonBlock height={48} width="100%" borderRadius={12} />
            <SkeletonBlock height={48} width="90%" borderRadius={12} />
            <SkeletonBlock height={48} width="95%" borderRadius={12} />
          </Card>
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
