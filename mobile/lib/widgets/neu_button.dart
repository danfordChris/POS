import 'package:flutter/material.dart';
import '../theme/duka_colors.dart';
import '../theme/duka_tokens.dart';

enum NeuButtonVariant { primary, secondary, ghost, destructive }

/// Soft-UI button. Primary/destructive are solid filled pills; secondary is a
/// raised neumorphic surface; all visibly sink (raised → inset look) while held.
class NeuButton extends StatefulWidget {
  const NeuButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = NeuButtonVariant.secondary,
    this.icon,
    this.expand = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final NeuButtonVariant variant;
  final IconData? icon;
  final bool expand;

  @override
  State<NeuButton> createState() => _NeuButtonState();
}

class _NeuButtonState extends State<NeuButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final enabled = widget.onPressed != null;
    final v = widget.variant;

    final isFilled =
        v == NeuButtonVariant.primary || v == NeuButtonVariant.destructive;
    final fill = switch (v) {
      NeuButtonVariant.primary => t.accent,
      NeuButtonVariant.destructive => t.danger,
      NeuButtonVariant.secondary => t.surface,
      NeuButtonVariant.ghost => Colors.transparent,
    };
    final fg = switch (v) {
      NeuButtonVariant.primary => t.accentContrast,
      NeuButtonVariant.destructive => t.dangerContrast,
      _ => t.textPrimary,
    };
    final radius = isFilled ? DukaRadius.pill : DukaRadius.control;

    final raised = v == NeuButtonVariant.ghost
        ? const <BoxShadow>[]
        : DukaElevation.sm(t);

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: GestureDetector(
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
        onTap: widget.onPressed,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          width: widget.expand ? double.infinity : null,
          constraints: const BoxConstraints(minHeight: 48, minWidth: 48),
          padding: const EdgeInsets.symmetric(
            horizontal: DukaSpacing.s5,
            vertical: DukaSpacing.s3,
          ),
          decoration: BoxDecoration(
            color: _pressed && !isFilled ? t.surfaceSunken : fill,
            borderRadius: BorderRadius.circular(radius),
            boxShadow: _pressed ? const [] : raised,
          ),
          child: Opacity(
            opacity: enabled ? 1 : 0.5,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (widget.icon != null) ...[
                  Icon(widget.icon, size: 20, color: fg),
                  const SizedBox(width: DukaSpacing.s2),
                ],
                Text(
                  widget.label,
                  style: TextStyle(
                    color: fg,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
