import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { verificationApi } from '../../api/verificationApi';
import { getApiErrorMessage } from '../../api/apiErrors';
import { useAuthStore } from '../../store/authStore';
import { useVerificationStore } from '../../store/verificationStore';
import { useToast } from '../../hooks/useToast';

const DeleteVerificationDataButton = () => {
  const [deleting, setDeleting] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const resetVerification = useVerificationStore((state) => state.resetVerification);
  const toast = useToast();

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
      toast.error(getApiErrorMessage(error));
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
    <Button
      variant="destructive"
      onPress={confirm}
      disabled={deleting}
      accessibilityLabel="Delete verification data"
      accessibilityState={{ disabled: deleting, busy: deleting }}
      loading={deleting}
      className="w-full"
    >
      <Text>{deleting ? 'Deleting…' : 'Delete verification data'}</Text>
    </Button>
  );
};

export default DeleteVerificationDataButton;
