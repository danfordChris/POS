/// Single source of truth for the app's display name.
///
/// Every user-facing surface (window title, splash screen, login screen,
/// native app label) must read from here instead of hardcoding the name.
abstract final class AppInfo {
  static const String name = 'Stoki';
}
