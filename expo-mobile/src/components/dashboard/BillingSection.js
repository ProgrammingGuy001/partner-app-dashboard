import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
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
        <ActivityIndicator size="small" color={colors.primary} />
      )}

      {!loading && !invoiceRequest && (
        <View className="gap-3">
          <Text className="text-sm text-muted-foreground">
            No invoice request yet. Submit a request to generate your invoice.
          </Text>
          <TouchableOpacity
            onPress={handleRequest}
            disabled={requesting}
            className="rounded-xl bg-primary items-center justify-center py-3 px-5"
            style={{ opacity: requesting ? 0.6 : 1 }}
          >
            <Text className="text-sm font-bold text-white">
              {requesting ? 'Submitting…' : 'Request Invoice'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && status === 'pending' && (
        <View className="gap-2">
          <View className="flex-row items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <Ionicons name="time-outline" size={16} color="#d97706" />
            <Text className="text-sm font-semibold" style={{ color: '#d97706' }}>
              Invoice request pending admin approval
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            Requested on {new Date(invoiceRequest.requested_at).toLocaleDateString('en-IN')}
          </Text>
        </View>
      )}

      {!loading && status === 'rejected' && (
        <View className="gap-3">
          <View className="flex-row items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <Ionicons name="close-circle-outline" size={16} color="#dc2626" style={{ marginTop: 1 }} />
            <View className="flex-1">
              <Text className="text-sm font-semibold" style={{ color: '#dc2626' }}>
                Invoice request rejected
              </Text>
              {invoiceRequest.rejection_reason ? (
                <Text className="text-xs mt-1" style={{ color: '#dc2626' }}>
                  {invoiceRequest.rejection_reason}
                </Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            onPress={handleRequest}
            disabled={requesting}
            className="rounded-xl border border-border items-center justify-center py-3 px-5"
            style={{ opacity: requesting ? 0.6 : 1 }}
          >
            <Text className="text-sm font-bold text-foreground">
              {requesting ? 'Submitting…' : 'Re-request Invoice'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && status === 'approved' && (
        <View className="gap-4">
          <View className="flex-row items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
            <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
            <Text className="text-sm font-semibold" style={{ color: '#16a34a' }}>
              Invoice approved
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleDownload}
            disabled={downloading}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-border py-3 px-5"
            style={{ opacity: downloading ? 0.6 : 1 }}
          >
            <Ionicons name="download-outline" size={16} color={colors.text} />
            <Text className="text-sm font-bold text-foreground">
              {downloading ? 'Downloading…' : 'Download Bill XLSX'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default BillingSection;
