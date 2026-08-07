import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, TextInput } from 'react-native';
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
  const [downloadingId, setDownloadingId] = useState(null);
  const [billingError, setBillingError] = useState('');
  const [showAdditionalForm, setShowAdditionalForm] = useState(false);
  const [completionPercentage, setCompletionPercentage] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  const fetchBilling = useCallback(async () => {
    if (!job?.id) return;
    try {
      setBillingError('');
      const data = await dashboardApi.getBilling(job.id);
      setBilling(data);
    } catch (error) {
      setBillingError(error.message || 'Failed to load billing information');
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

  const handleDownload = async (invoiceRequestId) => {
    setDownloadingId(invoiceRequestId);
    try {
      await dashboardApi.downloadInvoice(job.id, job.name, invoiceRequestId);
      toast.success('Bill downloaded');
    } catch (err) {
      toast.error(err?.message || 'Failed to download bill');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleAdditionalRequest = async () => {
    const percentage = completionPercentage === '' ? undefined : Number(completionPercentage);
    if (percentage !== undefined && (!Number.isInteger(percentage) || percentage < 0 || percentage > 100)) {
      toast.error('Completion percentage must be a whole number from 0 to 100');
      return;
    }
    setRequesting(true);
    try {
      await dashboardApi.requestAdditionalInvoice(job.id, {
        completion_percentage: percentage,
        notes: invoiceNotes.trim() || undefined,
      });
      setCompletionPercentage('');
      setInvoiceNotes('');
      setShowAdditionalForm(false);
      await fetchBilling();
      toast.success('Additional invoice request submitted');
    } catch (error) {
      toast.error(error.message || 'Failed to submit invoice request');
    } finally {
      setRequesting(false);
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

      {!loading && billingError ? (
        <View className="gap-2">
          <Notice tone="danger" title="Billing unavailable" message={billingError} />
          <Button variant="outline" onPress={fetchBilling}><Text>Retry</Text></Button>
        </View>
      ) : null}

      {!loading && !billingError && !invoiceRequest && (
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

      {!loading && !billingError && status === 'pending' && (
        <View className="gap-2">
          <Notice tone="warning" title="Invoice request pending" message="Admin approval is required before the bill can be downloaded." />
          <Text className="text-xs text-muted-foreground">
            Requested on {new Date(invoiceRequest.requested_at).toLocaleDateString('en-IN')}
          </Text>
        </View>
      )}

      {!loading && !billingError && status === 'rejected' && (
        <View className="gap-3">
          <Notice
            tone="danger"
            title="Invoice request rejected"
            message={invoiceRequest.rejection_reason || 'Submit a new invoice request after reviewing the job billing details.'}
          />
        </View>
      )}

      {!loading && !billingError && status === 'approved' && (
        <View className="gap-4">
          <Notice tone="success" title="Invoice approved" message="The bill is ready to download." />
          <Button
            variant="outline"
            onPress={() => handleDownload(invoiceRequest.id)}
            disabled={downloadingId === invoiceRequest.id}
            loading={downloadingId === invoiceRequest.id}
            className="w-full"
          >
            <Ionicons name="download-outline" size={16} color={colors.primary} />
            <Text className="text-sm font-bold text-foreground">
              Download Bill XLSX
            </Text>
          </Button>
        </View>
      )}

      {!loading && !billingError && invoiceRequest && (invoiceRequest.completion_percentage != null || invoiceRequest.notes) ? (
        <View className="mt-3 rounded-xl border border-border bg-background p-3">
          {invoiceRequest.completion_percentage != null ? <Text className="text-sm text-foreground">Completion: {invoiceRequest.completion_percentage}%</Text> : null}
          {invoiceRequest.notes ? <Text className="mt-1 text-sm text-muted-foreground">{invoiceRequest.notes}</Text> : null}
        </View>
      ) : null}

      {!loading && !billingError && invoiceRequest && status !== 'pending' ? (
        <View className="mt-4 border-t border-border pt-4">
          {!showAdditionalForm ? (
            <Button variant="outline" onPress={() => setShowAdditionalForm(true)}>
              <Text>{status === 'rejected' ? 'Request again' : 'Request another invoice'}</Text>
            </Button>
          ) : (
            <View className="gap-3">
              <Text className="text-xs font-bold text-muted-foreground">COMPLETION PERCENTAGE (OPTIONAL)</Text>
              <TextInput
                value={completionPercentage}
                onChangeText={setCompletionPercentage}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="0-100"
                placeholderTextColor={colors.textMuted}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              />
              <Text className="text-xs font-bold text-muted-foreground">NOTES (OPTIONAL)</Text>
              <TextInput
                value={invoiceNotes}
                onChangeText={setInvoiceNotes}
                maxLength={1000}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor={colors.textMuted}
                className="min-h-20 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
              <View className="flex-row gap-2">
                <Button className="flex-1" onPress={handleAdditionalRequest} loading={requesting}><Text>Submit request</Text></Button>
                <Button className="flex-1" variant="outline" onPress={() => setShowAdditionalForm(false)} disabled={requesting}><Text>Cancel</Text></Button>
              </View>
            </View>
          )}
        </View>
      ) : null}

      {!loading && (billing?.invoice_requests || []).some(invoice => invoice.status === 'approved' && invoice.id !== invoiceRequest?.id) && (
        <View className="mt-4 gap-2 border-t border-border pt-4">
          <Text className="text-sm font-bold text-foreground">Previous approved invoices</Text>
          {(billing?.invoice_requests || [])
            .filter(invoice => invoice.status === 'approved' && invoice.id !== invoiceRequest?.id)
            .map(invoice => (
              <Button
                key={invoice.id}
                variant="outline"
                onPress={() => handleDownload(invoice.id)}
                disabled={downloadingId === invoice.id}
                loading={downloadingId === invoice.id}
                className="w-full"
              >
                <Ionicons name="download-outline" size={16} color={colors.primary} />
                <Text className="text-sm font-bold text-foreground">
                  {invoice.invoice_number || `Invoice ${invoice.id}`}
                </Text>
              </Button>
            ))}
        </View>
      )}
    </View>
  );
};

export default BillingSection;
