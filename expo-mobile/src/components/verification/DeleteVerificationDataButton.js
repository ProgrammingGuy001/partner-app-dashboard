import React, { useState } from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';
import { verificationApi } from '../../api/verificationApi';
import { useAuthStore } from '../../store/authStore';
import { useVerificationStore } from '../../store/verificationStore';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../hooks/useTheme';

const DeleteVerificationDataButton = () => {
  const [deleting, setDeleting] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const resetVerification = useVerificationStore((state) => state.resetVerification);
  const toast = useToast();
  const { colors } = useTheme();

  const deleteData = async () => {
    setDeleting(true);
    try {
      await verificationApi.deleteVerificationData();
      resetVerification();
      setUser({
        ...user,
        is_pan_verified: false,
        is_bank_details_verified: false,
        is_id_verified: false,
      });
      toast.success('Verification data deleted');
    } catch (error) {
      toast.error(error.message || 'Failed to delete verification data');
    } finally {
      setDeleting(false);
    }
  };

  const confirm = () => Alert.alert(
    'Delete verification data?',
    'This permanently removes your PAN, bank details and uploaded verification documents. You will need to verify again.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete data', style: 'destructive', onPress: deleteData },
    ],
  );

  return (
    <TouchableOpacity
      onPress={confirm}
      disabled={deleting}
      accessibilityRole="button"
      accessibilityLabel="Delete verification data"
      accessibilityState={{ disabled: deleting, busy: deleting }}
      className="min-h-12 flex-row items-center justify-center gap-2 rounded-2xl border p-3"
      style={{ backgroundColor: colors.danger + '10', borderColor: colors.danger + '20', opacity: deleting ? 0.5 : 1 }}
    >
      <Ionicons name="trash-outline" size={19} color={colors.danger} />
      <Text style={{ color: colors.danger, fontWeight: '700' }}>{deleting ? 'Deleting…' : 'Delete verification data'}</Text>
    </TouchableOpacity>
  );
};

export default DeleteVerificationDataButton;
