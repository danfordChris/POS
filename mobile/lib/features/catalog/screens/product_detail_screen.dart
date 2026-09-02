import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/router/router.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/catalog/providers/catalog_provider.dart';
import 'package:pos_mobile/features/stock/screens/record_movement_screen.dart';
import 'package:pos_mobile/models/catalog_models.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({super.key, required this.product});

  final Product product;

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  String get _bizId => context.read<SessionProvider>().businessId!;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CatalogProvider>().refreshOne(_bizId, widget.product.id);
    });
  }

  Product get _product =>
      context.watch<CatalogProvider>().productById(widget.product.id) ??
      widget.product;

  void _openMovement(String type) {
    final p = _product;
    context.push(
      AppRoute.recordMovement.path,
      extra: RecordMovementArgs(
        productId: p.id,
        productName: p.name,
        type: type,
      ),
    );
  }

  Future<void> _deactivate() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Deactivate product?'),
        content: const Text('It stays in reports and history.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Deactivate'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final ok = await context.read<CatalogProvider>().deactivate(
      _bizId,
      _product.id,
    );
    if (mounted && ok) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Product deactivated')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final p = _product;
    final isOwner = context.read<SessionProvider>().isOwner;
    final stock = context.watch<CatalogProvider>().stockFor(p.id);

    return Scaffold(
      appBar: AppBar(
        title: Text(p.name, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            onPressed: () => context.push(AppRoute.productEdit.path, extra: p),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(DukaSpacing.s5),
          children: [
            NeuBox(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Kv('On hand', stock == null ? '—' : '${stock.onHand}'),
                  _Kv('SKU', p.sku),
                  _Kv('Unit', p.unit),
                  _Kv('Barcode / QR', p.code ?? '—'),
                  _Kv('Reorder at', '${p.reorderThreshold}'),
                  _Kv('Status', p.isActive ? 'Active' : 'Inactive'),
                ],
              ),
            ),
            const SizedBox(height: DukaSpacing.s4),
            NeuBox(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Kv('Sell price', formatMoney(p.sellPrice, p.currency)),
                  if (p.wingerPrice != null)
                    _Kv(
                      'Winger price',
                      formatMoney(p.wingerPrice!, p.currency),
                    ),
                  if (isOwner && p.costPrice != null)
                    _Kv('Cost price', formatMoney(p.costPrice!, p.currency)),
                  if (!isOwner)
                    Text(
                      'Cost price is Owner-only.',
                      style: TextStyle(color: t.textDisabled, fontSize: 13),
                    ),
                ],
              ),
            ),
            const SizedBox(height: DukaSpacing.s5),
            Row(
              children: [
                Expanded(
                  child: NeuButton(
                    label: 'Stock in',
                    icon: Icons.add_box_outlined,
                    onPressed: () => _openMovement('stock_in'),
                  ),
                ),
                const SizedBox(width: DukaSpacing.s3),
                Expanded(
                  child: NeuButton(
                    label: 'Adjust',
                    icon: Icons.tune,
                    onPressed: () => _openMovement('adjustment'),
                  ),
                ),
              ],
            ),
            if (p.isActive) ...[
              const SizedBox(height: DukaSpacing.s4),
              NeuButton(
                label: 'Deactivate product',
                variant: NeuButtonVariant.destructive,
                expand: true,
                onPressed: _deactivate,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Kv extends StatelessWidget {
  const _Kv(this.k, this.v);
  final String k;
  final String v;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              k,
              style: TextStyle(color: t.textSecondary, fontSize: 14),
            ),
          ),
          Expanded(
            child: Text(
              v,
              style: TextStyle(
                color: t.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
