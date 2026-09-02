import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final session = context.read<SessionProvider>();

    return ListView(
      padding: const EdgeInsets.all(DukaSpacing.s5),
      children: [
        Text(
          'More',
          style: TextStyle(
            color: t.textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 28,
          ),
        ),
        const SizedBox(height: DukaSpacing.s4),
        NeuBox(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Row(
                label: session.user?.name ?? 'Account',
                sub: session.user?.email ?? session.user?.phone ?? '',
              ),
              const Divider(height: DukaSpacing.s6),
              _Row(
                label: 'Business',
                sub:
                    '${session.businessName ?? '—'}  ·  ${session.role ?? '—'}',
              ),
            ],
          ),
        ),
        const SizedBox(height: DukaSpacing.s4),
        _LinkTile(
          icon: Icons.palette_outlined,
          label: 'Design system gallery',
          onTap: () => context.push('/more/gallery'),
        ),
        const SizedBox(height: DukaSpacing.s5),
        NeuButton(
          label: 'Sign out',
          variant: NeuButtonVariant.destructive,
          expand: true,
          onPressed: () => session.signOut(),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.sub});
  final String label;
  final String sub;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: t.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 16,
          ),
        ),
        if (sub.isNotEmpty)
          Text(sub, style: TextStyle(color: t.textSecondary, fontSize: 14)),
      ],
    );
  }
}

class _LinkTile extends StatelessWidget {
  const _LinkTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
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
            child: Text(
              label,
              style: TextStyle(color: t.textPrimary, fontSize: 16),
            ),
          ),
          Icon(Icons.chevron_right, color: t.textDisabled),
        ],
      ),
    );
  }
}
