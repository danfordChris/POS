import 'package:go_router/go_router.dart';
import 'package:pos_mobile/core/router/navigation_keys.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/auth/screens/login_screen.dart';
import 'package:pos_mobile/features/auth/screens/onboarding_screen.dart';
import 'package:pos_mobile/features/auth/screens/register_screen.dart';
import 'package:pos_mobile/features/catalog/screens/catalog_screen.dart';
import 'package:pos_mobile/features/catalog/screens/product_detail_screen.dart';
import 'package:pos_mobile/features/catalog/screens/product_form_screen.dart';
import 'package:pos_mobile/features/dev/screens/gallery_screen.dart';
import 'package:pos_mobile/features/home/screens/home_screen.dart';
import 'package:pos_mobile/features/more/screens/more_screen.dart';
import 'package:pos_mobile/features/receivables/screens/receivables_screen.dart';
import 'package:pos_mobile/features/scan/screens/scan_screen.dart';
import 'package:pos_mobile/features/sell/screens/receipt_screen.dart';
import 'package:pos_mobile/features/sell/screens/sell_screen.dart';
import 'package:pos_mobile/features/shell/screens/app_shell.dart';
import 'package:pos_mobile/features/splash/screens/splash_screen.dart';
import 'package:pos_mobile/features/stock/screens/record_movement_screen.dart';
import 'package:pos_mobile/features/winger/screens/winger_catalog_screen.dart';
import 'package:pos_mobile/models/catalog_models.dart';
import 'package:pos_mobile/models/sale_models.dart';

/// Single source of truth for every path. Never inline a path string.
enum AppRoute {
  splash('/splash'),
  // auth
  login('/login'),
  register('/register'),
  onboarding('/onboarding'),
  // authenticated tabs
  home('/home'),
  wingerCatalog('/winger'),
  catalog('/catalog'),
  scan('/scan'),
  sell('/sell'),
  more('/more'),
  // secondary
  productNew('/catalog/new'),
  productDetail('/catalog/detail'),
  productEdit('/catalog/edit'),
  recordMovement('/stock/record'),
  receipt('/sell/receipt'),
  receivables('/receivables'),
  gallery('/more/gallery');

  const AppRoute(this.path);

  final String path;

  String appendId(String id) => '$path/$id';
}

/// Minimum time the splash screen stays up, regardless of how fast
/// [SessionProvider.bootstrap] resolves — gives the entrance animation and
/// logo room to be seen instead of flashing past on a fast network.
const _splashMinDuration = Duration(seconds: 3);

GoRouter createRouter(SessionProvider session) {
  var splashElapsed = false;
  late final GoRouter router;
  Future.delayed(_splashMinDuration, () {
    splashElapsed = true;
    router.refresh();
  });
  router = GoRouter(
    navigatorKey: NavigationKeys.root,
    initialLocation: AppRoute.splash.path,
    refreshListenable: session,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      if (!splashElapsed) {
        return loc == AppRoute.splash.path ? null : AppRoute.splash.path;
      }
      switch (session.status) {
        case SessionStatus.loading:
          return loc == AppRoute.splash.path ? null : AppRoute.splash.path;
        case SessionStatus.signedOut:
          return (loc == AppRoute.login.path || loc == AppRoute.register.path)
              ? null
              : AppRoute.login.path;
        case SessionStatus.needsBusiness:
          return loc == AppRoute.onboarding.path
              ? null
              : AppRoute.onboarding.path;
        case SessionStatus.winger:
          // A winger session can reach the winger portal and nothing else.
          return loc == AppRoute.wingerCatalog.path
              ? null
              : AppRoute.wingerCatalog.path;
        case SessionStatus.ready:
          const authOnly = {'/login', '/register', '/onboarding', '/splash'};
          if (loc == AppRoute.wingerCatalog.path) return AppRoute.home.path;
          return authOnly.contains(loc) ? AppRoute.home.path : null;
      }
    },
    routes: [
      GoRoute(
        path: AppRoute.splash.path,
        builder: (_, _) => const SplashScreen(),
      ),
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
      GoRoute(
        path: AppRoute.receivables.path,
        parentNavigatorKey: NavigationKeys.root,
        builder: (_, _) => const ReceivablesScreen(),
      ),
      GoRoute(
        path: AppRoute.wingerCatalog.path,
        builder: (_, _) => const WingerCatalogScreen(),
      ),
      GoRoute(
        path: AppRoute.productNew.path,
        parentNavigatorKey: NavigationKeys.root,
        builder: (_, state) => ProductFormScreen(
          initialCode: state.extra is String ? state.extra as String : null,
        ),
      ),
      GoRoute(
        path: AppRoute.productDetail.path,
        parentNavigatorKey: NavigationKeys.root,
        builder: (_, state) =>
            ProductDetailScreen(product: state.extra as Product),
      ),
      GoRoute(
        path: AppRoute.productEdit.path,
        parentNavigatorKey: NavigationKeys.root,
        builder: (_, state) =>
            ProductFormScreen(product: state.extra as Product),
      ),
      GoRoute(
        path: AppRoute.recordMovement.path,
        parentNavigatorKey: NavigationKeys.root,
        builder: (_, state) {
          final args = state.extra is RecordMovementArgs
              ? state.extra as RecordMovementArgs
              : const RecordMovementArgs();
          return RecordMovementScreen(args: args);
        },
      ),
      GoRoute(
        path: AppRoute.receipt.path,
        parentNavigatorKey: NavigationKeys.root,
        builder: (_, state) {
          final extra = state.extra;
          final args = extra is ReceiptArgs
              ? extra
              : extra is Sale
              ? ReceiptArgs(sale: extra)
              : ReceiptArgs(saleId: extra as String);
          return ReceiptScreen(args: args);
        },
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
  return router;
}
