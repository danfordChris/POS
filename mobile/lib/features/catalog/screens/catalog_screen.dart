import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/router/router.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/catalog/providers/catalog_provider.dart';
import 'package:pos_mobile/features/catalog/widgets/product_row.dart';
import 'package:pos_mobile/shared/widgets/error_by_code_card.dart';
import 'package:pos_mobile/shared/widgets/neu_text_field.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _search = TextEditingController();

  String get _bizId => context.read<SessionProvider>().businessId!;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CatalogProvider>().load(_bizId);
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    context.read<CatalogProvider>().load(_bizId, query: value.trim());
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final catalog = context.watch<CatalogProvider>();
    final products = catalog.products;

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(AppRoute.productNew.path),
        icon: const Icon(Icons.add),
        label: const Text('New product'),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () =>
              context.read<CatalogProvider>().load(_bizId, query: _search.text),
          child: ListView(
            padding: const EdgeInsets.all(DukaSpacing.s5),
            children: [
              Text(
                'Catalog',
                style: TextStyle(
                  color: t.textPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: 28,
                ),
              ),
              const SizedBox(height: DukaSpacing.s4),
              NeuTextField(
                label: 'Search',
                hint: 'Name or SKU',
                controller: _search,
                onChanged: _onSearchChanged,
              ),
              const SizedBox(height: DukaSpacing.s4),
              if (catalog.error != null && products.isEmpty)
                ErrorByCodeCard(
                  code: 'load_failed',
                  title: 'Could not load the catalog',
                  body: '${catalog.error}',
                  action: ErrorAction(
                    'Retry',
                    () => context.read<CatalogProvider>().load(_bizId),
                  ),
                )
              else if (catalog.isBusy && products.isEmpty)
                const _LoadingList()
              else if (products.isEmpty)
                _EmptyState(color: t.textSecondary)
              else
                ...products.map(
                  (p) => Padding(
                    padding: const EdgeInsets.only(bottom: DukaSpacing.s3),
                    child: ProductRow(
                      product: p,
                      stock: catalog.stockFor(p.id),
                      onTap: () =>
                          context.push(AppRoute.productDetail.path, extra: p),
                    ),
                  ),
                ),
              if (catalog.hasMore)
                Center(
                  child: TextButton(
                    onPressed: () =>
                        context.read<CatalogProvider>().loadMore(_bizId),
                    child: const Text('Load more'),
                  ),
                ),
              const SizedBox(height: DukaSpacing.s9),
            ],
          ),
        ),
      ),
    );
  }
}

class _LoadingList extends StatelessWidget {
  const _LoadingList();
  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.only(top: DukaSpacing.s8),
    child: Center(child: CircularProgressIndicator()),
  );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.color});
  final Color color;
  @override
  Widget build(BuildContext context) => NeuWell(
    child: Text(
      'No products yet. Tap “New product” to add one.',
      style: TextStyle(color: color, fontSize: 16),
    ),
  );
}
