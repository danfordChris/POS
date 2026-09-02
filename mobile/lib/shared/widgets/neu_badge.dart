import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';

enum NeuBadgeTone { neutral, success, warning, danger, info, accent }

/// Small status pill. Tinted for semantic tones; a sunken chip for neutral.
class NeuBadge extends StatelessWidget {
  const NeuBadge(this.label, {super.key, this.tone = NeuBadgeTone.neutral});

  final String label;
  final NeuBadgeTone tone;

  ({Color bg, Color fg}) _palette(DukaColors t) {
    switch (tone) {
      case NeuBadgeTone.neutral:
        return (bg: t.surfaceSunken, fg: t.textSecondary);
      case NeuBadgeTone.success:
        return (bg: t.success.withValues(alpha: 0.16), fg: t.success);
      case NeuBadgeTone.warning:
        return (bg: t.warning.withValues(alpha: 0.16), fg: t.warning);
      case NeuBadgeTone.danger:
        return (bg: t.danger.withValues(alpha: 0.16), fg: t.danger);
      case NeuBadgeTone.info:
        return (bg: t.info.withValues(alpha: 0.16), fg: t.info);
      case NeuBadgeTone.accent:
        return (bg: t.accent.withValues(alpha: 0.16), fg: t.accent);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _palette(DukaColors.of(context));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: p.bg,
        borderRadius: BorderRadius.circular(DukaRadius.pill),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: p.fg,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}
