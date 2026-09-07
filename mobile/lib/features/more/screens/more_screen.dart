import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/core/router/router.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  void _soon(BuildContext context, String what) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('$what arrives in a later phase.')));
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final session = context.watch<SessionProvider>();
    final bizName = session.businessName ?? 'Your business';

    return ListView(
      padding: const EdgeInsets.all(DukaSpacing.s5),
      children: [
        Text(
          'Menu',
          style: TextStyle(
            color: t.textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 28,
          ),
        ),
        const SizedBox(height: DukaSpacing.s4),

        // ── Business identity ─────────────────────────────────────────────
        NeuBox(
          child: Row(
            children: [
              _InitialsChip(text: bizName),
              const SizedBox(width: DukaSpacing.s4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      bizName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: t.textPrimary,
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                    Text(
                      '${session.user?.name ?? ''}  ·  ${session.role ?? 'staff'}',
                      style: TextStyle(color: t.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: DukaSpacing.s3),
        _Tile(
          icon: Icons.swap_horiz,
          label: 'Switch business',
          subtitle: 'One business for now',
          onTap: () => _soon(context, 'Multiple businesses'),
        ),

        const SizedBox(height: DukaSpacing.s5),
        const _GroupLabel('Manage'),
        const SizedBox(height: DukaSpacing.s2),
        if (session.isOwner) ...[
          _Tile(
            icon: Icons.request_quote_outlined,
            label: 'Receivables',
            subtitle: 'Who owes you, and overdue invoices',
            onTap: () => context.push(AppRoute.receivables.path),
          ),
          const SizedBox(height: DukaSpacing.s3),
        ],
        _Tile(
          icon: Icons.settings_outlined,
          label: 'Business settings',
          onTap: () => _soon(context, 'Settings'),
        ),
        const SizedBox(height: DukaSpacing.s3),
        _Tile(
          icon: Icons.people_outline,
          label: 'Members & roles',
          onTap: () => _soon(context, 'Member management'),
        ),

        const SizedBox(height: DukaSpacing.s5),
        const _GroupLabel('App'),
        const SizedBox(height: DukaSpacing.s2),
        _Tile(
          icon: Icons.language,
          label: 'Language',
          subtitle: 'English',
          onTap: () => _soon(context, 'Swahili'),
        ),
        const SizedBox(height: DukaSpacing.s3),
        _Tile(
          icon: Icons.support_agent_outlined,
          label: 'Support & feedback',
          onTap: () => _soon(context, 'In-app support'),
        ),
        const SizedBox(height: DukaSpacing.s3),
        _Tile(
          icon: Icons.palette_outlined,
          label: 'Design system gallery',
          onTap: () => context.push(AppRoute.gallery.path),
        ),

        const SizedBox(height: DukaSpacing.s6),
        NeuButton(
          label: 'Sign out',
          variant: NeuButtonVariant.destructive,
          expand: true,
          onPressed: () => session.signOut(),
        ),
        const SizedBox(height: DukaSpacing.s6),
      ],
    );
  }
}

class _InitialsChip extends StatelessWidget {
  const _InitialsChip({required this.text});
  final String text;

  String get _initials {
    final parts = text.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Container(
      width: 48,
      height: 48,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: t.surfaceSunken,
        borderRadius: BorderRadius.circular(DukaRadius.control),
      ),
      child: Text(
        _initials.isEmpty ? '·' : _initials,
        style: TextStyle(
          color: t.textPrimary,
          fontWeight: FontWeight.w800,
          fontSize: 16,
        ),
      ),
    );
  }
}

class _GroupLabel extends StatelessWidget {
  const _GroupLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(left: DukaSpacing.s2),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          color: t.textDisabled,
          fontWeight: FontWeight.w700,
          fontSize: 12,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
  });
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return NeuBox(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        horizontal: DukaSpacing.s4,
        vertical: DukaSpacing.s4,
      ),
      child: Row(
        children: [
          Icon(icon, color: t.textSecondary, size: 22),
          const SizedBox(width: DukaSpacing.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(color: t.textPrimary, fontSize: 16),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: TextStyle(color: t.textSecondary, fontSize: 12),
                  ),
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: t.textDisabled),
        ],
      ),
    );
  }
}
