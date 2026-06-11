import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';
import { grnApi } from '../../api/grnApi';
import { useTheme } from '../../hooks/useTheme';

const SiteGRNScreen = () => {
  const { colors } = useTheme();
  const [grn, setGrn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [received, setReceived] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fetchGRN = useCallback(async () => {
    try {
      const data = await grnApi.getAssigned();
      setGrn(data);
      const initial = {};
      data.packages.forEach(p => { initial[p.id] = p.is_received; });
      setReceived(initial);
      if (data.status === 'submitted') setSubmitted(true);
      setError('');
    } catch (err) {
      if (err?.response?.status === 404) {
        setError('No pending GRN is assigned to you.');
      } else {
        setError('Failed to load GRN. Pull down to retry.');
      }
    }
  }, []);

  useEffect(() => {
    fetchGRN().finally(() => setLoading(false));
  }, [fetchGRN]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGRN();
    setRefreshing(false);
  };

  const toggle = (pkgId) => {
    if (submitted) return;
    setReceived(prev => ({ ...prev, [pkgId]: !prev[pkgId] }));
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const packages = grn.packages.map(p => ({
        package_id: p.id,
        is_received: received[p.id] ?? false,
      }));
      const updated = await grnApi.submit(grn.id, packages);
      setGrn(updated);
      setSubmitted(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!grn) return;
    const missing = grn.packages.filter(p => !received[p.id]);
    if (missing.length > 0) {
      Alert.alert(
        'Missing Packages',
        `${missing.length} package${missing.length !== 1 ? 's' : ''} not marked as received.\n\nSubmitting will alert your supervisor. Continue?`,
        [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Submit Anyway', style: 'destructive', onPress: doSubmit },
        ]
      );
    } else {
      Alert.alert(
        'Submit GRN',
        'All packages marked as received. Submit now?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: doSubmit },
        ]
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textMuted }}>Loading GRN...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !grn) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          <Ionicons name="cube-outline" size={56} color={colors.border} />
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 22 }}>
            {error}
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const receivedCount = grn ? grn.packages.filter(p => received[p.id]).length : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="cube-outline" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Site GRN</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>{grn?.source_document}</Text>
          </View>
        </View>

        {/* Submitted status */}
        {submitted && (
          <View style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14,
            borderRadius: 12, marginBottom: 16,
            backgroundColor: grn.has_missing ? '#FFF5F5' : '#F0FFF4',
            borderWidth: 1, borderColor: grn.has_missing ? '#FCA5A5' : '#86EFAC',
          }}>
            <Ionicons
              name={grn.has_missing ? 'warning-outline' : 'checkmark-circle-outline'}
              size={20}
              color={grn.has_missing ? '#DC2626' : '#16A34A'}
              style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: grn.has_missing ? '#991B1B' : '#166534' }}>
                {grn.has_missing ? 'Submitted with missing packages' : 'All packages received'}
              </Text>
              {grn.submitted_at && (
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>
                  {new Date(grn.submitted_at).toLocaleString()}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Progress */}
        {grn && (
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 16, paddingHorizontal: 4,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
              Packages
            </Text>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>
              {receivedCount} / {grn.packages.length} received
            </Text>
          </View>
        )}

        {/* Package list */}
        {grn && grn.packages.map(pkg => {
          const isReceived = received[pkg.id] ?? false;
          return (
            <TouchableOpacity
              key={pkg.id}
              onPress={() => toggle(pkg.id)}
              disabled={submitted}
              activeOpacity={submitted ? 1 : 0.7}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                padding: 16, borderRadius: 12, marginBottom: 10,
                borderWidth: 1.5,
                borderColor: isReceived ? '#22C55E' : colors.border,
                backgroundColor: isReceived ? '#F0FFF4' : colors.surface,
                ...colors.shadowSm,
              }}
            >
              <View style={{
                width: 26, height: 26, borderRadius: 13, borderWidth: 2,
                borderColor: isReceived ? '#22C55E' : colors.border,
                backgroundColor: isReceived ? '#22C55E' : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {isReceived && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={{
                flex: 1, fontSize: 14, fontWeight: '500',
                color: isReceived ? '#166534' : colors.text,
              }}>
                {pkg.package_name}
              </Text>
              {!isReceived && !submitted && (
                <Text style={{ fontSize: 11, color: colors.textMuted }}>Tap</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Submit button */}
      {!submitted && grn && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: 20, paddingBottom: 32,
          backgroundColor: colors.background,
          borderTopWidth: 1, borderTopColor: colors.border,
        }}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 14, padding: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="clipboard-outline" size={20} color="#fff" />
            }
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {submitting ? 'Submitting...' : 'Submit GRN'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default SiteGRNScreen;
