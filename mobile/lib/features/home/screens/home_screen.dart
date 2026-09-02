import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/router/router.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/catalog/providers/catalog_provider.dart';
import 'package:pos_mobile/models/catalog_models.dart';
import 'package:pos_mobile/shared/widgets/neu_badge.dart';

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
    final products = catalog.products;
    final lowProducts = products
        .where((p) => catalog.stockFor(p.id)?.lowStock ?? false)
        .toList();

    var stockValue = 0;
    var currency = 'TZS';
    for (final p in products) {
      final onHand = catalog.stockFor(p.id)?.onHand ?? 0;
      stockValue += onHand * p.sellPrice;
      currency = p.currency;
    }

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

        // ── Hero metric ─────────────────────────────────────────────────────
        NeuBox(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Stock value at retail',
                style: TextStyle(color: t.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 2),
              Text(
                formatMoney(stockValue, currency),
                style: TextStyle(
                  color: t.textPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: 30,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: DukaSpacing.s4),
              const Divider(height: 1),
              const SizedBox(height: DukaSpacing.s3),
              Row(
                children: [
                  Expanded(
                    child: _SubStat(
                      label: 'Products',
                      value: '${products.length}',
                    ),
                  ),
                  Expanded(
                    child: _SubStat(
                      label: 'Low on stock',
                      value: '${lowProducts.length}',
                      tone: lowProducts.isEmpty ? null : NeuBadgeTone.warning,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: DukaSpacing.s4),

        // ── Quick actions ───────────────────────────────────────────────────
        Row(
          children: [
            Expanded(
              child: _QuickTile(
                icon: Icons.add,
                label: 'New product',
                onTap: () => context.push(AppRoute.productNew.path),
              ),
            ),
            const SizedBox(width: DukaSpacing.s3),
            Expanded(
              child: _QuickTile(
                icon: Icons.add_box_outlined,
                label: 'Record stock',
                onTap: () => context.push(AppRoute.recordMovement.path),
              ),
            ),
            const SizedBox(width: DukaSpacing.s3),
            Expanded(
              child: _QuickTile(
                icon: Icons.qr_code_scanner,
                label: 'Scan',
                onTap: () => context.go(AppRoute.scan.path),
              ),
            ),
          ],
        ),
        const SizedBox(height: DukaSpacing.s5),

        // ── Requires attention ──────────────────────────────────────────────
        if (lowProducts.isNotEmpty) ...[
          Row(
            children: [
              Expanded(
                child: Text(
                  'Requires attention',
                  style: TextStyle(
                    color: t.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 18,
                  ),
                ),
              ),
              TextButton(
                onPressed: () => context.go(AppRoute.catalog.path),
                child: const Text('View all'),
              ),
            ],
          ),
          const SizedBox(height: DukaSpacing.s2),
          ...lowProducts
              .take(3)
              .map(
                (p) => Padding(
                  padding: const EdgeInsets.only(bottom: DukaSpacing.s3),
                  child: _AttentionRow(
                    product: p,
                    onHand: catalog.stockFor(p.id)?.onHand ?? 0,
                    onTap: () =>
                        context.push(AppRoute.productDetail.path, extra: p),
                  ),
                ),
              ),
        ] else
          Text(
            "Today's sales and receipts arrive with Phase 04.",
            style: TextStyle(color: t.textSecondary, fontSize: 14),
          ),
      ],
    );
  }
}

class _SubStat extends StatelessWidget {
  const _SubStat({required this.label, required this.value, this.tone});
  final String label;
  final String value;
  final NeuBadgeTone? tone;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: t.textSecondary, fontSize: 12)),
        const SizedBox(height: 2),
        Row(
          children: [
            Text(
              value,
              style: TextStyle(
                color: t.textPrimary,
                fontWeight: FontWeight.w800,
                fontSize: 20,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            if (tone != null) ...[
              const SizedBox(width: 6),
              NeuBadge('!', tone: tone!),
            ],
          ],
        ),
      ],
    );
  }
}

class _QuickTile extends StatelessWidget {
  const _QuickTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return NeuBox(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        horizontal: DukaSpacing.s2,
        vertical: DukaSpacing.s4,
      ),
      child: Column(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: t.accent.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(DukaRadius.control),
            ),
            child: Icon(icon, color: t.accent, size: 20),
          ),
          const SizedBox(height: DukaSpacing.s2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: t.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _AttentionRow extends StatelessWidget {
  const _AttentionRow({
    required this.product,
    required this.onHand,
    required this.onTap,
  });
  final Product product;
  final int onHand;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return NeuBox(
      onTap: onTap,
      padding: const EdgeInsets.all(DukaSpacing.s4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              product.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: t.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
            ),
          ),
          Text(
            '$onHand left',
            style: TextStyle(color: t.textSecondary, fontSize: 13),
          ),
          const SizedBox(width: 8),
          const NeuBadge('low', tone: NeuBadgeTone.warning),
        ],
      ),
    );
  }
}
