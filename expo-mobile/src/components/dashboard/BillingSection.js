import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Notice } from '../common/Primitives';
import { dashboardApi } from '../../api/dashboardApi';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../hooks/useTheme';
import Ionicons from '@react-native-vector-icons/ionicons';

const BillingSection = ({ job }) => {
  const toast = useToast();
  const { colors } = useTheme();

  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchBilling = useCallback(async () => {
    if (!job?.id) return;
    try {
      const data = await dashboardApi.getBilling(job.id);
      setBilling(data);
    } catch {
      // billing may not exist yet — not an error
    } finally {
      setLoading(false);
    }
  }, [job?.id]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const handleRequest = async () => {
    setRequesting(true);
    try {
      await dashboardApi.requestInvoice(job.id);
      toast.success('Invoice request submitted');
      fetchBilling();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to submit invoice request');
    } finally {
      setRequesting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await dashboardApi.downloadInvoice(job.id, job.name);
      toast.success('Bill downloaded');
    } catch (err) {
      toast.error(err?.message || 'Failed to download bill');
    } finally {
      setDownloading(false);
    }
  };

  const invoiceRequest = billing?.invoice_request;
  const status = invoiceRequest?.status;

  return (
    <View
      className="mt-6 rounded-2xl border border-border bg-surface p-5"
      style={colors.shadowSm}
    >
      <View className="flex-row items-center gap-2 mb-4">
        <Ionicons name="receipt-outline" size={18} color={colors.primary} />
        <Text className="text-base font-extrabold text-foreground">Billing</Text>
      </View>

      {loading && (
        <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Loading billing status" />
      )}

      {!loading && !invoiceRequest && (
        <View className="gap-3">
          <Text className="text-sm text-muted-foreground">
            No invoice request yet. Submit a request to generate your invoice.
          </Text>
          <Button
            onPress={handleRequest}
            disabled={requesting}
            loading={requesting}
            className="w-full"
          >
            <Text className="text-sm font-bold text-primary-foreground">Request Invoice</Text>
          </Button>
        </View>
      )}

      {!loading && status === 'pending' && (
        <View className="gap-2">
          <Notice tone="warning" title="Invoice request pending" message="Admin approval is required before the bill can be downloaded." />
          <Text className="text-xs text-muted-foreground">
            Requested on {new Date(invoiceRequest.requested_at).toLocaleDateString('en-IN')}
          </Text>
        </View>
      )}

      {!loading && status === 'rejected' && (
        <View className="gap-3">
          <Notice
            tone="danger"
            title="Invoice request rejected"
            message={invoiceRequest.rejection_reason || 'Submit a new invoice request after reviewing the job billing details.'}
          />
          <Button
            variant="outline"
            onPress={handleRequest}
            disabled={requesting}
            loading={requesting}
            className="w-full"
          >
            <Text className="text-sm font-bold text-primary">Re-request Invoice</Text>
          </Button>
        </View>
      )}

      {!loading && status === 'approved' && (
        <View className="gap-4">
          <Notice tone="success" title="Invoice approved" message="The bill is ready to download." />
          <Button
            variant="outline"
            onPress={handleDownload}
            disabled={downloading}
            loading={downloading}
            className="w-full"
          >
            <Ionicons name="download-outline" size={16} color={colors.primary} />
            <Text className="text-sm font-bold text-foreground">
              Download Bill XLSX
            </Text>
          </Button>
        </View>
      )}
    </View>
  );
};

export default BillingSection;
