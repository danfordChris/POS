import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

extension BuildContextX on BuildContext {
  GoRouterState get goRouterState => GoRouterState.of(this);

  /// The current full route path (e.g. `/catalog/123`).
  String? get currentRoute => goRouterState.fullPath;

  Size get screenSize => MediaQuery.sizeOf(this);
  double get screenWidth => screenSize.width;
  double get screenHeight => screenSize.height;
}

extension BuildContextExtensions on BuildContext {
  ThemeData get themeData => Theme.of(this);

  ColorScheme get colorScheme => themeData.colorScheme;
}
