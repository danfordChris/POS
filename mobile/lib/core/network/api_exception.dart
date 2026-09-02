/// Typed error carrying the platform's `{ error: { code, message, devMessage } }`
/// envelope. `message` is safe to show; `devMessage` is for logs.
class ApiException implements Exception {
  ApiException({
    required this.code,
    required this.message,
    this.devMessage,
    this.status = 0,
    this.details = const [],
  });

  final String code;
  final String message;
  final String? devMessage;
  final int status;
  final List<Map<String, dynamic>> details;

  factory ApiException.network([Object? cause]) => ApiException(
    code: 'network_error',
    message: 'Could not reach the server. Check your connection and retry.',
    devMessage: cause?.toString(),
  );

  @override
  String toString() => 'ApiException($code, $status): $message';
}
