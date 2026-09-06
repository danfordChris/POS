import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/catalog/providers/catalog_provider.dart';
import 'package:pos_mobile/features/sell/providers/sell_provider.dart';
import 'package:pos_mobile/models/catalog_models.dart';
import 'package:pos_mobile/shared/widgets/error_by_code_card.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';
import 'package:pos_mobile/shared/widgets/neu_stepper.dart';
import 'package:pos_mobile/shared/widgets/neu_text_field.dart';

class SellScreen extends StatefulWidget {
  const SellScreen({super.key});

  @override
  State<SellScreen> createState() => _SellScreenState();
}

class _SellScreenState extends State<SellScreen> {
  final _search = TextEditingController();
  String _query = '';

  String get _bizId => context.read<SessionProvider>().businessId!;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final catalog = context.read<CatalogProvider>();
      if (catalog.products.isEmpty) catalog.load(_bizId);
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _complete() async {
    final sell = context.read<SellProvider>();
    final sale = await sell.submit(_bizId);
    if (!mounted || sale == null) return;
    await context.read<CatalogProvider>().load(_bizId); // refresh on-hand
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Sale #${sale.number} completed')),
    );
    sell.clear();
    // TODO(T-0308): context.go to the receipt screen with `sale`.
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final sell = context.watch<SellProvider>();
    final catalog = context.watch<CatalogProvider>();
    final matches = catalog.products
        .where((p) => p.isActive)
        .where(
          (p) =>
              _query.isEmpty ||
              p.name.toLowerCase().contains(_query) ||
              p.sku.toLowerCase().contains(_query),
        )
        .take(20)
        .toList();

    final err = sell.error;
    final shortStock =
        err != null && '$err'.contains('insufficient_stock') ||
        sell.insufficientProductIds.isNotEmpty;

    return Scaffold(
      appBar: AppBar(title: const Text('Sell')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(DukaSpacing.s5),
                children: [
                  NeuTextField(
                    label: 'Add product',
                    hint: 'Search name or SKU',
                    controller: _search,
                    onChanged: (v) =>
                        setState(() => _query = v.trim().toLowerCase()),
                  ),
                  const SizedBox(height: DukaSpacing.s3),
                  ...matches.map(
                    (p) => _PickRow(
                      product: p,
                      onAdd: () => context.read<SellProvider>().addProduct(p),
                    ),
                  ),
                  const SizedBox(height: DukaSpacing.s5),
                  Text(
                    'Cart',
                    style: TextStyle(
                      color: t.textSecondary,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: DukaSpacing.s2),
                  if (sell.isEmpty)
                    Text(
                      'No lines yet — add a product above.',
                      style: TextStyle(color: t.textSecondary, fontSize: 13),
                    )
                  else
                    ...sell.lines.map(
                      (l) => _CartRow(
                        line: l,
                        short: sell.isShort(l.product.id),
                      ),
                    ),
                  if (err != null) ...[
                    const SizedBox(height: DukaSpacing.s4),
                    ErrorByCodeCard(
                      code: shortStock ? 'insufficient_stock' : 'sale_failed',
                      title: shortStock
                          ? 'Not enough stock for one or more items'
                          : 'Could not complete the sale',
                      body: '$err',
                    ),
                  ],
                ],
              ),
            ),
            _TotalBar(
              subtotal: sell.subtotal,
              discount: sell.discountTotal,
              total: sell.total,
              currency: sell.currency,
              busy: sell.isBusy,
              enabled: !sell.isEmpty && !sell.isBusy,
              onComplete: _complete,
            ),
          ],
        ),
      ),
    );
  }
}

class _PickRow extends StatelessWidget {
  const _PickRow({required this.product, required this.onAdd});
  final Product product;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: DukaSpacing.s1),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.name),
                Text(
                  '${formatMoney(product.sellPrice, product.currency)} · ${product.sku}',
                  style: TextStyle(color: t.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onAdd,
            icon: const Icon(Icons.add_circle_outline),
          ),
        ],
      ),
    );
  }
}

class _CartRow extends StatelessWidget {
  const _CartRow({required this.line, required this.short});
  final CartLine line;
  final bool short;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: DukaSpacing.s1),
      padding: const EdgeInsets.all(DukaSpacing.s2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(DukaRadius.control),
        border: short ? Border.all(color: t.danger) : null,
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  line.product.name,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              NeuStepper(
                value: line.quantity,
                min: 0,
                onChanged: (v) =>
                    context.read<SellProvider>().setQuantity(line.product.id, v),
              ),
              IconButton(
                onPressed: () =>
                    context.read<SellProvider>().remove(line.product.id),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          Row(
            children: [
              SizedBox(
                width: 130,
                child: NeuTextField(
                  label: 'Discount',
                  keyboardType: TextInputType.number,
                  onChanged: (v) => context
                      .read<SellProvider>()
                      .setDiscount(line.product.id, int.tryParse(v.trim()) ?? 0),
                ),
              ),
              const Spacer(),
              Text(
                formatMoney(line.lineTotal, line.product.currency),
                style: TextStyle(
                  color: short ? t.danger : t.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          if (short)
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Not enough in stock',
                style: TextStyle(color: t.danger, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}

class _TotalBar extends StatelessWidget {
  const _TotalBar({
    required this.subtotal,
    required this.discount,
    required this.total,
    required this.currency,
    required this.busy,
    required this.enabled,
    required this.onComplete,
  });

  final int subtotal;
  final int discount;
  final int total;
  final String currency;
  final bool busy;
  final bool enabled;
  final Future<void> Function() onComplete;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    TextStyle label = TextStyle(color: t.textSecondary, fontSize: 12);
    return Container(
      padding: const EdgeInsets.all(DukaSpacing.s5),
      decoration: BoxDecoration(color: t.surface),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Subtotal', style: label),
              Text(formatMoney(subtotal, currency), style: label),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Discount', style: label),
              Text('-${formatMoney(discount, currency)}', style: label),
            ],
          ),
          const SizedBox(height: DukaSpacing.s1),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Total',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
              ),
              Text(
                formatMoney(total, currency),
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: DukaSpacing.s3),
          NeuButton(
            label: busy ? 'Completing…' : 'Complete sale',
            variant: NeuButtonVariant.primary,
            expand: true,
            onPressed: enabled ? onComplete : null,
          ),
        ],
      ),
    );
  }
}
