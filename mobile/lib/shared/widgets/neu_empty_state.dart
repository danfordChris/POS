import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';

class NeuEmptyAction {
  const NeuEmptyAction(this.label, this.onPressed);
  final String label;
  final VoidCallback onPressed;
}

/// Illustration-style empty state: inset icon chip + headline + line + one CTA.
class NeuEmptyState extends StatelessWidget {
  const NeuEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? message;
  final NeuEmptyAction? action;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return NeuBox(
      padding: const EdgeInsets.symmetric(
        horizontal: DukaSpacing.s5,
        vertical: DukaSpacing.s8,
      ),
      child: Column(
        children: [
          NeuWell(
            padding: const EdgeInsets.all(DukaSpacing.s4),
            radius: DukaRadius.pill,
            child: Icon(icon, size: 28, color: t.textSecondary),
          ),
          const SizedBox(height: DukaSpacing.s4),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: t.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 18,
            ),
          ),
          if (message != null) ...[
            const SizedBox(height: DukaSpacing.s2),
            Text(
              message!,
              textAlign: TextAlign.center,
              style: TextStyle(color: t.textSecondary, fontSize: 15),
            ),
          ],
          if (action != null) ...[
            const SizedBox(height: DukaSpacing.s5),
            NeuButton(
              label: action!.label,
              variant: NeuButtonVariant.primary,
              onPressed: action!.onPressed,
            ),
          ],
        ],
      ),
    );
  }
}
