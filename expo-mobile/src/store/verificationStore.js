import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { VERIFICATION_STEPS } from '../util/constants';

export const useVerificationStore = create(
  persist(
    (set, get) => ({
      currentStep: VERIFICATION_STEPS.PAN,
      isVerified: false,
      isPanVerified: false,
      isBankVerified: false,
      isDocumentUploaded: false,

      verificationData: {
        pan: '',
        accountNumber: '',
        ifsc: '',
      },

      setCurrentStep: (step) => set({ currentStep: step }),

      setVerificationStatus: (status) =>
        set({
          isVerified: status.is_verified || false,
          isPanVerified: status.is_pan_verified || false,
          isBankVerified: status.is_bank_details_verified || false,
          isDocumentUploaded: status.is_id_verified || false,
        }),

      setDocumentUploaded: (uploaded) => set({ isDocumentUploaded: uploaded }),

      nextStep: () => {
        const { currentStep } = get();
        if (currentStep === VERIFICATION_STEPS.PAN) {
          set({ currentStep: VERIFICATION_STEPS.BANK });
        } else if (currentStep === VERIFICATION_STEPS.BANK) {
          set({ currentStep: VERIFICATION_STEPS.DOCUMENT });
        }
      },

      resetVerification: () =>
        set({
          currentStep: VERIFICATION_STEPS.PAN,
          isVerified: false,
          isPanVerified: false,
          isBankVerified: false,
          isDocumentUploaded: false,
          verificationData: {
            pan: '',
            accountNumber: '',
            ifsc: '',
          },
        }),
    }),
    {
      name: 'verification-status',
      storage: createJSONStorage(() => AsyncStorage),
      // Do not persist sensitive input data — only completion flags and current step
      partialize: (state) => ({
        currentStep: state.currentStep,
        isPanVerified: state.isPanVerified,
        isBankVerified: state.isBankVerified,
        isDocumentUploaded: state.isDocumentUploaded,
      }),
    }
  )
);
