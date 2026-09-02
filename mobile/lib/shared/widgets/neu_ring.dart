import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';

/// Circular progress ring with a centered label. Track sits in the sunken
/// surface; the arc uses [color] (defaults to the accent).
class NeuRing extends StatelessWidget {
  const NeuRing({
    super.key,
    required this.value,
    this.size = 64,
    this.stroke = 7,
    this.color,
    this.label,
  });

  /// 0..1
  final double value;
  final double size;
  final double stroke;
  final Color? color;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _RingPainter(
          value: value.clamp(0, 1),
          stroke: stroke,
          track: t.surfaceSunken,
          arc: color ?? t.accent,
        ),
        child: Center(
          child: Text(
            label ?? '${(value.clamp(0, 1) * 100).round()}%',
            style: TextStyle(
              color: t.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: size * 0.24,
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.value,
    required this.stroke,
    required this.track,
    required this.arc,
  });

  final double value;
  final double stroke;
  final Color track;
  final Color arc;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final center = rect.center;
    final radius = (size.shortestSide - stroke) / 2;

    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = track;
    canvas.drawCircle(center, radius, trackPaint);

    if (value > 0) {
      final arcPaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = arc;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        -math.pi / 2,
        2 * math.pi * value,
        false,
        arcPaint,
      );
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.value != value || old.arc != arc || old.track != track;
}
