import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';

/// A titled panel: an icon chip + heading (+ optional trailing) over content.
class NeuSection extends StatelessWidget {
  const NeuSection({
    super.key,
    required this.icon,
    required this.title,
    required this.child,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return NeuBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: t.surfaceSunken,
                  borderRadius: BorderRadius.circular(DukaRadius.control),
                ),
                child: Icon(icon, size: 18, color: t.textSecondary),
              ),
              const SizedBox(width: DukaSpacing.s3),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: t.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 18,
                  ),
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: DukaSpacing.s4),
          child,
        ],
      ),
    );
  }
}
