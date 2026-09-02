import 'package:go_router/go_router.dart';
import 'package:pos_mobile/core/router/navigation_keys.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/auth/screens/login_screen.dart';
import 'package:pos_mobile/features/auth/screens/onboarding_screen.dart';
import 'package:pos_mobile/features/auth/screens/register_screen.dart';
import 'package:pos_mobile/features/catalog/screens/catalog_screen.dart';
import 'package:pos_mobile/features/dev/screens/gallery_screen.dart';
import 'package:pos_mobile/features/home/screens/home_screen.dart';
import 'package:pos_mobile/features/more/screens/more_screen.dart';
import 'package:pos_mobile/features/scan/screens/scan_screen.dart';
import 'package:pos_mobile/features/sell/screens/sell_screen.dart';
import 'package:pos_mobile/features/shell/screens/app_shell.dart';

/// Single source of truth for every path. Never inline a path string.
enum AppRoute {
  // auth
  login('/login'),
  register('/register'),
  onboarding('/onboarding'),
  // authenticated tabs
  home('/home'),
  catalog('/catalog'),
  scan('/scan'),
  sell('/sell'),
  more('/more'),
  // secondary
  gallery('/more/gallery');

  const AppRoute(this.path);

  final String path;

  String appendId(String id) => '$path/$id';
}

GoRouter createRouter(SessionProvider session) {
  return GoRouter(
    navigatorKey: NavigationKeys.root,
    initialLocation: AppRoute.home.path,
    refreshListenable: session,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      switch (session.status) {
        case SessionStatus.loading:
          return null;
        case SessionStatus.signedOut:
          return (loc == AppRoute.login.path || loc == AppRoute.register.path)
              ? null
              : AppRoute.login.path;
        case SessionStatus.needsBusiness:
          return loc == AppRoute.onboarding.path
              ? null
              : AppRoute.onboarding.path;
        case SessionStatus.ready:
          const authOnly = {
            '/login',
            '/register',
            '/onboarding',
          };
          return authOnly.contains(loc) ? AppRoute.home.path : null;
      }
    },
    routes: [
      GoRoute(
        path: AppRoute.login.path,
        builder: (_, _) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoute.register.path,
        builder: (_, _) => const RegisterScreen(),
      ),
      GoRoute(
        path: AppRoute.onboarding.path,
        builder: (_, _) => const OnboardingScreen(),
      ),
      GoRoute(
        path: AppRoute.gallery.path,
        builder: (_, _) => const GalleryScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.home.path,
                builder: (_, _) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.catalog.path,
                builder: (_, _) => const CatalogScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.scan.path,
                builder: (_, _) => const ScanScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.sell.path,
                builder: (_, _) => const SellScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.more.path,
                builder: (_, _) => const MoreScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
