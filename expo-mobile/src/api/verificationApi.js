import { toRNFile } from '../util/helpers';
import {
  deleteVerificationData,
  getPanelAccess,
  getVerificationStatus,
  uploadDocument,
  verifyBank,
  verifyPan,
} from './verificationGeneratedApi';

export const verificationApi = {
  getVerificationStatus,

  verifyPan,

  verifyBank,

  uploadDocument: async (file) => {
    const rnFile = toRNFile(file);
    if (!rnFile) {
      throw new Error('Invalid file selected');
    }
    return uploadDocument(rnFile);
  },

  getPanelAccess,

  deleteVerificationData,
};
