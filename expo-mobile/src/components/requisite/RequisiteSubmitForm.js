import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { bomAPI } from '../../api/bomApi';
import useRequisiteStore from '../../store/requisiteStore';
import { useTheme } from '../../hooks/useTheme';
import { Card, FieldLabel, Notice, StatusBadge } from '../common/Primitives';
import { isISODate } from '../../util/isoDate';
import { getApiErrorMessage, getApiFieldErrors } from '../../api/apiErrors';
import { typography } from '../../theme/designSystem';

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
  const [fieldErrors, setFieldErrors] = useState({});

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
      setDetailsError(getApiErrorMessage(err));
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
    setFieldErrors({});

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
      setError(getApiErrorMessage(err));
      setFieldErrors(getApiFieldErrors(err));
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

      <Card elevated className="mb-6">
        <Text className="text-lg font-extrabold text-foreground mb-5">Project context</Text>

        <View className="rounded-2xl border border-border bg-background p-4 mb-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text style={typography.micro} className="text-muted-foreground uppercase">
                Sales-order details from Odoo
              </Text>
              <Text style={typography.caption} className="text-muted-foreground mt-1">
                These values are refreshed before submission and will populate the site requisite.
              </Text>
            </View>
            {detailsLoading ? (
              <Text style={[typography.captionStrong, { color: colors.textMuted }]}>
                Fetching...
              </Text>
            ) : soDetails ? (
              <StatusBadge label="Synced" tone="success" />
            ) : null}
          </View>

          {detailsError ? (
            <Notice tone="warning" title="SO details not available yet" message={detailsError} className="mt-4" />
          ) : soDetails ? (
            <View className="gap-3 mt-4">
              <View className="flex-row items-start gap-2">
                <Ionicons name="business-outline" size={typography.callout.fontSize} color={colors.primary} />
                <View className="flex-1">
                  <Text style={typography.micro} className="text-muted-foreground uppercase">Customer</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.customer_name || 'N/A'}</Text>
                </View>
              </View>
              <View className="flex-row items-start gap-2">
                <Ionicons name="folder-outline" size={typography.callout.fontSize} color={colors.primary} />
                <View className="flex-1">
                  <Text style={typography.micro} className="text-muted-foreground uppercase">Project</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.project_name || 'N/A'}</Text>
                </View>
              </View>
              <View className="flex-row items-start gap-2">
                <Ionicons name="person-outline" size={typography.callout.fontSize} color={colors.primary} />
                <View className="flex-1">
                  <Text style={typography.micro} className="text-muted-foreground uppercase">SO POC</Text>
                  <Text className="text-sm font-semibold text-foreground">{soDetails.client_order_ref || 'N/A'}</Text>
                </View>
              </View>
              <View className="flex-row items-start gap-2">
                <Ionicons name="shield-checkmark-outline" size={typography.callout.fontSize} color={colors.primary} />
                <View className="flex-1">
                  <Text style={typography.micro} className="text-muted-foreground uppercase">Order status</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatOrderState(soDetails.order_state) || 'N/A'}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-start gap-2">
                <Ionicons name="location-outline" size={typography.callout.fontSize} color={colors.primary} />
                <View className="flex-1">
                  <Text style={typography.micro} className="text-muted-foreground uppercase">Delivery address</Text>
                  <Text className="text-sm font-semibold text-foreground">{addressLine}</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <View className="gap-4 mb-6">
          <View className="gap-2">
            <FieldLabel>Sales order</FieldLabel>
            <View className="h-14 rounded-xl bg-background justify-center px-4 border border-border flex-row items-center">
              <Text className="text-base font-bold text-muted-foreground">{salesOrder}</Text>
            </View>
            {fieldErrors.sales_order ? <Text className="text-xs text-destructive">{fieldErrors.sales_order}</Text> : null}
          </View>

          <View className="gap-2">
            <FieldLabel>Expected delivery (optional)</FieldLabel>
            <Input
              value={expectedDelivery}
              onChangeText={setExpectedDelivery}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              autoCorrect={false}
              accessibilityLabel="Expected delivery date"
              className="h-14 rounded-xl bg-background border border-border px-4 text-base font-semibold text-foreground"
            />
            {fieldErrors.expected_delivery ? <Text className="text-xs text-destructive">{fieldErrors.expected_delivery}</Text> : null}
          </View>

          <View className="gap-2">
            <FieldLabel>DO number (optional)</FieldLabel>
            <Input
              value={doNumber}
              onChangeText={setDoNumber}
              placeholder="Delivery order number"
              maxLength={255}
              accessibilityLabel="Delivery order number"
              className="h-14 rounded-xl bg-background border border-border px-4 text-base font-semibold text-foreground"
            />
            {fieldErrors.do_number ? <Text className="text-xs text-destructive">{fieldErrors.do_number}</Text> : null}
          </View>

          <View className="gap-2">
            <FieldLabel>Cabinet position</FieldLabel>
            <View className="h-14 rounded-xl bg-background justify-center px-4 border border-border flex-row items-center">
              <Text className="text-base font-bold text-muted-foreground">{cabinetPosition}</Text>
            </View>
            {fieldErrors.cabinet_position ? <Text className="text-xs text-destructive">{fieldErrors.cabinet_position}</Text> : null}
          </View>
        </View>

        <Button
          loading={loading}
          disabled={!bucket.length || detailsLoading || !soDetails}
          onPress={handleSubmit}
          className="h-14 rounded-2xl bg-primary"
        >
          <Text className="text-primary-foreground text-base font-bold">Confirm &amp; Submit</Text>
        </Button>
      </Card>
    </>
  );
};

export default RequisiteSubmitForm;
