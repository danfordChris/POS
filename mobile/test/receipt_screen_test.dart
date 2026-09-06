import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'package:pos_mobile/core/network/api_client.dart' show kApiBaseUrl;
import 'package:pos_mobile/core/receipt_url.dart';
import 'package:pos_mobile/features/sell/screens/receipt_screen.dart';
import 'package:pos_mobile/models/sale_models.dart';

Sale _sale() => Sale(
  id: 's1',
  number: 7,
  status: 'completed',
  subtotal: 7000,
  discountTotal: 500,
  total: 6500,
  currency: 'TZS',
  createdAt: DateTime(2026, 9, 7, 10, 30),
  lines: const [
    SaleLine(
      productId: 'p1',
      name: 'Sukari 1kg',
      unitPrice: 3500,
      quantity: 2,
      discount: 500,
      lineTotal: 6500,
    ),
  ],
  receipt: const Receipt(publicToken: 'tok-abc', status: 'issued'),
);

void main() {
  test('receiptUrl builds the public link from the API base', () {
    expect(receiptUrl('tok-abc'), '$kApiBaseUrl/v1/r/tok-abc');
  });

  testWidgets('receipt screen renders totals, QR, and the actions', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: ReceiptScreen(args: ReceiptArgs(sale: _sale()))),
    );
    await tester.pumpAndSettle();

    expect(find.text('TZS 6500'), findsWidgets); // big total + row
    expect(find.text('Sukari 1kg  ×2'), findsOneWidget);
    expect(find.byType(QrImageView), findsOneWidget);
    expect(find.text('$kApiBaseUrl/v1/r/tok-abc'), findsOneWidget);
    expect(find.text('Share link'), findsOneWidget);
    expect(find.text('New sale'), findsOneWidget);
  });
}
