import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/network/api_exception.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/winger/providers/winger_provider.dart';
import 'package:pos_mobile/models/catalog_models.dart' show formatMoney;
import 'package:pos_mobile/models/winger_models.dart';
import 'package:pos_mobile/shared/widgets/error_by_code_card.dart';
import 'package:pos_mobile/shared/widgets/neu_badge.dart';
import 'package:pos_mobile/shared/widgets/neu_empty_state.dart';

/// The winger's entire app: a business switcher + a read-only catalog. No other
/// route is registered for a winger session (see `createRouter`).
class WingerCatalogScreen extends StatefulWidget {
  const WingerCatalogScreen({super.key});

  @override
  State<WingerCatalogScreen> createState() => _WingerCatalogScreenState();
}

class _WingerCatalogScreenState extends State<WingerCatalogScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WingerProvider>().load();
    });
  }

  String _code(Object? e) => e is ApiException ? e.code : 'load_failed';

  Future<void> _pickBusiness() async {
    final winger = context.read<WingerProvider>();
    final picked = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final b in winger.businesses)
              ListTile(
                title: Text(b.businessName),
                trailing: b.businessId == winger.selectedBusinessId
                    ? const Icon(Icons.check)
                    : null,
                onTap: () => Navigator.pop(context, b.businessId),
              ),
          ],
        ),
      ),
    );
    if (picked != null) await winger.selectBusiness(picked);
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final winger = context.watch<WingerProvider>();
    final products = winger.products;

    return Scaffold(
      appBar: AppBar(
        title: GestureDetector(
          onTap: winger.businesses.length > 1 ? _pickBusiness : null,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  winger.selectedBusiness?.businessName ?? 'Catalog',
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (winger.businesses.length > 1)
                const Icon(Icons.arrow_drop_down),
            ],
          ),
        ),
        actions: [
          IconButton(
            onPressed: () => context.read<SessionProvider>().signOut(),
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => context.read<WingerProvider>().refresh(),
          child: ListView(
            padding: const EdgeInsets.all(DukaSpacing.s5),
            children: [
              if (winger.error != null && products.isEmpty)
                ErrorByCodeCard(
                  code: _code(winger.error),
                  title: 'Could not load the catalog',
                  body: '${winger.error}',
                  action: ErrorAction(
                    'Retry',
                    () => context.read<WingerProvider>().load(),
                  ),
                )
              else if (winger.isBusy && products.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(DukaSpacing.s6),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (products.isEmpty)
                const NeuEmptyState(
                  icon: Icons.inventory_2_outlined,
                  title: 'Nothing to show yet',
                  message: 'This catalog has no products in stock right now.',
                )
              else ...[
                for (final p in products)
                  Padding(
                    padding: const EdgeInsets.only(bottom: DukaSpacing.s3),
                    child: _WingerProductRow(product: p),
                  ),
                if (winger.hasMore)
                  Center(
                    child: TextButton(
                      onPressed: winger.isBusy
                          ? null
                          : () => context.read<WingerProvider>().loadMore(),
                      child: Text(
                        winger.isBusy ? 'Loading…' : 'Load more',
                        style: TextStyle(color: t.accent),
                      ),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _WingerProductRow extends StatelessWidget {
  const _WingerProductRow({required this.product});

  final WingerProduct product;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return NeuBox(
      padding: const EdgeInsets.all(DukaSpacing.s3),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(DukaRadius.card),
            child: SizedBox(
              width: 52,
              height: 52,
              child: product.imageUrl != null && product.imageUrl!.isNotEmpty
                  ? Image.network(
                      product.imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => _placeholder(t),
                    )
                  : _placeholder(t),
            ),
          ),
          const SizedBox(width: DukaSpacing.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: TextStyle(
                    color: t.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  formatMoney(product.price, product.currency),
                  style: TextStyle(color: t.textSecondary),
                ),
              ],
            ),
          ),
          NeuBadge(
            product.inStock ? 'In stock' : 'Out of stock',
            tone: product.inStock ? NeuBadgeTone.success : NeuBadgeTone.neutral,
          ),
        ],
      ),
    );
  }

  Widget _placeholder(DukaColors t) => Container(
    color: t.surfaceSunken,
    child: Icon(Icons.image_outlined, color: t.textDisabled, size: 22),
  );
}
