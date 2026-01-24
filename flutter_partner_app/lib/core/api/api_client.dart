import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/secure_storage.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  final secureStorage = ref.watch(secureStorageProvider);
  return ApiClient(secureStorage: secureStorage);
});

class ApiClient {
  static const String baseUrl = "http://10.0.2.2:8000/api/v1";

  late final Dio _dio;
  final SecureStorageService secureStorage;

  ApiClient({required this.secureStorage}) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
      },
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        // Add auth token if available
        final token = await secureStorage.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Clear token and let the app handle redirect
          await secureStorage.clearToken();
        }

        // Extract error message from response
        String errorMessage = 'An error occurred';
        if (error.response?.data != null) {
          final data = error.response!.data;
          if (data is Map) {
            errorMessage = data['detail'] ?? data['message'] ?? errorMessage;
          }
        } else if (error.message != null) {
          errorMessage = error.message!;
        }

        // Reject with a clear error message
        return handler.reject(DioException(
          requestOptions: error.requestOptions,
          error: errorMessage,
          response: error.response,
          type: error.type,
        ));
      },
    ));
  }

  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) {
    return _dio.get(path, queryParameters: queryParameters);
  }

  Future<Response> post(String path, {dynamic data}) {
    return _dio.post(path, data: data);
  }

  Future<Response> postMultipart(String path, FormData formData) {
    return _dio.post(
      path,
      data: formData,
      options: Options(headers: {'Content-Type': 'multipart/form-data'}),
    );
  }

  Future<Response> put(String path, {dynamic data}) {
    return _dio.put(path, data: data);
  }

  Future<Response> patch(String path, {dynamic data}) {
    return _dio.patch(path, data: data);
  }

  Future<Response> delete(String path) {
    return _dio.delete(path);
  }
}

