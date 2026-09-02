import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final session = context.read<SessionProvider>();
    final firstName = (session.user?.name ?? '').split(' ').first;

    return ListView(
      padding: const EdgeInsets.all(DukaSpacing.s5),
      children: [
        Text(
          firstName.isEmpty ? 'Home' : 'Habari, $firstName',
          style: TextStyle(
            color: t.textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 28,
          ),
        ),
        const SizedBox(height: DukaSpacing.s4),
        const Row(
          children: [
            Expanded(
              child: _Kpi(label: "Today's sales", value: '—'),
            ),
            SizedBox(width: DukaSpacing.s3),
            Expanded(
              child: _Kpi(label: 'Low on stock', value: '—'),
            ),
          ],
        ),
        const SizedBox(height: DukaSpacing.s4),
        NeuBox(
          child: Text(
            'Live figures arrive with the Catalog and Sell screens '
            '(T-0106–T-0108). Your session, nav, and roles are ready now.',
            style: TextStyle(color: t.textSecondary, fontSize: 16),
          ),
        ),
      ],
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return NeuBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: t.textSecondary, fontSize: 13)),
          const SizedBox(height: DukaSpacing.s1),
          Text(
            value,
            style: TextStyle(
              color: t.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 28,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
