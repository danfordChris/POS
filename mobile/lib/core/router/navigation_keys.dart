import 'package:flutter/widgets.dart';

/// Global navigator keys. The five bottom-nav branches are managed internally by
/// `StatefulShellRoute.indexedStack`, so only the root key is needed today.
class NavigationKeys {
  NavigationKeys._();

  static final GlobalKey<NavigatorState> root = GlobalKey<NavigatorState>(
    debugLabel: 'rootNavKey',
  );
}
