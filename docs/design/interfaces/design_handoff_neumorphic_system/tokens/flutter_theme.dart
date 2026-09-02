// Duka Stock — neumorphic design tokens for Flutter.
// Hex values are sRGB conversions of the source OKLCH tokens (see tokens.json for the
// canonical OKLCH values if you need to regenerate at different lightness/chroma).
import 'package:flutter/material.dart';

class DukaColors {
  final Color surface, surfaceSunken, textPrimary, textSecondary, textDisabled;
  final Color accent, accentHover, accentContrast;
  final Color success, warning, danger, info;
  final Color shadowLight, shadowDark;

  const DukaColors({
    required this.surface, required this.surfaceSunken,
    required this.textPrimary, required this.textSecondary, required this.textDisabled,
    required this.accent, required this.accentHover, required this.accentContrast,
    required this.success, required this.warning, required this.danger, required this.info,
    required this.shadowLight, required this.shadowDark,
  });

  static const light = DukaColors(
    surface: Color(0xFFF8F2EB),
    surfaceSunken: Color(0xFFEFE8DF),
    textPrimary: Color(0xFF2A2319),
    textSecondary: Color(0xFF5B544A),
    textDisabled: Color(0xFF9D9790),
    accent: Color(0xFF008687),
    accentHover: Color(0xFF007778),
    accentContrast: Color(0xFFF8FDFD),
    success: Color(0xFF3B8841),
    warning: Color(0xFFB67700),
    danger: Color(0xFFC13C3B),
    info: Color(0xFF2C7DA7),
    shadowLight: Color(0xE6FFFDFA), // ~90% alpha
    shadowDark: Color(0xA6B9B0A3),  // ~65% alpha
  );

  static const dark = DukaColors(
    surface: Color(0xFF25292F),
    surfaceSunken: Color(0xFF1B2025),
    textPrimary: Color(0xFFE4E8ED),
    textSecondary: Color(0xFFA4A8AE),
    textDisabled: Color(0xFF65696F),
    accent: Color(0xFF2CB3B3),
    accentHover: Color(0xFF43C3C3),
    accentContrast: Color(0xFF031010),
    success: Color(0xFF51A556),
    warning: Color(0xFFD79628),
    danger: Color(0xFFE8605B),
    info: Color(0xFF4D9CC7),
    shadowLight: Color(0xB2353B42), // ~70% alpha
    shadowDark: Color(0xD9040609),  // ~85% alpha
  );
}

class DukaRadius {
  static const control = 16.0, card = 22.0, sheet = 28.0, pill = 999.0;
}

class DukaSpacing {
  static const s1 = 4.0, s2 = 8.0, s3 = 12.0, s4 = 16.0, s5 = 20.0, s6 = 24.0, s7 = 32.0, s8 = 40.0, s9 = 48.0;
}

/// Elevation as paired BoxShadow lists — light shadow offset top-left, dark offset bottom-right.
class DukaElevation {
  static List<BoxShadow> raised(DukaColors t, double xy, double blur) => [
    BoxShadow(color: t.shadowDark, offset: Offset(xy, xy), blurRadius: blur),
    BoxShadow(color: t.shadowLight, offset: Offset(-xy, -xy), blurRadius: blur),
  ];

  static List<BoxShadow> sm(DukaColors t) => raised(t, 3, 6);
  static List<BoxShadow> md(DukaColors t) => raised(t, 6, 10);
  static List<BoxShadow> lg(DukaColors t) => raised(t, 10, 18);

  /// Flutter has no native inset shadow — approximate wells with a subtle inner gradient
  /// or the `inner_shadow`/`flutter_inset_box_shadow` package; see README for the recommended package.
}

/// Load via google_fonts: GoogleFonts.nunito(...) — weights 400/500/600/700/800.
const dukaFontFamily = 'Nunito';
