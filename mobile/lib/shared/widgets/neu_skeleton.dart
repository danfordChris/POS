import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';

/// A sunken shimmer block. Compose these for list/table loading states.
/// (Hand-rolled rather than `skeletonizer` — that package trails the current
/// Flutter `Canvas` API.)
class NeuSkeleton extends StatefulWidget {
  const NeuSkeleton({
    super.key,
    this.width,
    this.height = 14,
    this.radius = DukaRadius.control,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  State<NeuSkeleton> createState() => _NeuSkeletonState();
}

class _NeuSkeletonState extends State<NeuSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final reduce = MediaQuery.disableAnimationsOf(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.radius),
      child: SizedBox(
        width: widget.width,
        height: widget.height,
        child: ColoredBox(
          color: t.surfaceSunken,
          child: reduce
              ? const SizedBox.shrink()
              : AnimatedBuilder(
                  animation: _c,
                  builder: (context, _) {
                    return FractionallySizedBox(
                      widthFactor: 1,
                      alignment: Alignment(-1 + 2 * _c.value, 0),
                      child: FractionallySizedBox(
                        widthFactor: 0.4,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                t.surfaceSunken.withValues(alpha: 0),
                                t.surface.withValues(alpha: 0.7),
                                t.surfaceSunken.withValues(alpha: 0),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
