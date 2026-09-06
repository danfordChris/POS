import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:lottie/lottie.dart';
import 'package:pos_mobile/core/resources/resources.dart';

/// The Stoki brand-mark entrance: a hand-authored Lottie animation
/// (`assets/animations/brand_blocks.json`) plays three "stock" blocks
/// flying in from different edges of the screen and converging at the
/// center — visualizing what the app does (bringing stock together into
/// one place). It then cross-fades into the real vector logo
/// (`Svgs.appLogo`) for a crisp resting mark.
class AnimatedBrandMark extends StatefulWidget {
  const AnimatedBrandMark({super.key, this.size = 200});

  final double size;

  @override
  State<AnimatedBrandMark> createState() => _AnimatedBrandMarkState();
}

class _AnimatedBrandMarkState extends State<AnimatedBrandMark>
    with TickerProviderStateMixin {
  late final AnimationController _lottieController = AnimationController(
    vsync: this,
  );

  late final AnimationController _crossfadeController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 500),
  );
  late final Animation<double> _logoOpacity = CurvedAnimation(
    parent: _crossfadeController,
    curve: Curves.easeOut,
  );
  late final Animation<double> _logoScale = Tween<double>(
    begin: 0.82,
    end: 1.0,
  ).animate(CurvedAnimation(parent: _crossfadeController, curve: Curves.easeOutBack));

  @override
  void dispose() {
    _lottieController.dispose();
    _crossfadeController.dispose();
    super.dispose();
  }

  void _onLottieLoaded(LottieComposition composition) {
    _lottieController
      ..duration = composition.duration
      ..forward();
    // Start the cross-fade to the real logo right as the blocks land.
    Future.delayed(composition.duration * 0.75, () {
      if (mounted) _crossfadeController.forward();
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.size;
    return SizedBox(
      width: s,
      height: s,
      child: Stack(
        alignment: Alignment.center,
        children: [
          FadeTransition(
            opacity: ReverseAnimation(_logoOpacity),
            child: Lottie.asset(
              Animations.brandBlocks,
              controller: _lottieController,
              onLoaded: _onLottieLoaded,
              width: s,
              height: s,
              fit: BoxFit.contain,
            ),
          ),
          ScaleTransition(
            scale: _logoScale,
            child: FadeTransition(
              opacity: _logoOpacity,
              child: SvgPicture.asset(Svgs.appLogo, width: s, height: s),
            ),
          ),
        ],
      ),
    );
  }
}
