import 'package:pos_mobile/core/network/api_client.dart' show kApiBaseUrl;

/// The public, shareable receipt link for a sale's `public_token`. Single source
/// of truth — no `/v1/r/...` string is built anywhere else.
String receiptUrl(String publicToken) => '$kApiBaseUrl/v1/r/$publicToken';
