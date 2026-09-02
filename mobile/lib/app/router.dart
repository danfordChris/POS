import 'package:go_router/go_router.dart';
import '../data/session.dart';
import '../screens/catalog_screen.dart';
import '../screens/gallery_screen.dart';
import '../screens/home_screen.dart';
import '../screens/login_screen.dart';
import '../screens/more_screen.dart';
import '../screens/onboarding_screen.dart';
import '../screens/register_screen.dart';
import '../screens/scan_screen.dart';
import '../screens/sell_screen.dart';
import 'app_shell.dart';

GoRouter createRouter(SessionController session) {
  return GoRouter(
    initialLocation: '/home',
    refreshListenable: session,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      switch (session.status) {
        case SessionStatus.loading:
          return null;
        case SessionStatus.signedOut:
          return (loc == '/login' || loc == '/register') ? null : '/login';
        case SessionStatus.needsBusiness:
          return loc == '/onboarding' ? null : '/onboarding';
        case SessionStatus.ready:
          if (loc == '/login' || loc == '/register' || loc == '/onboarding') {
            return '/home';
          }
          return null;
      }
    },
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/more/gallery', builder: (_, _) => const GalleryScreen()),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/catalog',
                builder: (_, _) => const CatalogScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/scan', builder: (_, _) => const ScanScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/sell', builder: (_, _) => const SellScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/more', builder: (_, _) => const MoreScreen()),
            ],
          ),
        ],
      ),
    ],
  );
}
