import React, { useEffect } from 'react';
import { Platform, View, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@react-native-vector-icons/ionicons';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { authApi } from '../api/authApi';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import JobDetailScreen from '../screens/dashboard/JobDetailScreen';
import VerificationScreen from '../screens/verification/VerificationScreen';
import PendingApprovalScreen from '../screens/verification/PendingApprovalScreen';
import ChecklistScreen from '../screens/checklist/ChecklistScreen';
import SiteRequisiteScreen from '../screens/requisite/SiteRequisiteScreen';
import BucketScreen from '../screens/requisite/BucketScreen';
import SubmitScreen from '../screens/requisite/SubmitScreen';
import HistoryScreen from '../screens/requisite/HistoryScreen';
import AccountScreen from '../screens/account/AccountScreen';
import SplashScreen from '../screens/SplashScreen';
import NotFoundScreen from '../screens/NotFoundScreen';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';
import { ROUTES, STORAGE_KEYS } from '../util/constants';
import { logger } from '../util/helpers';
import * as SecureStore from '../util/secureStore';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab configuration: icon names (inactive / active), label
const TAB_CONFIG = {
  [ROUTES.DASHBOARD]: { inactive: 'home-outline', active: 'home', label: 'Dashboard' },
  [ROUTES.SITE_REQUISITE]: { inactive: 'construct-outline', active: 'construct', label: 'Requisites' },
  [ROUTES.HISTORY]: { inactive: 'time-outline', active: 'time', label: 'History' },
  [ROUTES.ACCOUNT]: { inactive: 'person-circle-outline', active: 'person-circle', label: 'Account' },
};

const MainTabs = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginTop: -4,
          marginBottom: 8,
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          left: 16,
          right: 16,
          backgroundColor: colors.surface,
          borderRadius: 24,
          height: 72,
          paddingTop: 12,
          paddingBottom: 8,
          borderTopWidth: 0,
          ...colors.shadowMd,
          elevation: 8,
          borderWidth: 1,
          borderColor: colors.border,
        },
        tabBarIcon: ({ color, focused }) => {
          const cfg = TAB_CONFIG[route.name];
          const iconName = focused ? cfg?.active : cfg?.inactive;

          return (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              height: 40,
              width: 40,
            }}>
              {focused && (
                <View style={{
                  position: 'absolute',
                  top: -8,
                  width: 16,
                  height: 3,
                  backgroundColor: colors.primary,
                  borderRadius: 2,
                }} />
              )}
              <Ionicons
                name={iconName || 'ellipse-outline'}
                size={24}
                color={color}
              />
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name={ROUTES.DASHBOARD}
        component={DashboardScreen}
        options={{ title: TAB_CONFIG[ROUTES.DASHBOARD].label }}
      />
      <Tab.Screen
        name={ROUTES.SITE_REQUISITE}
        component={SiteRequisiteScreen}
        options={{ title: TAB_CONFIG[ROUTES.SITE_REQUISITE].label }}
      />
      <Tab.Screen
        name={ROUTES.HISTORY}
        component={HistoryScreen}
        options={{ title: TAB_CONFIG[ROUTES.HISTORY].label }}
      />
      <Tab.Screen
        name={ROUTES.ACCOUNT}
        component={AccountScreen}
        options={{ title: TAB_CONFIG[ROUTES.ACCOUNT].label }}
      />
    </Tab.Navigator>
  );
};

const isUserFullyVerified = (user) => {
  if (!user) return false;
  return (
    user.is_verified === true &&
    user.is_pan_verified === true &&
    user.is_bank_details_verified === true &&
    user.is_id_verified === true
  );
};

const isUserSelfVerified = (user) => {
  if (!user) return false;
  // User has completed all self-verification steps (phone, PAN, bank)
  return (
    user.is_verified === true &&
    user.is_pan_verified === true &&
    user.is_bank_details_verified === true
  );
};

const AppNavigator = () => {
  const { user, isAuthenticated, isAuthResolved, setUser, clearAuth, setAuthResolved } = useAuthStore();
  const { colors } = useTheme();

  useEffect(() => {
    let mounted = true;
    let timeoutId;

    const hydrateSession = async () => {
      logger.info('AppNavigator', 'Starting session hydration');
      try {
        // Safety timeout: if nothing happens in 15 seconds, force resolve
        timeoutId = setTimeout(() => {
          if (mounted) {
            logger.warn('AppNavigator', '⏰ Session hydration timeout - forcing resolution');
            useAuthStore.getState().setAuthResolved(true);
          }
        }, 15000);

        logger.info('AppNavigator', 'Checking for auth token');
        const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
        logger.info('AppNavigator', `Token check: ${token ? 'EXISTS' : 'NONE'}`);

        if (!mounted) return; // Component unmounted

        // No token at all — go straight to login
        if (!token) {
          logger.info('AppNavigator', 'No token - resolving to login');
          useAuthStore.getState().setAuthResolved(true);
          clearTimeout(timeoutId);
          return;
        }

        // Phase 1: Instant restore from cache (no network needed)
        logger.info('AppNavigator', 'Checking for cached user');
        const { hydrateUser } = useAuthStore.getState();
        const cachedUser = await hydrateUser();
        logger.info('AppNavigator', `Cache check: ${cachedUser ? 'FOUND' : 'NONE'}`);

        if (!mounted) return; // Component unmounted

        if (cachedUser) {
          // User is already visible — verify in the background silently
          logger.info('AppNavigator', 'Cached user found - resolving immediately');
          useAuthStore.getState().setAuthResolved(true); // CRITICAL: Must resolve BEFORE early return
          clearTimeout(timeoutId);

          authApi.me()
            .then((freshProfile) => {
              if (mounted) {
                logger.info('AppNavigator', 'Background profile refresh succeeded');
                useAuthStore.getState().setUser(freshProfile);
              }
            })
            .catch(async (error) => {
              if (mounted && error?.status === 401) {
                logger.warn('AppNavigator', 'Background refresh failed: 401 - clearing auth');
                await useAuthStore.getState().clearAuth();
              }
            });
          return; // UI is already showing — no need to block
        }

        // Phase 2: No cache (first login) — must wait for network
        logger.info('AppNavigator', 'No cache - fetching profile from network');
        try {
          const profilePromise = authApi.me();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Session check timed out')), 10000)
          );
          const profile = await Promise.race([profilePromise, timeoutPromise]);

          if (mounted) {
            logger.info('AppNavigator', 'Profile fetch succeeded');
            useAuthStore.getState().setUser(profile);
          }
        } catch (error) {
          logger.warn('AppNavigator', `Session hydration failed: ${error?.message}`);
          if (mounted) {
            if (error?.status === 401) {
              await useAuthStore.getState().clearAuth();
            } else {
              // Network timeout or server error - still resolve to prevent infinite splash
              logger.warn('AppNavigator', 'Network error during session check, clearing auth');
              await useAuthStore.getState().clearAuth();
            }
          }
        }

        if (mounted) {
          logger.info('AppNavigator', 'Session hydration complete');
          useAuthStore.getState().setAuthResolved(true);
          clearTimeout(timeoutId);
        }
      } catch (err) {
        // Catch any unexpected errors (SecureStore failures, etc.)
        logger.warn('AppNavigator', `Unexpected error in session hydration: ${err?.message}`);
        if (mounted) {
          useAuthStore.getState().setAuthResolved(true);
          clearTimeout(timeoutId);
        }
      }
    };

    hydrateSession();

    // Cleanup function
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []); // Empty dependency array - only run once on mount

  const fullyVerified = isUserFullyVerified(user);
  const selfVerified = isUserSelfVerified(user);

  // Shared stack header options
  const stackScreenOptions = {
    headerStyle: {
      backgroundColor: colors.surface,
    },
    headerTitleStyle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    headerTintColor: colors.primary,
    headerBackTitle: '',
    headerShadowVisible: true,
    contentStyle: {
      backgroundColor: colors.background,
    },
  };

  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {!isAuthResolved ? (
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false, animation: 'none' }} />
      ) : !isAuthenticated ? (
        <>
          <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name={ROUTES.REGISTER} component={RegisterScreen} options={{ headerShown: false }} />
          <Stack.Screen name={ROUTES.OTP} component={OTPScreen} options={{ headerShown: false }} />
        </>
      ) : fullyVerified ? (
        <>
          <Stack.Screen name={ROUTES.MAIN_TABS} component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name={ROUTES.JOB_DETAIL} component={JobDetailScreen} options={{ title: 'Job Detail' }} />
          <Stack.Screen name={ROUTES.CHECKLIST} component={ChecklistScreen} options={{ title: 'Checklist' }} />
          <Stack.Screen name={ROUTES.BUCKET} component={BucketScreen} options={{ title: 'My Bucket' }} />
          <Stack.Screen name={ROUTES.SUBMIT} component={SubmitScreen} options={{ title: 'Submit Requisite' }} />
          <Stack.Screen name={ROUTES.NOT_FOUND} component={NotFoundScreen} options={{ headerShown: false }} />
        </>
      ) : selfVerified ? (
        <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name={ROUTES.VERIFICATION} component={VerificationScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
};

const AppNavigatorWithErrorBoundary = () => (
  <ErrorBoundary>
    <AppNavigator />
  </ErrorBoundary>
);

export default AppNavigatorWithErrorBoundary;
