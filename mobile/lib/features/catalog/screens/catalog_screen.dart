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
import 'package:pos_mobile/shared/widgets/neu_empty_state.dart';
import 'package:pos_mobile/shared/widgets/neu_skeleton.dart';
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
                const _SkeletonList()
              else if (products.isEmpty)
                NeuEmptyState(
                  icon: Icons.inventory_2_outlined,
                  title: _search.text.isEmpty
                      ? 'No products yet'
                      : 'Nothing matches “${_search.text}”',
                  message: _search.text.isEmpty
                      ? 'Add your first product to start tracking stock.'
                      : 'Try a different name or SKU.',
                  action: _search.text.isEmpty
                      ? NeuEmptyAction(
                          'New product',
                          () => context.push(AppRoute.productNew.path),
                        )
                      : null,
                )
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

class _SkeletonList extends StatelessWidget {
  const _SkeletonList();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        6,
        (_) => const Padding(
          padding: EdgeInsets.only(bottom: DukaSpacing.s3),
          child: NeuBox(
            padding: EdgeInsets.all(DukaSpacing.s4),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      NeuSkeleton(width: 160, height: 15),
                      SizedBox(height: 8),
                      NeuSkeleton(width: 90, height: 12),
                    ],
                  ),
                ),
                SizedBox(width: DukaSpacing.s3),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    NeuSkeleton(width: 80, height: 14),
                    SizedBox(height: 8),
                    NeuSkeleton(width: 60, height: 12),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
