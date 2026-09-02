import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';

/// Inset-track switch; the knob slides and stays raised.
class NeuToggle extends StatelessWidget {
  const NeuToggle({
    super.key,
    required this.value,
    required this.onChanged,
    this.semanticLabel,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final enabled = onChanged != null;

    return Semantics(
      toggled: value,
      label: semanticLabel,
      child: Opacity(
        opacity: enabled ? 1 : 0.5,
        child: GestureDetector(
          onTap: enabled ? () => onChanged!(!value) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            curve: Curves.easeOut,
            width: 52,
            height: 30,
            padding: const EdgeInsets.all(3),
            alignment: value ? Alignment.centerRight : Alignment.centerLeft,
            decoration: BoxDecoration(
              color: value ? t.accent : t.surfaceSunken,
              borderRadius: BorderRadius.circular(DukaRadius.pill),
              boxShadow: [
                BoxShadow(
                  color: t.shadowDark,
                  offset: const Offset(2, 2),
                  blurRadius: 4,
                ),
              ],
            ),
            child: Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: t.surface,
                shape: BoxShape.circle,
                boxShadow: DukaElevation.sm(t),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
