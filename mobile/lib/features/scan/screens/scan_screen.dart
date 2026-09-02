import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/router/router.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/catalog/providers/catalog_provider.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';
import 'package:pos_mobile/shared/widgets/neu_text_field.dart';

/// Scan / enter a product code. Camera capture (`mobile_scanner`) is deferred;
/// the lookup + prefill flow is the same either way: a match opens the product,
/// an unknown code starts a new product with the code prefilled.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _code = TextEditingController();
  String? _missCode;

  String get _bizId => context.read<SessionProvider>().businessId!;

  Future<void> _lookup() async {
    final code = _code.text.trim();
    if (code.isEmpty) return;
    setState(() => _missCode = null);

    final catalog = context.read<CatalogProvider>();
    final product = await catalog.lookupByCode(_bizId, code);
    if (!mounted) return;

    if (product != null) {
      context.push(AppRoute.productDetail.path, extra: product);
      _code.clear();
    } else if (catalog.error == null) {
      setState(() => _missCode = code);
    }
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final busy = context.select<CatalogProvider, bool>((p) => p.isBusy);

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(DukaSpacing.s5),
          children: [
            Text(
              'Scan',
              style: TextStyle(
                color: t.textPrimary,
                fontWeight: FontWeight.w800,
                fontSize: 28,
              ),
            ),
            const SizedBox(height: DukaSpacing.s4),
            NeuBox(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.qr_code_scanner, size: 40, color: t.textSecondary),
                  const SizedBox(height: DukaSpacing.s2),
                  Text(
                    'Camera scanning arrives with T-0107. For now, type or '
                    'paste a barcode / QR value.',
                    style: TextStyle(color: t.textSecondary, fontSize: 15),
                  ),
                ],
              ),
            ),
            const SizedBox(height: DukaSpacing.s4),
            NeuTextField(
              label: 'Code',
              hint: 'e.g. 6001234500017',
              controller: _code,
              onChanged: (_) {
                if (_missCode != null) setState(() => _missCode = null);
              },
            ),
            const SizedBox(height: DukaSpacing.s4),
            NeuButton(
              label: busy ? 'Looking up…' : 'Look up',
              variant: NeuButtonVariant.primary,
              expand: true,
              icon: Icons.search,
              onPressed: busy ? null : _lookup,
            ),
            if (_missCode != null) ...[
              const SizedBox(height: DukaSpacing.s4),
              NeuBox(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'No product uses “$_missCode”.',
                      style: TextStyle(
                        color: t.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: DukaSpacing.s3),
                    NeuButton(
                      label: 'Add a product with this code',
                      onPressed: () {
                        final code = _missCode!;
                        setState(() => _missCode = null);
                        _code.clear();
                        context.push(AppRoute.productNew.path, extra: code);
                      },
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
