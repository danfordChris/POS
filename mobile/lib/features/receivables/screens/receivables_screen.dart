import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/receivables/providers/receivables_provider.dart';
import 'package:pos_mobile/models/catalog_models.dart' show formatMoney;
import 'package:pos_mobile/shared/widgets/error_by_code_card.dart';
import 'package:pos_mobile/shared/widgets/neu_empty_state.dart';

/// Read-only accounts-receivable summary. Reachable from the More menu for
/// Owners.
class ReceivablesScreen extends StatefulWidget {
  const ReceivablesScreen({super.key});

  @override
  State<ReceivablesScreen> createState() => _ReceivablesScreenState();
}

class _ReceivablesScreenState extends State<ReceivablesScreen> {
  String? get _bizId => context.read<SessionProvider>().businessId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final id = _bizId;
      if (id != null) context.read<ReceivablesProvider>().load(id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final p = context.watch<ReceivablesProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Receivables')),
      body: SafeArea(
        child: p.isBusy && !p.loaded
            ? const Center(child: CircularProgressIndicator())
            : p.error != null && !p.loaded
            ? Padding(
                padding: const EdgeInsets.all(DukaSpacing.s5),
                child: ErrorByCodeCard(
                  code: 'receivables_unavailable',
                  title: 'Could not load receivables',
                  body: '${p.error}',
                  action: ErrorAction(
                    'Retry',
                    () => context.read<ReceivablesProvider>().load(_bizId!),
                  ),
                ),
              )
            : ListView(
                padding: const EdgeInsets.all(DukaSpacing.s5),
                children: [
                  NeuBox(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Owed to you',
                          style: TextStyle(
                            color: t.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          formatMoney(p.totalOutstanding, 'TZS'),
                          style: const TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          '${p.owing.length} customer(s) · ${p.overdue.length} overdue invoice(s)',
                          style: TextStyle(
                            color: t.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: DukaSpacing.s4),
                  if (p.owing.isEmpty)
                    const NeuEmptyState(
                      icon: Icons.check_circle_outline,
                      title: 'Nothing outstanding',
                      message: 'No customer currently owes you money.',
                    )
                  else
                    ...p.owing.map(
                      (c) => NeuBox(
                        padding: const EdgeInsets.symmetric(
                          horizontal: DukaSpacing.s4,
                          vertical: DukaSpacing.s3,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(c.name),
                                  if (c.email != null)
                                    Text(
                                      c.email!,
                                      style: TextStyle(
                                        color: t.textSecondary,
                                        fontSize: 12,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            Text(
                              formatMoney(c.outstandingBalance, 'TZS'),
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}
