import 'package:flutter/material.dart';
import '../theme/duka_colors.dart';
import '../theme/duka_tokens.dart';
import '../theme/neu.dart';
import 'neu_button.dart';

class ErrorAction {
  const ErrorAction(this.label, this.onPressed);
  final String label;
  final VoidCallback onPressed;
}

/// The only sanctioned surface for a failed request: plain-language title, the
/// machine `error.code`, and exactly one recovery action. Never renders a stack
/// trace or `devMessage`.
class ErrorByCodeCard extends StatelessWidget {
  const ErrorByCodeCard({
    super.key,
    required this.code,
    required this.title,
    this.body,
    this.action,
  });

  final String code;
  final String title;
  final String? body;
  final ErrorAction? action;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return NeuBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(width: 4, height: 40, color: t.danger),
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
            ],
          ),
          if (body != null) ...[
            const SizedBox(height: DukaSpacing.s3),
            Text(body!, style: TextStyle(color: t.textSecondary, fontSize: 16)),
          ],
          const SizedBox(height: DukaSpacing.s2),
          Text(
            code.toUpperCase(),
            style: TextStyle(
              color: t.textDisabled,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.6,
              fontSize: 12,
            ),
          ),
          if (action != null) ...[
            const SizedBox(height: DukaSpacing.s4),
            NeuButton(
              label: action!.label,
              onPressed: action!.onPressed,
              variant: NeuButtonVariant.secondary,
            ),
          ],
        ],
      ),
    );
  }
}
