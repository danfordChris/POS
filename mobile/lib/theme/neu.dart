// Neumorphic primitives: NeuBox (raised) and NeuWell (inset).
import 'package:flutter/material.dart';
import 'duka_colors.dart';
import 'duka_tokens.dart';

enum NeuElevation { sm, md, lg }

/// Raised soft-UI container — single surface color, depth from the dual shadow.
class NeuBox extends StatelessWidget {
  const NeuBox({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(DukaSpacing.s5),
    this.radius = DukaRadius.card,
    this.elevation = NeuElevation.md,
    this.color,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final NeuElevation elevation;
  final Color? color;
  final VoidCallback? onTap;

  List<BoxShadow> _shadows(DukaColors t) {
    switch (elevation) {
      case NeuElevation.sm:
        return DukaElevation.sm(t);
      case NeuElevation.md:
        return DukaElevation.md(t);
      case NeuElevation.lg:
        return DukaElevation.lg(t);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final box = AnimatedContainer(
      duration: const Duration(milliseconds: 120),
      curve: Curves.easeOut,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? t.surface,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: _shadows(t),
      ),
      child: child,
    );
    if (onTap == null) return box;
    return GestureDetector(onTap: onTap, child: box);
  }
}

/// Inset (sunken) well — every input / recessed surface uses this.
class NeuWell extends StatelessWidget {
  const NeuWell({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(DukaSpacing.s4),
    this.radius = DukaRadius.control,
    this.color,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return CustomPaint(
      painter: _InsetShadowPainter(
        radius: radius,
        fill: color ?? t.surfaceSunken,
        shadowDark: t.shadowDark,
        shadowLight: t.shadowLight,
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

/// Paints a rounded-rect fill plus two inner shadows (dark top-left, light
/// bottom-right) — Flutter has no native inset BoxShadow.
class _InsetShadowPainter extends CustomPainter {
  _InsetShadowPainter({
    required this.radius,
    required this.fill,
    required this.shadowDark,
    required this.shadowLight,
  });

  final double radius;
  final Color fill;
  final Color shadowDark;
  final Color shadowLight;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(radius));

    canvas.drawRRect(rrect, Paint()..color = fill);

    canvas.save();
    canvas.clipRRect(rrect);

    const xy = DukaElevation.insetXY;
    const blur = DukaElevation.insetBlur;
    final outer = Path()..addRect(rect.inflate(blur * 3));

    void innerShadow(Offset offset, Color color) {
      final inner = Path()..addRRect(rrect.shift(offset).inflate(0.5));
      final shadowPath = Path.combine(PathOperation.difference, outer, inner);
      canvas.drawPath(
        shadowPath,
        Paint()
          ..color = color
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, blur),
      );
    }

    innerShadow(const Offset(xy, xy), shadowDark);
    innerShadow(const Offset(-xy, -xy), shadowLight);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_InsetShadowPainter old) =>
      old.radius != radius ||
      old.fill != fill ||
      old.shadowDark != shadowDark ||
      old.shadowLight != shadowLight;
}
