// Builds Material ThemeData from the Duka neumorphic tokens.
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'duka_colors.dart';

ThemeData buildDukaTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final DukaColors c = isDark ? DukaColors.dark : DukaColors.light;

  final base = ThemeData(brightness: brightness, useMaterial3: true);

  final textTheme = GoogleFonts.nunitoTextTheme(
    base.textTheme,
  ).apply(bodyColor: c.textPrimary, displayColor: c.textPrimary);

  return base.copyWith(
    scaffoldBackgroundColor: c.surface,
    canvasColor: c.surface,
    colorScheme: base.colorScheme.copyWith(
      brightness: brightness,
      primary: c.accent,
      onPrimary: c.accentContrast,
      surface: c.surface,
      onSurface: c.textPrimary,
      error: c.danger,
      onError: c.dangerContrast,
      secondary: c.info,
    ),
    textTheme: textTheme.copyWith(
      // Tabular figures for money / quantities are applied per-widget with
      // `fontFeatures: [FontFeature.tabularFigures()]`.
      titleLarge: textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
        fontSize: 24,
      ),
      titleMedium: textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        fontSize: 20,
      ),
      bodyLarge: textTheme.bodyLarge?.copyWith(fontSize: 18),
      bodyMedium: textTheme.bodyMedium?.copyWith(fontSize: 16),
      labelSmall: textTheme.labelSmall?.copyWith(
        fontWeight: FontWeight.w600,
        letterSpacing: 0.6,
      ),
    ),
    iconTheme: IconThemeData(color: c.textPrimary, size: 24),
    splashFactory: NoSplash.splashFactory,
    extensions: <ThemeExtension<dynamic>>[c],
  );
}
