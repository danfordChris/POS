import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';

class SegmentedOption<T> {
  const SegmentedOption(this.value, this.label);
  final T value;
  final String label;
}

/// Inset track; the active option reads as a raised chip.
class SegmentedNeu<T> extends StatelessWidget {
  const SegmentedNeu({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
    this.semanticLabel,
  });

  final List<SegmentedOption<T>> options;
  final T value;
  final ValueChanged<T> onChanged;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Semantics(
      label: semanticLabel,
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: t.surfaceSunken,
          borderRadius: BorderRadius.circular(DukaRadius.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: options.map((o) {
            final active = o.value == value;
            return GestureDetector(
              onTap: () => onChanged(o.value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                curve: Curves.easeOut,
                constraints: const BoxConstraints(minHeight: 36),
                padding: const EdgeInsets.symmetric(
                  horizontal: DukaSpacing.s4,
                  vertical: DukaSpacing.s2,
                ),
                decoration: BoxDecoration(
                  color: active ? t.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(DukaRadius.pill),
                  boxShadow: active ? DukaElevation.sm(t) : const [],
                ),
                child: Text(
                  o.label,
                  style: TextStyle(
                    color: active ? t.textPrimary : t.textSecondary,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
