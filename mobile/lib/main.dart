import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/router/router.dart';
import 'package:pos_mobile/core/theme/duka_theme.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/shared/providers/app_provider.dart';
import 'package:pos_mobile/shared/providers/providers.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(MultiProvider(providers: appProviders, child: const PosApp()));
}

class PosApp extends StatefulWidget {
  const PosApp({super.key});

  @override
  State<PosApp> createState() => _PosAppState();
}

class _PosAppState extends State<PosApp> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _router = createRouter(context.read<SessionProvider>());
  }

  @override
  Widget build(BuildContext context) {
    final mode = context.select<AppProvider, ThemeMode>((p) => p.themeMode);
    return MaterialApp.router(
      title: 'Duka Stock',
      debugShowCheckedModeBanner: false,
      theme: buildDukaTheme(Brightness.light),
      darkTheme: buildDukaTheme(Brightness.dark),
      themeMode: mode,
      routerConfig: _router,
    );
  }
}
