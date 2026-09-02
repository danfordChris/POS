import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'app/router.dart';
import 'app/session_scope.dart';
import 'app/theme_mode.dart';
import 'data/session.dart';
import 'theme/duka_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PosApp());
}

class PosApp extends StatefulWidget {
  const PosApp({super.key});

  @override
  State<PosApp> createState() => _PosAppState();
}

class _PosAppState extends State<PosApp> {
  late final SessionController _session;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _session = SessionController();
    _router = createRouter(_session);
    _session.bootstrap();
  }

  @override
  void dispose() {
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      controller: _session,
      child: ValueListenableBuilder<ThemeMode>(
        valueListenable: themeMode,
        builder: (context, mode, _) {
          return MaterialApp.router(
            title: 'Duka Stock',
            debugShowCheckedModeBanner: false,
            theme: buildDukaTheme(Brightness.light),
            darkTheme: buildDukaTheme(Brightness.dark),
            themeMode: mode,
            routerConfig: _router,
          );
        },
      ),
    );
  }
}
