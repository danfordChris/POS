import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:pos_mobile/main.dart';
import 'package:pos_mobile/theme/duka_colors.dart';
import 'package:pos_mobile/theme/duka_theme.dart';
import 'package:pos_mobile/theme/neu.dart';
import 'package:pos_mobile/widgets/neu_button.dart';
import 'package:pos_mobile/widgets/neu_toggle.dart';

void main() {
  testWidgets('gallery renders the neumorphic kit', (tester) async {
    await tester.pumpWidget(const PosApp());

    expect(find.text('Neumorphic design system'), findsOneWidget);
    expect(find.byType(NeuButton), findsWidgets);
    expect(find.text('Record sale'), findsOneWidget);

    // Surfaces / error card live below the fold in the ListView.
    await tester.dragUntilVisible(
      find.text('Sunken well — inset'),
      find.byType(Scrollable).first,
      const Offset(0, -300),
    );
    expect(find.byType(NeuBox), findsWidgets);
    expect(find.byType(NeuWell), findsWidgets);
  });

  testWidgets('toggle flips on tap', (tester) async {
    await tester.pumpWidget(const PosApp());

    final toggle = find.byType(NeuToggle).first;
    final before = tester.widget<NeuToggle>(toggle).value;
    await tester.tap(toggle);
    await tester.pump(const Duration(milliseconds: 200));
    final after = tester.widget<NeuToggle>(find.byType(NeuToggle).first).value;
    expect(after, isNot(before));
  });

  test('both theme brightnesses build with the DukaColors extension', () {
    for (final b in Brightness.values) {
      final theme = buildDukaTheme(b);
      expect(theme.extension<DukaColors>(), isNotNull);
      expect(theme.scaffoldBackgroundColor, isNotNull);
    }
  });
}
