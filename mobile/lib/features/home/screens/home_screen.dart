import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/router/router.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/features/catalog/providers/catalog_provider.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final bizId = context.read<SessionProvider>().businessId;
      if (bizId != null) context.read<CatalogProvider>().load(bizId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final session = context.read<SessionProvider>();
    final firstName = (session.user?.name ?? '').split(' ').first;

    final catalog = context.watch<CatalogProvider>();
    final lowCount = catalog.products
        .where((p) => catalog.stockFor(p.id)?.lowStock ?? false)
        .length;

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
        Row(
          children: [
            Expanded(
              child: _Kpi(
                label: 'Products',
                value: '${catalog.products.length}',
              ),
            ),
            const SizedBox(width: DukaSpacing.s3),
            Expanded(
              child: _Kpi(label: 'Low on stock', value: '$lowCount'),
            ),
          ],
        ),
        const SizedBox(height: DukaSpacing.s5),
        NeuButton(
          label: 'Browse catalog',
          icon: Icons.inventory_2_outlined,
          expand: true,
          onPressed: () => context.go(AppRoute.catalog.path),
        ),
        const SizedBox(height: DukaSpacing.s3),
        NeuButton(
          label: 'Record stock movement',
          icon: Icons.add_box_outlined,
          expand: true,
          onPressed: () => context.push(AppRoute.recordMovement.path),
        ),
        const SizedBox(height: DukaSpacing.s4),
        Text(
          "Today's sales and receipts arrive with Phase 04.",
          style: TextStyle(color: t.textSecondary, fontSize: 14),
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
      padding: const EdgeInsets.all(DukaSpacing.s4),
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
