import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/catalog/providers/catalog_provider.dart';
import 'package:pos_mobile/models/catalog_models.dart';
import 'package:pos_mobile/shared/widgets/error_by_code_card.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';
import 'package:pos_mobile/shared/widgets/neu_section.dart';
import 'package:pos_mobile/shared/widgets/neu_stepper.dart';
import 'package:pos_mobile/shared/widgets/neu_text_field.dart';

class ProductFormScreen extends StatefulWidget {
  const ProductFormScreen({super.key, this.product, this.initialCode});

  final Product? product;
  final String? initialCode;

  bool get isEdit => product != null;

  @override
  State<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends State<ProductFormScreen> {
  late final _sku = TextEditingController(text: widget.product?.sku);
  late final _name = TextEditingController(text: widget.product?.name);
  late final _description = TextEditingController(
    text: widget.product?.description ?? '',
  );
  late final _unit = TextEditingController(
    text: widget.product?.unit ?? 'each',
  );
  late final _code = TextEditingController(
    text: widget.product?.code ?? widget.initialCode ?? '',
  );
  late final _cost = TextEditingController(
    text: widget.product?.costPrice?.toString() ?? '',
  );
  late final _sell = TextEditingController(
    text: widget.product?.sellPrice.toString() ?? '',
  );
  late final _winger = TextEditingController(
    text: widget.product?.wingerPrice?.toString() ?? '',
  );

  late int _threshold = widget.product?.reorderThreshold ?? 0;
  String? _categoryId;
  bool _submitted = false;

  @override
  void initState() {
    super.initState();
    _categoryId = widget.product?.categoryId;
  }

  @override
  void dispose() {
    for (final c in [
      _sku,
      _name,
      _description,
      _unit,
      _code,
      _cost,
      _sell,
      _winger,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  int? _int(TextEditingController c) =>
      c.text.trim().isEmpty ? null : int.tryParse(c.text.trim());

  Future<void> _submit(bool canEditPrices) async {
    setState(() => _submitted = true);
    if (_sku.text.trim().isEmpty || _name.text.trim().isEmpty) return;

    final body = <String, dynamic>{
      'sku': _sku.text.trim(),
      'name': _name.text.trim(),
      'description': _description.text.trim().isEmpty
          ? null
          : _description.text.trim(),
      'category_id': _categoryId,
      'unit': _unit.text.trim().isEmpty ? 'each' : _unit.text.trim(),
      'code': _code.text.trim().isEmpty ? null : _code.text.trim(),
      'reorder_threshold': _threshold,
      if (canEditPrices) 'cost_price': _int(_cost),
      if (canEditPrices) 'sell_price': _int(_sell),
      if (canEditPrices) 'winger_price': _int(_winger),
    };

    final bizId = context.read<SessionProvider>().businessId!;
    final saved = await context.read<CatalogProvider>().save(
      bizId,
      id: widget.product?.id,
      body: body,
    );
    if (!mounted) return;
    if (saved != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Saved “${saved.name}”')));
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final canEditPrices = context.read<SessionProvider>().isOwner;
    final catalog = context.watch<CatalogProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isEdit ? 'Edit product' : 'New product'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(DukaSpacing.s5),
          children: [
            NeuSection(
              icon: Icons.inventory_2_outlined,
              title: 'Item details',
              child: Column(
                children: [
                  NeuTextField(
                    label: 'Name',
                    hint: 'e.g. Cola 300ml',
                    controller: _name,
                    prefix: const Icon(Icons.label_outline, size: 18),
                    errorText: _submitted && _name.text.trim().isEmpty
                        ? 'Required'
                        : null,
                  ),
                  const SizedBox(height: DukaSpacing.s4),
                  NeuTextField(
                    label: 'Barcode / SKU',
                    hint: 'e.g. SODA-300',
                    controller: _sku,
                    prefix: const Icon(Icons.qr_code_2, size: 18),
                    errorText: _submitted && _sku.text.trim().isEmpty
                        ? 'Required'
                        : null,
                  ),
                  const SizedBox(height: DukaSpacing.s4),
                  NeuTextField(
                    label: 'Description',
                    hint: 'Describe the product…',
                    controller: _description,
                  ),
                  const SizedBox(height: DukaSpacing.s4),
                  _CategoryField(
                    categories: catalog.categories,
                    value: _categoryId,
                    onChanged: (v) => setState(() => _categoryId = v),
                  ),
                  const SizedBox(height: DukaSpacing.s4),
                  NeuTextField(label: 'Unit', hint: 'each', controller: _unit),
                ],
              ),
            ),

            if (canEditPrices) ...[
              const SizedBox(height: DukaSpacing.s4),
              NeuSection(
                icon: Icons.payments_outlined,
                title: 'Pricing',
                child: Column(
                  children: [
                    NeuTextField(
                      label: 'Buy price',
                      hint: '0',
                      prefix: const Text('TZS'),
                      controller: _cost,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: DukaSpacing.s4),
                    NeuTextField(
                      label: 'Sell price',
                      hint: '0',
                      prefix: const Text('TZS'),
                      controller: _sell,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: DukaSpacing.s4),
                    NeuTextField(
                      label: 'Winger price',
                      hint: '0',
                      prefix: const Text('TZS'),
                      controller: _winger,
                      keyboardType: TextInputType.number,
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: DukaSpacing.s4),
            NeuSection(
              icon: Icons.tune,
              title: 'Inventory control',
              child: _ThresholdRow(
                value: _threshold,
                onChanged: (v) => setState(() => _threshold = v),
              ),
            ),

            if (catalog.error != null && _submitted) ...[
              const SizedBox(height: DukaSpacing.s4),
              ErrorByCodeCard(
                code: 'save_failed',
                title: 'Could not save the product',
                body: '${catalog.error}',
              ),
            ],
            const SizedBox(height: DukaSpacing.s8),
          ],
        ),
      ),
      bottomNavigationBar: _StickyBar(
        child: NeuButton(
          label: catalog.isBusy
              ? 'Saving…'
              : (widget.isEdit ? 'Save changes' : 'Create product'),
          variant: NeuButtonVariant.primary,
          expand: true,
          onPressed: catalog.isBusy ? null : () => _submit(canEditPrices),
        ),
      ),
    );
  }
}

class _StickyBar extends StatelessWidget {
  const _StickyBar({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Container(
      color: t.surface,
      padding: EdgeInsets.fromLTRB(
        DukaSpacing.s5,
        DukaSpacing.s3,
        DukaSpacing.s5,
        DukaSpacing.s3 + MediaQuery.paddingOf(context).bottom,
      ),
      child: child,
    );
  }
}

class _ThresholdRow extends StatelessWidget {
  const _ThresholdRow({required this.value, required this.onChanged});
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: DukaSpacing.s4,
        vertical: DukaSpacing.s3,
      ),
      decoration: BoxDecoration(
        color: t.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(DukaRadius.control),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Reorder threshold',
                  style: TextStyle(
                    color: t.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                Text(
                  'Flag as low stock at or below this',
                  style: TextStyle(color: t.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          NeuStepper(value: value, onChanged: onChanged, step: 5),
        ],
      ),
    );
  }
}

class _CategoryField extends StatelessWidget {
  const _CategoryField({
    required this.categories,
    required this.value,
    required this.onChanged,
  });

  final List<Category> categories;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Category',
          style: TextStyle(
            color: t.textSecondary,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: DukaSpacing.s2),
        NeuWell(
          padding: const EdgeInsets.symmetric(horizontal: DukaSpacing.s4),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String?>(
              isExpanded: true,
              value: value,
              hint: Text(
                'None',
                style: TextStyle(color: t.textDisabled, fontSize: 16),
              ),
              dropdownColor: t.surface,
              style: TextStyle(color: t.textPrimary, fontSize: 16),
              items: [
                const DropdownMenuItem<String?>(child: Text('None')),
                ...categories.map(
                  (c) => DropdownMenuItem<String?>(
                    value: c.id,
                    child: Text(c.name),
                  ),
                ),
              ],
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }
}
