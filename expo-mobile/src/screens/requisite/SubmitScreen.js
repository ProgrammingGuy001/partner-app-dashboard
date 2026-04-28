import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, FlatList, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "@react-native-vector-icons/ionicons";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { bomAPI } from '../../api/bomApi';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { ROUTES } from '../../util/constants';

const SubmitScreen = ({ navigation }) => {
  const { bucket, salesOrder, cabinetPosition, soDetails, setSODetails, clearBucket } = useRequisiteStore();
  const { colors } = useTheme();

  const [srPoc, setSrPoc] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  const fetchSODetails = useCallback(async () => {
    if (!salesOrder) {
      return null;
    }

    setDetailsLoading(true);
    setDetailsError('');

    try {
      const details = await bomAPI.lookupSO(salesOrder);
      setSODetails(details);
      return details;
    } catch (err) {
      const message = err?.message || 'Failed to fetch sales order details from Odoo.';
      setDetailsError(message);
      return null;
    } finally {
      setDetailsLoading(false);
    }
  }, [salesOrder, setSODetails]);

  useEffect(() => {
    if (salesOrder && !soDetails) {
      void fetchSODetails();
    } else if (soDetails) {
      setDetailsError('');
    }
  }, [fetchSODetails, salesOrder, soDetails]);

  const handleSubmit = async () => {
    if (!bucket.length) {
      setError('Bucket is empty. Please add items before submitting.');
      return;
    }

    if (!salesOrder || !cabinetPosition) {
      setError('Sales order and cabinet position are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const resolvedDetails = await fetchSODetails();
      if (!resolvedDetails) {
        setError('Sales order details must be fetched from Odoo before submitting the site requisite.');
        return;
      }

      const payload = {
        sales_order: salesOrder,
        cabinet_position: cabinetPosition,
        sr_poc: srPoc || null,
        items: bucket,
      };

      await bomAPI.submitRequisite(payload);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to submit requisite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center px-6">
          <View 
            className="bg-surface rounded-[32px] p-8 items-center w-full border border-border"
            style={colors.shadowMd}
          >
            <View 
              className="w-20 h-20 rounded-[40px] items-center justify-center mb-6"
              style={{ backgroundColor: colors.success + '15' }}
            >
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            </View>
            <Text className="text-2xl font-extrabold text-foreground text-center mb-2 tracking-tight">
              Submitted!
            </Text>
            <Text className="text-[15px] text-muted-foreground text-center mb-8 leading-[22px]">
              Your site requisite request has been successfully created and saved to history.
            </Text>
            
            <View className="w-full gap-3">
              <Button
                className="h-14 rounded-2xl bg-primary"
                onPress={() => {
                  clearBucket();
                  navigation.navigate(ROUTES.HISTORY);
                }}
              >
                <Text className="text-white font-bold">View Requisite History</Text>
              </Button>
              <TouchableOpacity
                className="h-[56px] items-center justify-center rounded-2xl"
                onPress={() => {
                  clearBucket();
                  navigation.navigate(ROUTES.SITE_REQUISITE);
                }}
              >
                <Text className="text-primary font-bold">Create New Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
        <>
          {/* Header */}
          <View className="flex-row items-center gap-3 pt-4 mb-6">
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
              style={colors.shadowSm}
              accessibilityRole="button"
              accessibilityLabel="Go Back"
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <View>
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                FINAL STEP
              </Text>
              <Text className="text-xl font-extrabold text-foreground tracking-tight">
                Confirm Requisite
              </Text>
            </View>
          </View>

          {error ? (
            <View className="flex-row items-center gap-1.5 mb-4 p-3 bg-danger-muted rounded-[10px] border border-danger-muted/20">
               <Ionicons name="alert-circle" size={16} color={colors.danger} />
               <Text className="text-danger text-[13px] font-semibold">{error}</Text>
            </View>
          ) : null}

          <View 
            className="bg-surface rounded-3xl p-6 mb-6 border border-border"
            style={colors.shadowMd}
          >
            <Text className="text-[17px] font-extrabold text-foreground mb-5">Project Context</Text>

            <View className="rounded-2xl border border-border bg-background p-4 mb-5">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Sales-order details from Odoo</Text>
                  <Text className="text-[12px] text-muted-foreground font-medium mt-1">
                    These values are refreshed before submission and will populate the site requisite.
                  </Text>
                </View>
                {detailsLoading ? (
                  <Text className="text-[12px] font-bold" style={{ color: colors.textMuted }}>Fetching...</Text>
                ) : soDetails ? (
                  <Text className="text-[12px] font-bold" style={{ color: colors.success }}>Synced</Text>
                ) : null}
              </View>

              {detailsError ? (
                <View className="flex-row items-start gap-2 mt-4 p-3 rounded-[10px]" style={{ backgroundColor: colors.warning + '12' }}>
                  <Ionicons name="warning-outline" size={16} color={colors.warning} style={{ marginTop: 2 }} />
                  <View className="flex-1">
                    <Text className="text-[12px] font-bold" style={{ color: colors.warning }}>SO details not available yet</Text>
                    <Text className="text-[12px] font-medium mt-1" style={{ color: colors.warning }}>
                      {detailsError}
                    </Text>
                  </View>
                </View>
              ) : soDetails ? (
                <View className="gap-3 mt-4">
                  <View className="flex-row items-start gap-2">
                    <Ionicons name="business-outline" size={15} color={colors.primary} />
                    <View className="flex-1">
                      <Text className="text-[10px] text-muted-foreground uppercase tracking-wide">Customer</Text>
                      <Text className="text-sm font-semibold text-foreground">{soDetails.customer_name || 'N/A'}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-start gap-2">
                    <Ionicons name="folder-outline" size={15} color={colors.primary} />
                    <View className="flex-1">
                      <Text className="text-[10px] text-muted-foreground uppercase tracking-wide">Project</Text>
                      <Text className="text-sm font-semibold text-foreground">{soDetails.project_name || 'N/A'}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-start gap-2">
                    <Ionicons name="person-outline" size={15} color={colors.primary} />
                    <View className="flex-1">
                      <Text className="text-[10px] text-muted-foreground uppercase tracking-wide">SO POC</Text>
                      <Text className="text-sm font-semibold text-foreground">{soDetails.client_order_ref || 'N/A'}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-start gap-2">
                    <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
                    <View className="flex-1">
                      <Text className="text-[10px] text-muted-foreground uppercase tracking-wide">Order Status</Text>
                      <Text className="text-sm font-semibold text-foreground">{formatOrderState(soDetails.order_state) || 'N/A'}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-start gap-2">
                    <Ionicons name="location-outline" size={15} color={colors.primary} />
                    <View className="flex-1">
                      <Text className="text-[10px] text-muted-foreground uppercase tracking-wide">Delivery Address</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {[soDetails.address_line_1, soDetails.address_line_2, soDetails.city, soDetails.state, soDetails.pincode]
                          .filter(Boolean)
                          .join(', ') || 'N/A'}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
            
            <View className="gap-4 mb-6">
              <View className="gap-2">
                <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Sales Order</Text>
                <View className="h-[56px] rounded-xl bg-background justify-center px-4 border border-border flex-row items-center">
                   <Text className="text-base font-bold text-muted-foreground">{salesOrder}</Text>
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Cabinet Position</Text>
                <View className="h-[56px] rounded-xl bg-background justify-center px-4 border border-border flex-row items-center">
                   <Text className="text-base font-bold text-muted-foreground">{cabinetPosition}</Text>
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">SR POC (Optional)</Text>
                <Input
                  value={srPoc}
                  onChangeText={setSrPoc}
                  placeholder="Enter contact name"
                  className="h-[56px] rounded-xl bg-background border border-border px-4"
                />
              </View>
            </View>

            <Button
              loading={loading}
              disabled={!bucket.length || detailsLoading || !soDetails}
              onPress={handleSubmit}
              className="h-[56px] rounded-2xl bg-primary"
            >
              <Text className="text-white text-base font-bold">Confirm & Submit</Text>
            </Button>
          </View>

          <View className="flex-row items-center justify-between mb-4 mt-2">
            <Text className="text-base font-extrabold text-foreground">Items Summary</Text>
            <View className="bg-primary-light px-2 py-1 rounded-lg">
               <Text className="text-xs font-extrabold text-primary">{bucket.length} Total</Text>
            </View>
          </View>
        </>
      );

      const renderItem = ({ item, index }) => (
        <View
          className="p-4 bg-background rounded-2xl border border-border mb-3 shadow-sm"
        >
          <Text className="text-sm font-bold text-foreground">{index + 1}. {item.product_name}</Text>
          <View className="flex-row mt-2 items-center gap-3 flex-wrap">
             <View className="flex-row items-center gap-1">
                <Ionicons name="layers-outline" size={14} color={colors.textSecondary} />
                <Text className="text-xs text-muted-foreground">
                  <Text className="font-bold">Qty:</Text> {item.quantity}
                </Text>
             </View>
             {item.responsible_department && (
               <View
                 className="px-2 py-0.5 rounded-lg flex-row items-center gap-1"
                 style={{ backgroundColor: colors.primary + '20' }}
               >
                 <Ionicons name="business-outline" size={12} color={colors.primary} />
                 <Text className="text-xs font-bold capitalize" style={{ color: colors.primary }}>
                   {item.responsible_department}
                 </Text>
               </View>
             )}
          </View>
        </View>
      );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          data={bucket}
          keyExtractor={(item) => item.product_name}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SubmitScreen;
