import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/storage/secure_storage.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    apiClient: ref.watch(apiClientProvider),
    secureStorage: ref.watch(secureStorageProvider),
  );
});

class AuthRepository {
  final ApiClient apiClient;
  final SecureStorageService secureStorage;

  AuthRepository({required this.apiClient, required this.secureStorage});

  /// Login and send OTP. Returns the phone number (with country code) on success.
  /// Throws an exception on failure.
  Future<Map<String, dynamic>> login(String phoneNumber) async {
    final response = await apiClient.post(
      '/auth/login',
      data: {'phone_number': phoneNumber},
    );
    // Response: {"message": "OTP sent...", "phone_number": "91xxxxxxxxxx"}
    return response.data;
  }

  Future<Map<String, dynamic>> register({
    required String phoneNumber,
    required String firstName,
    required String lastName,
    required String city,
    required String pincode,
  }) async {
    final response = await apiClient.post('/auth/register', data: {
      'phone_number': phoneNumber,
      'first_name': firstName,
      'last_name': lastName,
      'city': city,
      'pincode': pincode,
    });
    return response.data;
  }

  /// Verify OTP and authenticate user.
  /// Backend returns user object directly and sets httpOnly cookie with token.
  /// We extract token from Set-Cookie header.
  Future<Map<String, dynamic>> verifyOtp(String phoneNumber, String otp) async {
    final response = await apiClient.post('/auth/verify-otp', data: {
      'phone_number': phoneNumber,
      'otp': otp,
    });

    // Backend sets cookie: access_token=Bearer {token}
    // Try to extract token from Set-Cookie header
    final setCookie = response.headers['set-cookie'];
    if (setCookie != null && setCookie.isNotEmpty) {
      for (final cookie in setCookie) {
        if (cookie.contains('access_token=')) {
          // Extract: access_token=Bearer {token}; ...
          final match = RegExp(r'access_token=Bearer%20([^;]+)').firstMatch(cookie) ??
                        RegExp(r'access_token=Bearer\s+([^;]+)').firstMatch(cookie);
          if (match != null) {
            await secureStorage.saveToken(match.group(1)!);
          }
        }
      }
    }

    // Response is the user object directly (not wrapped)
    // Store user data
    await secureStorage.saveUserData(jsonEncode(response.data));

    return response.data;
  }

  Future<Map<String, dynamic>> resendOtp(String phoneNumber) async {
    final response = await apiClient.post('/auth/resend-otp', data: {
      'phone_number': phoneNumber,
    });
    return response.data;
  }

  Future<void> logout() async {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      await secureStorage.clearAll();
    }
  }

  Future<bool> isAuthenticated() async {
    final token = await secureStorage.getToken();
    return token != null;
  }

  Future<Map<String, dynamic>?> getCurrentUser() async {
    final userData = await secureStorage.getUserData();
    if (userData != null) {
      return jsonDecode(userData);
    }
    return null;
  }
}
