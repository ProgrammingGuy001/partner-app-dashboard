import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { authApi } from '../api/authApi';
import { STORAGE_KEYS } from '../util/constants';
import * as SecureStore from '../util/secureStore';

const USER_PROFILE_KEY = 'cached-user-profile';

export const useAuthStore = create((set) => ({
  user: null,
  phoneNumber: null,
  isAuthenticated: false,
  isAuthResolved: false,

  /** Restore cached user from AsyncStorage — called once at startup */
  hydrateUser: async () => {
    try {
      const cached = await AsyncStorage.getItem(USER_PROFILE_KEY);
      if (cached) {
        const user = JSON.parse(cached);
        set({ user, isAuthenticated: true, isAuthResolved: true });
        return user;
      }
    } catch {
      // corrupt cache — ignore
    }
    return null;
  },

  setUser: (user) => {
    // Persist to AsyncStorage in the background (fire-and-forget)
    AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user)).catch(() => {});
    set({
      user,
      isAuthenticated: true,
      isAuthResolved: true,
    });
  },

  setPhoneNumber: (phoneNumber) => set({ phoneNumber }),

  setAuthResolved: (isAuthResolved) => set({ isAuthResolved }),

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    await AsyncStorage.removeItem(USER_PROFILE_KEY);
    set({
      user: null,
      phoneNumber: null,
      isAuthenticated: false,
      isAuthResolved: true,
    });
  },

  /** Re-fetch the user profile from the server */
  refreshProfile: async () => {
    try {
      const data = await authApi.me();
      const user = data.user || data;
      AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user)).catch(() => {});
      set({ user, isAuthenticated: true, isAuthResolved: true });
      return user;
    } catch {
      return null;
    }
  },
}));
