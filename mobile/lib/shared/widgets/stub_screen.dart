import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';

/// Placeholder for a screen whose UI ships in a later Phase 02 task.
class StubScreen extends StatelessWidget {
  const StubScreen({
    super.key,
    required this.title,
    required this.task,
    this.blurb,
  });

  final String title;
  final String task;
  final String? blurb;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    return ListView(
      padding: const EdgeInsets.all(DukaSpacing.s5),
      children: [
        Text(
          title,
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
              Text(
                'Coming soon',
                style: TextStyle(
                  color: t.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                ),
              ),
              const SizedBox(height: DukaSpacing.s2),
              Text(
                blurb ??
                    'The app shell, auth, and navigation are in place. This '
                        'screen is built in $task.',
                style: TextStyle(color: t.textSecondary, fontSize: 16),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
