import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';

/// Compact `−  value  +` control for quantities / thresholds.
class NeuStepper extends StatelessWidget {
  const NeuStepper({
    super.key,
    required this.value,
    required this.onChanged,
    this.min = 0,
    this.max,
    this.step = 1,
  });

  final int value;
  final ValueChanged<int> onChanged;
  final int min;
  final int? max;
  final int step;

  void _bump(int delta) {
    var next = value + delta;
    if (next < min) next = min;
    if (max != null && next > max!) next = max!;
    if (next != value) {
      HapticFeedback.selectionClick();
      onChanged(next);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(DukaRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Key(icon: Icons.remove, onTap: () => _bump(-step), t: t),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: DukaSpacing.s4),
            child: Text(
              '$value',
              style: TextStyle(
                color: t.textPrimary,
                fontWeight: FontWeight.w800,
                fontSize: 16,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          _Key(icon: Icons.add, onTap: () => _bump(step), t: t),
        ],
      ),
    );
  }
}

class _Key extends StatelessWidget {
  const _Key({required this.icon, required this.onTap, required this.t});
  final IconData icon;
  final VoidCallback onTap;
  final DukaColors t;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: t.accent,
          borderRadius: BorderRadius.circular(DukaRadius.control),
        ),
        child: Icon(icon, size: 18, color: t.accentContrast),
      ),
    );
  }
}
