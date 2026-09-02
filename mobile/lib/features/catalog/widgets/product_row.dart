import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/models/catalog_models.dart';

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
                Text(
                  product.isActive ? product.sku : '${product.sku} · inactive',
                  style: TextStyle(color: t.textSecondary, fontSize: 13),
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
              const SizedBox(height: 2),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (stock?.lowStock ?? false)
                    Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: t.warning.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(DukaRadius.pill),
                      ),
                      child: Text(
                        'low',
                        style: TextStyle(
                          color: t.warning,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
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
