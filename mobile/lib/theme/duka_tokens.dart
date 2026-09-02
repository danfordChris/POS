// Duka Stock — neumorphic non-color tokens (radius / spacing / elevation / type).
// Canonical values: docs/design/interfaces/design_handoff_neumorphic_system/tokens.json.
import 'package:flutter/widgets.dart';
import 'duka_colors.dart';

class DukaRadius {
  DukaRadius._();
  static const double control = 16;
  static const double card = 22;
  static const double sheet = 28;
  static const double pill = 999;
}

class DukaSpacing {
  DukaSpacing._();
  static const double s1 = 4;
  static const double s2 = 8;
  static const double s3 = 12;
  static const double s4 = 16;
  static const double s5 = 20;
  static const double s6 = 24;
  static const double s7 = 32;
  static const double s8 = 40;
  static const double s9 = 48;
}

/// Dual-shadow elevation — light offset top-left, dark offset bottom-right.
/// Flutter has no native inset `BoxShadow`; wells are drawn by `NeuWell`
/// (see `neu.dart`) using a `CustomPainter`.
class DukaElevation {
  DukaElevation._();

  static List<BoxShadow> _raised(DukaColors t, double xy, double blur) => [
    BoxShadow(color: t.shadowDark, offset: Offset(xy, xy), blurRadius: blur),
    BoxShadow(color: t.shadowLight, offset: Offset(-xy, -xy), blurRadius: blur),
  ];

  static List<BoxShadow> sm(DukaColors t) => _raised(t, 3, 6);
  static List<BoxShadow> md(DukaColors t) => _raised(t, 6, 10);
  static List<BoxShadow> lg(DukaColors t) => _raised(t, 10, 18);

  /// Offset/blur for the inset well painter.
  static const double insetXY = 3;
  static const double insetBlur = 6;
}

/// Nunito, loaded at runtime via `google_fonts` in `duka_theme.dart`.
const String dukaFontFamily = 'Nunito';
