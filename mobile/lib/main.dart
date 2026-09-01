import 'package:flutter/material.dart';

void main() {
  runApp(const PosApp());
}

class PosApp extends StatelessWidget {
  const PosApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'POS Platform',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0B6E4F)),
        useMaterial3: true,
      ),
      home: const ScaffoldPlaceholderPage(),
    );
  }
}

class ScaffoldPlaceholderPage extends StatelessWidget {
  const ScaffoldPlaceholderPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('POS Platform')),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Scaffold placeholder.\n'
            'Auth, routing, and floor-work flows land in later Phase 00 and Phase 01 tasks.',
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
