// Duka Stock — neumorphic color roles for Flutter.
// sRGB conversions of the canonical OKLCH tokens in
// docs/design/interfaces/design_handoff_neumorphic_system/tokens.json.
// Do not hard-code these values in widgets — read them from `DukaColors.of(context)`.
import 'package:flutter/material.dart';

@immutable
class DukaColors extends ThemeExtension<DukaColors> {
  final Color surface, surfaceSunken;
  final Color textPrimary, textSecondary, textDisabled;
  final Color accent, accentHover, accentContrast;
  final Color success, warning, danger, dangerContrast, info;
  final Color shadowLight, shadowDark;

  const DukaColors({
    required this.surface,
    required this.surfaceSunken,
    required this.textPrimary,
    required this.textSecondary,
    required this.textDisabled,
    required this.accent,
    required this.accentHover,
    required this.accentContrast,
    required this.success,
    required this.warning,
    required this.danger,
    required this.dangerContrast,
    required this.info,
    required this.shadowLight,
    required this.shadowDark,
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
    dangerContrast: Color(0xFFFDF7F6),
    info: Color(0xFF2C7DA7),
    shadowLight: Color(0xE6FFFDFA),
    shadowDark: Color(0xA6B9B0A3),
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
    dangerContrast: Color(0xFFFBF1F0),
    info: Color(0xFF4D9CC7),
    shadowLight: Color(0xB2353B42),
    shadowDark: Color(0xD9040609),
  );

  /// The palette for the current theme. Falls back to [light] if the extension
  /// is missing (should not happen when `buildDukaTheme` is used).
  static DukaColors of(BuildContext context) =>
      Theme.of(context).extension<DukaColors>() ?? light;

  @override
  DukaColors copyWith({
    Color? surface,
    Color? surfaceSunken,
    Color? textPrimary,
    Color? textSecondary,
    Color? textDisabled,
    Color? accent,
    Color? accentHover,
    Color? accentContrast,
    Color? success,
    Color? warning,
    Color? danger,
    Color? dangerContrast,
    Color? info,
    Color? shadowLight,
    Color? shadowDark,
  }) {
    return DukaColors(
      surface: surface ?? this.surface,
      surfaceSunken: surfaceSunken ?? this.surfaceSunken,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textDisabled: textDisabled ?? this.textDisabled,
      accent: accent ?? this.accent,
      accentHover: accentHover ?? this.accentHover,
      accentContrast: accentContrast ?? this.accentContrast,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      danger: danger ?? this.danger,
      dangerContrast: dangerContrast ?? this.dangerContrast,
      info: info ?? this.info,
      shadowLight: shadowLight ?? this.shadowLight,
      shadowDark: shadowDark ?? this.shadowDark,
    );
  }

  @override
  DukaColors lerp(ThemeExtension<DukaColors>? other, double t) {
    if (other is! DukaColors) return this;
    return DukaColors(
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceSunken: Color.lerp(surfaceSunken, other.surfaceSunken, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textDisabled: Color.lerp(textDisabled, other.textDisabled, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentHover: Color.lerp(accentHover, other.accentHover, t)!,
      accentContrast: Color.lerp(accentContrast, other.accentContrast, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      dangerContrast: Color.lerp(dangerContrast, other.dangerContrast, t)!,
      info: Color.lerp(info, other.info, t)!,
      shadowLight: Color.lerp(shadowLight, other.shadowLight, t)!,
      shadowDark: Color.lerp(shadowDark, other.shadowDark, t)!,
    );
  }
}
