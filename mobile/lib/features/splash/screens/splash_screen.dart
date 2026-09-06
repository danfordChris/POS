import 'package:flutter/material.dart';
import 'package:pos_mobile/core/app_info.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/features/splash/widgets/animated_brand_mark.dart';

/// Fully in-app splash — shown while [SessionProvider.bootstrap] resolves.
///
/// Kept in the codebase (not a native launch screen) so it can carry a real
/// entrance animation — see [AnimatedBrandMark] — instead of a static
/// native drawable.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _wordmarkController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 400),
  );
  late final Animation<double> _wordmarkFade = CurvedAnimation(
    parent: _wordmarkController,
    curve: Curves.easeOut,
  );

  @override
  void initState() {
    super.initState();
    // Fires once the brand-mark assembly animation has mostly landed.
    Future.delayed(const Duration(milliseconds: 1600), () {
      if (mounted) _wordmarkController.forward();
    });
  }

  @override
  void dispose() {
    _wordmarkController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Scaffold(
      backgroundColor: t.surface,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AnimatedBrandMark(size: 200),
            const SizedBox(height: 16),
            FadeTransition(
              opacity: _wordmarkFade,
              child: Text(
                AppInfo.name,
                style: TextStyle(
                  color: t.textPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: 28,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
