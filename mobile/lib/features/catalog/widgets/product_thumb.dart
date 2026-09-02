import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';

/// Rounded square product thumbnail — the image, or a box icon fallback.
class ProductThumb extends StatelessWidget {
  const ProductThumb({super.key, this.imageUrl, this.size = 48});

  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final fallback = Icon(
      Icons.inventory_2_outlined,
      size: size * 0.5,
      color: t.textSecondary,
    );

    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: t.surfaceSunken,
        borderRadius: BorderRadius.circular(DukaRadius.control),
      ),
      child: imageUrl == null
          ? fallback
          : Image.network(
              imageUrl!,
              fit: BoxFit.cover,
              width: size,
              height: size,
              errorBuilder: (_, _, _) => fallback,
              loadingBuilder: (_, child, progress) =>
                  progress == null ? child : fallback,
            ),
    );
  }
}
