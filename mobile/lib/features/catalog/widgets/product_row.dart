import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/features/catalog/widgets/product_thumb.dart';
import 'package:pos_mobile/models/catalog_models.dart';
import 'package:pos_mobile/shared/widgets/neu_badge.dart';

/// One product in the catalog list: name / SKU, on-hand (+ low badge), price.
class ProductRow extends StatelessWidget {
  const ProductRow({
    super.key,
    required this.product,
    required this.stock,
    required this.onTap,
  });

  final Product product;
  final StockItem? stock;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return NeuBox(
      onTap: onTap,
      padding: const EdgeInsets.all(DukaSpacing.s4),
      child: Row(
        children: [
          ProductThumb(imageUrl: product.imageUrl),
          const SizedBox(width: DukaSpacing.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      product.sku,
                      style: TextStyle(color: t.textSecondary, fontSize: 13),
                    ),
                    if (!product.isActive) ...[
                      const SizedBox(width: 6),
                      const NeuBadge('inactive'),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: DukaSpacing.s3),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatMoney(product.sellPrice, product.currency),
                style: TextStyle(
                  color: t.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (stock?.lowStock ?? false) ...[
                    const NeuBadge('low', tone: NeuBadgeTone.warning),
                    const SizedBox(width: 6),
                  ],
                  Text(
                    stock == null ? '— on hand' : '${stock!.onHand} on hand',
                    style: TextStyle(color: t.textSecondary, fontSize: 13),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
