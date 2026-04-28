import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from './constants';

export const validators = {
  phone: (phone) => {
    if (!phone) return { valid: false, message: 'Phone number is required' };
    const valid = /^[6-9]\d{9}$/.test(phone);
    return {
      valid,
      message: valid ? '' : 'Please enter a valid 10-digit phone number',
    };
  },

  pan: (pan) => {
    if (!pan) return { valid: false, message: 'PAN is required' };
    const valid = /^[A-Z]{5}\d{4}[A-Z]$/.test(pan.toUpperCase());
    return {
      valid,
      message: valid ? '' : 'Please enter a valid PAN (e.g., ABCDE1234F)',
    };
  },

  ifsc: (ifsc) => {
    if (!ifsc) return { valid: false, message: 'IFSC code is required' };
    const valid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
    return {
      valid,
      message: valid ? '' : 'Please enter a valid IFSC code (e.g., ABCD0123456)',
    };
  },

  accountNumber: (account) => {
    if (!account) return { valid: false, message: 'Account number is required' };
    const valid = /^\d{9,18}$/.test(account);
    return {
      valid,
      message: valid ? '' : 'Account number must be 9-18 digits',
    };
  },

  pincode: (pincode) => {
    if (!pincode) return { valid: false, message: 'Pincode is required' };
    const valid = /^[1-9][0-9]{5}$/.test(pincode);
    return {
      valid,
      message: valid ? '' : 'Please enter a valid 6-digit pincode',
    };
  },

  name: (name) => {
    if (!name) return { valid: false, message: 'Name is required' };
    const valid = /^[a-zA-Z\s]{2,50}$/.test(name.trim());
    return {
      valid,
      message: valid ? '' : 'Name must be 2-50 characters (letters only)',
    };
  },

  otp: (otp) => {
    if (!otp) return { valid: false, message: 'OTP is required' };
    const valid = /^\d{6}$/.test(otp);
    return {
      valid,
      message: valid ? '' : 'OTP must be 6 digits',
    };
  },

  file: (file) => {
    if (!file) return { valid: false, message: 'File is required' };

    if (file.mimeType && !ALLOWED_FILE_TYPES.includes(file.mimeType)) {
      return {
        valid: false,
        message: 'Only JPEG, PNG, and PDF files are allowed',
      };
    }

    if (file.size && file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        message: 'File size must be less than 5MB',
      };
    }

    return { valid: true, message: '' };
  },
};
