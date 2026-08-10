import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { bomAPI } from '../../api/bomApi';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { Notice } from '../common/Primitives';
import { isISODate } from '../../util/isoDate';

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

/**
 * Project context plus the fields that turn a bucket into a submitted requisite.
 *
 * Shared by SubmitScreen and ReviewScreen. The SO lookup, the validation and the
 * submit call live here once, so the combined review flow cannot fall behind the
 * standalone submit step.
 */
const RequisiteSubmitForm = ({ onSubmitted }) => {
  const { bucket, salesOrder, cabinetPosition, soDetails, setSODetails } = useRequisiteStore();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [error, setError] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [doNumber, setDoNumber] = useState('');

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

    if (expectedDelivery && !isISODate(expectedDelivery)) {
      setError('Expected delivery must be a valid date in YYYY-MM-DD format.');
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
        expected_delivery: expectedDelivery || null,
        do_number: doNumber.trim() || null,
        items: bucket,
      };

      await bomAPI.submitRequisite(payload);
      onSubmitted?.();
    } catch (err) {
      setError(err.message || 'Failed to submit requisite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addressLine =
    [soDetails?.address_line_1, soDetails?.address_line_2, soDetails?.city, soDetails?.state, soDetails?.pincode]
      .filter(Boolean)
      .join(', ') || 'N/A';

  return (
    <>
      {error ? <Notice tone="danger" message={error} className="mb-4" /> : null}

      <View className="bg-surface rounded-2xl p-6 mb-6 border border-border" style={colors.shadowMd}>
        <Text className="text-[17px] font-extrabold text-foreground mb-5">Project Context</Text>

        <View className="rounded-2xl border border-border bg-background p-4 mb-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-[11px] font-bold text-muted-foreground uppercase">
                Sales-order details from Odoo
              </Text>
              <Text className="text-[12px] text-muted-foreground font-medium mt-1">
                These values are refreshed before submission and will populate the site requisite.
              </Text>
            </View>
            {detailsLoading ? (
              <Text className="text-[12px] font-bold" style={{ color: colors.textMuted }}>
                Fetching...
              </Text>
            ) : soDetails ? (
              <Text className="text-[12px] font-bold" style={{ color: colors.success }}>
                Synced
              </Text>
            ) : null}
          </View>

          {detailsError ? (
            <Notice tone="warning" title="SO details not available yet" message={detailsError} className="mt-4" />
          ) : soDetails ? (
            <View className="gap-3 mt-4">
              <View className="flex-row items-start gap-2">
                <Ionicons name="business-outline" size={15} color={colors.primary} />
                <View className="flex-1">
                  <Text className="text-[10px] text-muted-foreground uppercase">Customer</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.customer_name || 'N/A'}</Text>
                </View>
              </View>
              <View className="flex-row items-start gap-2">
                <Ionicons name="folder-outline" size={15} color={colors.primary} />
                <View className="flex-1">
                  <Text className="text-[10px] text-muted-foreground uppercase">Project</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.project_name || 'N/A'}</Text>
                </View>
              </View>
              <View className="flex-row items-start gap-2">
                <Ionicons name="person-outline" size={15} color={colors.primary} />
                <View className="flex-1">
                  <Text className="text-[10px] text-muted-foreground uppercase">SO POC</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.client_order_ref || 'N/A'}</Text>
                </View>
              </View>
              <View className="flex-row items-start gap-2">
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
                <View className="flex-1">
                  <Text className="text-[10px] text-muted-foreground uppercase">Order Status</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatOrderState(soDetails.order_state) || 'N/A'}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-start gap-2">
                <Ionicons name="location-outline" size={15} color={colors.primary} />
                <View className="flex-1">
                  <Text className="text-[10px] text-muted-foreground uppercase">Delivery Address</Text>
                  <Text className="text-sm font-semibold text-foreground">{addressLine}</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <View className="gap-4 mb-6">
          <View className="gap-2">
            <Text className="text-[11px] font-bold text-muted-foreground uppercase">Sales Order</Text>
            <View className="h-[56px] rounded-xl bg-background justify-center px-4 border border-border flex-row items-center">
              <Text className="text-base font-bold text-muted-foreground">{salesOrder}</Text>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-[11px] font-bold text-muted-foreground uppercase">
              Expected Delivery (Optional)
            </Text>
            <Input
              value={expectedDelivery}
              onChangeText={setExpectedDelivery}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              autoCorrect={false}
              accessibilityLabel="Expected delivery date"
              className="h-[56px] rounded-xl bg-background border border-border px-4 text-base font-semibold text-foreground"
            />
          </View>

          <View className="gap-2">
            <Text className="text-[11px] font-bold text-muted-foreground uppercase">DO Number (Optional)</Text>
            <Input
              value={doNumber}
              onChangeText={setDoNumber}
              placeholder="Delivery order number"
              maxLength={255}
              accessibilityLabel="Delivery order number"
              className="h-[56px] rounded-xl bg-background border border-border px-4 text-base font-semibold text-foreground"
            />
          </View>

          <View className="gap-2">
            <Text className="text-[11px] font-bold text-muted-foreground uppercase">Cabinet Position</Text>
            <View className="h-[56px] rounded-xl bg-background justify-center px-4 border border-border flex-row items-center">
              <Text className="text-base font-bold text-muted-foreground">{cabinetPosition}</Text>
            </View>
          </View>
        </View>

        <Button
          loading={loading}
          disabled={!bucket.length || detailsLoading || !soDetails}
          onPress={handleSubmit}
          className="h-[56px] rounded-2xl bg-primary"
        >
          <Text className="text-primary-foreground text-base font-bold">Confirm &amp; Submit</Text>
        </Button>
      </View>
    </>
  );
};

export default RequisiteSubmitForm;
