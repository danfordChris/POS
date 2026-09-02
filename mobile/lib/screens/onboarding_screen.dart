import 'package:flutter/material.dart';
import '../app/session_scope.dart';
import '../data/api_exception.dart';
import '../theme/duka_colors.dart';
import '../theme/duka_tokens.dart';
import '../widgets/error_by_code_card.dart';
import '../widgets/neu_button.dart';
import '../widgets/neu_text_field.dart';
import '../widgets/segmented_neu.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _name = TextEditingController();
  String _currency = 'TZS';
  ApiException? _error;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.of(
        context,
      ).createBusiness(_name.text.trim(), _currency);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } catch (_) {
      if (mounted) setState(() => _error = ApiException.network());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final session = SessionScope.of(context);
    final firstName = (session.user?.name ?? '').split(' ').first;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(DukaSpacing.s5),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Set up your business',
                    style: TextStyle(
                      color: t.textPrimary,
                      fontWeight: FontWeight.w800,
                      fontSize: 24,
                    ),
                  ),
                  const SizedBox(height: DukaSpacing.s2),
                  Text(
                    '${firstName.isEmpty ? 'Welcome' : 'Welcome, $firstName'}. '
                    "Name your shop — you'll be the Owner.",
                    style: TextStyle(color: t.textSecondary, fontSize: 16),
                  ),
                  const SizedBox(height: DukaSpacing.s6),
                  NeuTextField(
                    label: 'Business name',
                    controller: _name,
                    hint: 'Duka la Asha',
                  ),
                  const SizedBox(height: DukaSpacing.s4),
                  Text(
                    'Currency',
                    style: TextStyle(
                      color: t.textSecondary,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: DukaSpacing.s2),
                  SegmentedNeu<String>(
                    semanticLabel: 'Currency',
                    options: const [
                      SegmentedOption('TZS', 'TZS'),
                      SegmentedOption('KES', 'KES'),
                      SegmentedOption('UGX', 'UGX'),
                    ],
                    value: _currency,
                    onChanged: (c) => setState(() => _currency = c),
                  ),
                  const SizedBox(height: DukaSpacing.s5),
                  NeuButton(
                    label: _busy ? 'Creating…' : 'Create business',
                    variant: NeuButtonVariant.primary,
                    expand: true,
                    onPressed: _busy ? null : _submit,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: DukaSpacing.s4),
                    ErrorByCodeCard(code: _error!.code, title: _error!.message),
                  ],
                  const SizedBox(height: DukaSpacing.s4),
                  Center(
                    child: TextButton(
                      onPressed: _busy ? null : () => session.signOut(),
                      child: const Text('Sign out'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
