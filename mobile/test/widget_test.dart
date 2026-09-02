import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:pos_mobile/main.dart';
import 'package:pos_mobile/theme/duka_colors.dart';
import 'package:pos_mobile/theme/duka_theme.dart';
import 'package:pos_mobile/theme/neu.dart';
import 'package:pos_mobile/widgets/neu_button.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    // No stored tokens -> the app should boot to the sign-in screen.
    FlutterSecureStorage.setMockInitialValues({});
  });

  testWidgets('unauthenticated boot lands on the sign-in screen', (
    tester,
  ) async {
    await tester.pumpWidget(const PosApp());
    await tester.pumpAndSettle();

    expect(find.text('Sign in to your account.'), findsOneWidget);
    expect(find.byType(NeuButton), findsWidgets);
    expect(find.widgetWithText(NeuButton, 'Sign in'), findsOneWidget);
  });

  testWidgets('login screen shows email + password fields, no bottom nav', (
    tester,
  ) async {
    await tester.pumpWidget(const PosApp());
    await tester.pumpAndSettle();

    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.byType(NeuWell), findsWidgets); // inset input wells
    expect(find.text('Home'), findsNothing); // shell not mounted yet
  });

  test('both theme brightnesses build with the DukaColors extension', () {
    for (final b in Brightness.values) {
      final theme = buildDukaTheme(b);
      expect(theme.extension<DukaColors>(), isNotNull);
      expect(theme.scaffoldBackgroundColor, isNotNull);
    }
  });
}
