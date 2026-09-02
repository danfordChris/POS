import 'package:flutter/material.dart';

import 'package:provider/provider.dart';
import 'package:pos_mobile/shared/providers/app_provider.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/shared/widgets/error_by_code_card.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';
import 'package:pos_mobile/shared/widgets/neu_text_field.dart';
import 'package:pos_mobile/shared/widgets/neu_toggle.dart';
import 'package:pos_mobile/shared/widgets/segmented_neu.dart';

/// A living reference for the neumorphic kit — not a product screen. Reachable
/// from More → "Design system gallery".
class GalleryScreen extends StatefulWidget {
  const GalleryScreen({super.key});

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  bool _alerts = true;
  String _role = 'owner';
  final _sku = TextEditingController();

  @override
  void dispose() {
    _sku.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Design system')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(DukaSpacing.s5),
          children: [
            _Section(
              title: 'Theme',
              child: SegmentedNeu<ThemeMode>(
                semanticLabel: 'Theme',
                options: const [
                  SegmentedOption(ThemeMode.light, 'Light'),
                  SegmentedOption(ThemeMode.dark, 'Dark'),
                  SegmentedOption(ThemeMode.system, 'Auto'),
                ],
                value: context.watch<AppProvider>().themeMode,
                onChanged: (m) => context.read<AppProvider>().setThemeMode(m),
              ),
            ),
            _Section(
              title: 'Buttons',
              child: Wrap(
                spacing: DukaSpacing.s3,
                runSpacing: DukaSpacing.s3,
                children: [
                  NeuButton(
                    label: 'Record sale',
                    variant: NeuButtonVariant.primary,
                    onPressed: () {},
                  ),
                  NeuButton(label: 'Add product', onPressed: () {}),
                  NeuButton(
                    label: 'Cancel',
                    variant: NeuButtonVariant.ghost,
                    onPressed: () {},
                  ),
                  NeuButton(
                    label: 'Void',
                    variant: NeuButtonVariant.destructive,
                    onPressed: () {},
                  ),
                ],
              ),
            ),
            _Section(
              title: 'Inputs',
              child: Column(
                children: [
                  NeuTextField(
                    label: 'SKU',
                    hint: 'SODA-300',
                    controller: _sku,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: DukaSpacing.s4),
                  NeuTextField(
                    label: 'Sell price',
                    hint: '0',
                    keyboardType: TextInputType.number,
                    prefix: const Text('TZS'),
                    errorText: _sku.text == '0'
                        ? 'Price must be greater than zero'
                        : null,
                  ),
                  const SizedBox(height: DukaSpacing.s4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Low-stock alerts',
                        style: TextStyle(color: t.textPrimary, fontSize: 16),
                      ),
                      NeuToggle(
                        value: _alerts,
                        semanticLabel: 'Low-stock alerts',
                        onChanged: (v) => setState(() => _alerts = v),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            _Section(
              title: 'Segmented control',
              child: SegmentedNeu<String>(
                semanticLabel: 'Role preview',
                options: const [
                  SegmentedOption('owner', 'Owner'),
                  SegmentedOption('staff', 'Staff'),
                  SegmentedOption('winger', 'Winger'),
                ],
                value: _role,
                onChanged: (r) => setState(() => _role = r),
              ),
            ),
            _Section(
              title: 'Surfaces',
              child: Column(
                children: [
                  NeuBox(
                    child: Text(
                      'Raised box — elevation md',
                      style: TextStyle(color: t.textPrimary, fontSize: 16),
                    ),
                  ),
                  const SizedBox(height: DukaSpacing.s4),
                  NeuWell(
                    child: Text(
                      'Sunken well — inset',
                      style: TextStyle(color: t.textPrimary, fontSize: 16),
                    ),
                  ),
                ],
              ),
            ),
            const _Section(
              title: 'Error by code',
              child: ErrorByCodeCard(
                code: 'insufficient_stock',
                title: 'Not enough stock to complete this sale',
                body:
                    'Two lines exceed the quantity on hand. Adjust and retry.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: DukaSpacing.s6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: t.textPrimary,
              fontWeight: FontWeight.w600,
              fontSize: 20,
            ),
          ),
          const SizedBox(height: DukaSpacing.s3),
          child,
        ],
      ),
    );
  }
}
