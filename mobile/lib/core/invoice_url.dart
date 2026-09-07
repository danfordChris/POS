import 'package:pos_mobile/core/network/api_client.dart' show kApiBaseUrl;

/// The public, shareable invoice link for an invoice's `public_token`.
String invoiceUrl(String publicToken) => '$kApiBaseUrl/v1/i/$publicToken';

/// The public invoice PDF link. The media service serves a `302` to the stored
/// document once rendered, or `202` while that is still in flight.
String invoicePdfUrl(String publicToken) =>
    '$kApiBaseUrl/v1/i/$publicToken/pdf';
