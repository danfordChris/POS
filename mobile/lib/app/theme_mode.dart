import 'package:flutter/material.dart';

/// App-wide light/dark/system selection. A persisted per-user preference can
/// replace this later; the design system only needs the two ThemeData objects.
final ValueNotifier<ThemeMode> themeMode = ValueNotifier(ThemeMode.system);
