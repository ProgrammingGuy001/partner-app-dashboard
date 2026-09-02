import {
  checkPanelAccessApiV1VerificationPanelAccessGet,
  deleteVerificationDataApiV1VerificationDataDelete,
  getVerificationStatusApiV1VerificationStatusGet,
  uploadIdDocumentApiV1VerificationVerifyDocumentPost,
  verifyBankApiV1VerificationBankPost,
  verifyPanApiV1VerificationPanPost,
} from './generatedClient';

type ReactNativeFile = { uri: string; name: string; type: string };

export const getVerificationStatus = async () => {
  const response = await getVerificationStatusApiV1VerificationStatusGet({ throwOnError: true });
  return response.data;
};

export const verifyPan = async (pan: string) => {
  const response = await verifyPanApiV1VerificationPanPost({
    body: { pan: pan.toUpperCase() },
    throwOnError: true,
  });
  return response.data;
};

export const verifyBank = async (accountNumber: string, ifsc: string) => {
  const response = await verifyBankApiV1VerificationBankPost({
    body: { account_number: accountNumber, ifsc: ifsc.toUpperCase(), fetch_ifsc: false },
    throwOnError: true,
  });
  return response.data;
};

export const uploadDocument = async (file: ReactNativeFile) => {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  const response = await uploadIdDocumentApiV1VerificationVerifyDocumentPost({
    body: { file: file as unknown as Blob },
    bodySerializer: () => formData,
    throwOnError: true,
  });
  return response.data;
};

export const getPanelAccess = async () => {
  const response = await checkPanelAccessApiV1VerificationPanelAccessGet({ throwOnError: true });
  return response.data;
};

export const deleteVerificationData = async () => {
  const response = await deleteVerificationDataApiV1VerificationDataDelete({ throwOnError: true });
  return response.data;
};
