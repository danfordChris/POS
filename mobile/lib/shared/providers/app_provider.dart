import 'package:flutter/material.dart';
import 'package:pos_mobile/shared/providers/base_provider.dart';

/// Owns the app-wide [ThemeMode]. Persistence (secure prefs) is a later addition;
/// for now the choice lives for the session.
class AppProvider extends BaseProvider {
  ThemeMode _themeMode = ThemeMode.system;

  ThemeMode get themeMode => _themeMode;

  void setThemeMode(ThemeMode mode) {
    if (_themeMode == mode) return;
    _themeMode = mode;
    notifyListeners();
  }

  void toggleTheme() {
    setThemeMode(
      _themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark,
    );
  }
}
