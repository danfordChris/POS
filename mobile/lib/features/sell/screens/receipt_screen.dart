import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import 'package:pos_mobile/core/invoice_url.dart';
import 'package:pos_mobile/core/receipt_url.dart';
import 'package:pos_mobile/core/router/router.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/data/services/sales_service.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/models/catalog_models.dart' show formatMoney;
import 'package:pos_mobile/models/sale_models.dart';
import 'package:pos_mobile/shared/widgets/error_by_code_card.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';

/// Route args for `AppRoute.receipt`: either the [sale] object (happy path from
/// the sell flow) or just a [saleId] to fetch.
class ReceiptArgs {
  const ReceiptArgs({this.sale, this.saleId})
    : assert(sale != null || saleId != null);
  final Sale? sale;
  final String? saleId;
}

class ReceiptScreen extends StatefulWidget {
  const ReceiptScreen({super.key, required this.args});
  final ReceiptArgs args;

  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen> {
  Sale? _sale;
  Object? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _sale = widget.args.sale;
    if (_sale == null) _fetch();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      final bizId = context.read<SessionProvider>().businessId!;
      final sale = await SalesService.getSale(bizId, widget.args.saleId!);
      if (mounted) setState(() => _sale = sale);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sale = _sale;

    return Scaffold(
      appBar: AppBar(title: Text(sale == null ? 'Receipt' : 'Sale #${sale.number}')),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
            ? Padding(
                padding: const EdgeInsets.all(DukaSpacing.s5),
                child: ErrorByCodeCard(
                  code: 'receipt_unavailable',
                  title: 'Could not load the receipt',
                  body: '$_error',
                  action: ErrorAction('Retry', _fetch),
                ),
              )
            : sale == null
            ? const SizedBox.shrink()
            : _Body(sale: sale),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.sale});
  final Sale sale;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final token = sale.receipt?.publicToken;
    final url = token != null ? receiptUrl(token) : null;
    final label = TextStyle(color: t.textSecondary, fontSize: 12);

    return ListView(
      padding: const EdgeInsets.all(DukaSpacing.s5),
      children: [
        Text(
          formatMoney(sale.total, sale.currency),
          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
        ),
        Text(sale.createdAt.toLocal().toString(), style: label),
        const SizedBox(height: DukaSpacing.s5),
        ...sale.lines.map(
          (l) => Padding(
            padding: const EdgeInsets.symmetric(vertical: DukaSpacing.s1),
            child: Row(
              children: [
                Expanded(child: Text('${l.name}  ×${l.quantity}')),
                Text(formatMoney(l.lineTotal, sale.currency)),
              ],
            ),
          ),
        ),
        const Divider(),
        _row('Subtotal', formatMoney(sale.subtotal, sale.currency), label),
        _row('Discount', '-${formatMoney(sale.discountTotal, sale.currency)}', label),
        _row(
          'Total',
          formatMoney(sale.total, sale.currency),
          const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
        ),
        if (sale.invoice != null) ...[
          const SizedBox(height: DukaSpacing.s6),
          Container(
            padding: const EdgeInsets.all(DukaSpacing.s4),
            decoration: BoxDecoration(
              color: t.surfaceSunken,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Invoice #${sale.invoice!.number}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Balance due ${formatMoney(sale.invoice!.balanceDueMinor, sale.currency)}',
                  style: label,
                ),
                const SizedBox(height: DukaSpacing.s3),
                Row(
                  children: [
                    Expanded(
                      child: NeuButton(
                        label: 'Share invoice',
                        variant: NeuButtonVariant.secondary,
                        onPressed: () => Share.share(
                          invoiceUrl(sale.invoice!.publicToken),
                          subject: 'Invoice #${sale.invoice!.number}',
                        ),
                      ),
                    ),
                    const SizedBox(width: DukaSpacing.s2),
                    Expanded(
                      child: NeuButton(
                        label: 'Share PDF',
                        variant: NeuButtonVariant.secondary,
                        onPressed: () => Share.share(
                          invoicePdfUrl(sale.invoice!.publicToken),
                          subject: 'Invoice #${sale.invoice!.number} (PDF)',
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
        if (url != null) ...[
          const SizedBox(height: DukaSpacing.s6),
          Center(
            child: QrImageView(
              data: url,
              size: 180,
              backgroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: DukaSpacing.s2),
          Center(
            child: SelectableText(
              url,
              style: label,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: DukaSpacing.s4),
          NeuButton(
            label: 'Share link',
            variant: NeuButtonVariant.primary,
            expand: true,
            onPressed: () => Share.share(url, subject: 'Receipt #${sale.number}'),
          ),
        ],
        const SizedBox(height: DukaSpacing.s3),
        NeuButton(
          label: 'New sale',
          variant: NeuButtonVariant.secondary,
          expand: true,
          onPressed: () => context.go(AppRoute.sell.path),
        ),
      ],
    );
  }

  Widget _row(String k, String v, TextStyle style) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [Text(k, style: style), Text(v, style: style)],
    ),
  );
}
