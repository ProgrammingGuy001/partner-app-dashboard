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

  Future<Map<String, dynamic>> login(String phoneNumber) async {
    final response = await apiClient.post('/auth/login', data: {
      'phone_number': phoneNumber,
    });
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

  Future<Map<String, dynamic>> verifyOtp(String phoneNumber, String otp) async {
    final response = await apiClient.post('/auth/verify-otp', data: {
      'phone_number': phoneNumber,
      'otp': otp,
    });
    
    // Store token if present
    if (response.data['access_token'] != null) {
      await secureStorage.saveToken(response.data['access_token']);
    }
    
    // Store user data
    if (response.data['user'] != null) {
      await secureStorage.saveUserData(jsonEncode(response.data['user']));
    }
    
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
