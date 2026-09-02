import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:provider/provider.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';

/// Authenticated chrome: an app bar with the active business + a neumorphic
/// bottom nav (Home / Catalog / Scan* / Sell / More; Scan is raised).
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  static const _items = <({IconData icon, String label})>[
    (icon: Icons.home_outlined, label: 'Home'),
    (icon: Icons.inventory_2_outlined, label: 'Catalog'),
    (icon: Icons.qr_code_scanner, label: 'Scan'),
    (icon: Icons.point_of_sale_outlined, label: 'Sell'),
    (icon: Icons.more_horiz, label: 'More'),
  ];

  void _go(int i) =>
      shell.goBranch(i, initialLocation: i == shell.currentIndex);

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final session = context.read<SessionProvider>();

    return Scaffold(
      appBar: AppBar(
        titleSpacing: DukaSpacing.s4,
        title: Row(
          children: [
            Icon(Icons.storefront_outlined, size: 20, color: t.textSecondary),
            const SizedBox(width: DukaSpacing.s2),
            Flexible(
              child: Text(
                session.businessName ?? 'Your business',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                ),
              ),
            ),
          ],
        ),
      ),
      body: shell,
      bottomNavigationBar: _NeuBottomBar(
        items: _items,
        currentIndex: shell.currentIndex,
        onTap: _go,
      ),
    );
  }
}

class _NeuBottomBar extends StatelessWidget {
  const _NeuBottomBar({
    required this.items,
    required this.currentIndex,
    required this.onTap,
  });

  final List<({IconData icon, String label})> items;
  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(
          DukaSpacing.s4,
          0,
          DukaSpacing.s4,
          DukaSpacing.s3,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: DukaSpacing.s3,
          vertical: DukaSpacing.s2,
        ),
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(DukaRadius.sheet),
          boxShadow: DukaElevation.md(t),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            for (var i = 0; i < items.length; i++)
              _NavButton(
                icon: items[i].icon,
                label: items[i].label,
                active: i == currentIndex,
                emphasized: i == 2,
                onTap: () => onTap(i),
              ),
          ],
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.icon,
    required this.label,
    required this.active,
    required this.emphasized,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final bool emphasized;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);

    if (emphasized) {
      return GestureDetector(
        onTap: onTap,
        child: Container(
          width: 52,
          height: 52,
          margin: const EdgeInsets.only(bottom: 6),
          decoration: BoxDecoration(
            color: t.accent,
            shape: BoxShape.circle,
            boxShadow: DukaElevation.md(t),
          ),
          child: Icon(icon, color: t.accentContrast, size: 26),
        ),
      );
    }

    final color = active ? t.accent : t.textSecondary;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        width: 56,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
