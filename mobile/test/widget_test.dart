import 'package:flutter_test/flutter_test.dart';

import 'package:pos_mobile/main.dart';

void main() {
  testWidgets('app renders the scaffold placeholder', (WidgetTester tester) async {
    await tester.pumpWidget(const PosApp());

    expect(find.text('POS Platform'), findsOneWidget);
    expect(find.textContaining('Scaffold placeholder'), findsOneWidget);
  });
}
