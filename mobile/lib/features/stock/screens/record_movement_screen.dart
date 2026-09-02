import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/catalog/providers/catalog_provider.dart';
import 'package:pos_mobile/features/stock/providers/stock_provider.dart';
import 'package:pos_mobile/models/catalog_models.dart';
import 'package:pos_mobile/shared/widgets/error_by_code_card.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';
import 'package:pos_mobile/shared/widgets/neu_stepper.dart';
import 'package:pos_mobile/shared/widgets/neu_text_field.dart';
import 'package:pos_mobile/shared/widgets/segmented_neu.dart';

/// Route args for `AppRoute.recordMovement`.
class RecordMovementArgs {
  const RecordMovementArgs({
    this.productId,
    this.productName,
    this.type = 'stock_in',
  });

  final String? productId;
  final String? productName;
  final String type; // stock_in | adjustment
}

class RecordMovementScreen extends StatefulWidget {
  const RecordMovementScreen({super.key, required this.args});

  final RecordMovementArgs args;

  @override
  State<RecordMovementScreen> createState() => _RecordMovementScreenState();
}

class _RecordMovementScreenState extends State<RecordMovementScreen> {
  late String _type = widget.args.type;
  late String? _productId = widget.args.productId;
  int _stockInQty = 1;
  final _qty = TextEditingController();
  final _reason = TextEditingController();
  bool _submitted = false;

  @override
  void dispose() {
    _qty.dispose();
    _reason.dispose();
    super.dispose();
  }

  int? get _delta {
    if (_type == 'stock_in') return _stockInQty > 0 ? _stockInQty : null;
    final raw = int.tryParse(_qty.text.trim());
    if (raw == null || raw == 0) return null;
    return raw;
  }

  Future<void> _submit() async {
    setState(() => _submitted = true);
    final delta = _delta;
    if (_productId == null || delta == null) return;

    final bizId = context.read<SessionProvider>().businessId!;
    final ok = await context.read<StockProvider>().record(
      bizId,
      productId: _productId!,
      type: _type,
      quantityDelta: delta,
      reason: _reason.text.trim().isEmpty ? null : _reason.text.trim(),
    );
    if (!mounted) return;
    if (ok) {
      // Keep the catalog's on-hand map fresh.
      await context.read<CatalogProvider>().refreshOne(bizId, _productId!);
      if (!mounted) return;
      final onHand = context.read<StockProvider>().lastOnHand;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Recorded. On hand: $onHand')));
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final stock = context.watch<StockProvider>();
    final products = context
        .watch<CatalogProvider>()
        .products
        .where((p) => p.isActive)
        .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Record movement')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(DukaSpacing.s5),
          children: [
            SegmentedNeu<String>(
              semanticLabel: 'Movement type',
              options: const [
                SegmentedOption('stock_in', 'Stock in'),
                SegmentedOption('adjustment', 'Adjustment'),
              ],
              value: _type,
              onChanged: (v) => setState(() => _type = v),
            ),
            const SizedBox(height: DukaSpacing.s5),
            if (widget.args.productName != null)
              _FixedProduct(name: widget.args.productName!)
            else
              _ProductPicker(
                products: products,
                value: _productId,
                error: _submitted && _productId == null,
                onChanged: (v) => setState(() => _productId = v),
              ),
            const SizedBox(height: DukaSpacing.s4),
            if (_type == 'stock_in')
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Quantity in',
                      style: TextStyle(
                        color: t.textSecondary,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  NeuStepper(
                    value: _stockInQty,
                    min: 1,
                    onChanged: (v) => setState(() => _stockInQty = v),
                  ),
                ],
              )
            else
              NeuTextField(
                label: 'Quantity change (±)',
                controller: _qty,
                keyboardType: const TextInputType.numberWithOptions(
                  signed: true,
                ),
                errorText: _submitted && _delta == null
                    ? 'Enter a non-zero quantity'
                    : null,
              ),
            const SizedBox(height: DukaSpacing.s4),
            NeuTextField(
              label: 'Reason',
              hint: 'Optional',
              controller: _reason,
            ),
            if (stock.error != null && _submitted) ...[
              const SizedBox(height: DukaSpacing.s4),
              ErrorByCodeCard(
                code: 'movement_failed',
                title: 'Could not record the movement',
                body: '${stock.error}',
              ),
            ],
            const SizedBox(height: DukaSpacing.s6),
            NeuButton(
              label: stock.isBusy ? 'Recording…' : 'Record',
              variant: NeuButtonVariant.primary,
              expand: true,
              onPressed: stock.isBusy ? null : _submit,
            ),
            const SizedBox(height: DukaSpacing.s3),
            Text(
              _type == 'stock_in'
                  ? 'Adds units to on-hand.'
                  : 'A negative value reduces on-hand; it cannot go below zero.',
              style: TextStyle(color: t.textSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class _FixedProduct extends StatelessWidget {
  const _FixedProduct({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Product',
          style: TextStyle(
            color: t.textSecondary,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: DukaSpacing.s2),
        Text(
          name,
          style: TextStyle(
            color: t.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
      ],
    );
  }
}

class _ProductPicker extends StatelessWidget {
  const _ProductPicker({
    required this.products,
    required this.value,
    required this.error,
    required this.onChanged,
  });

  final List<Product> products;
  final String? value;
  final bool error;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Product',
          style: TextStyle(
            color: t.textSecondary,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: DukaSpacing.s2),
        DropdownButtonFormField<String>(
          initialValue: value,
          isExpanded: true,
          decoration: InputDecoration(
            filled: true,
            fillColor: t.surfaceSunken,
            errorText: error ? 'Choose a product' : null,
          ),
          items: products
              .map(
                (p) => DropdownMenuItem(
                  value: p.id,
                  child: Text('${p.name} · ${p.sku}'),
                ),
              )
              .toList(),
          onChanged: onChanged,
        ),
      ],
    );
  }
}
