import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/core/network/api_exception.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/shared/widgets/error_by_code_card.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';
import 'package:pos_mobile/shared/widgets/neu_text_field.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  ApiException? _error;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<SessionProvider>().register(_name.text.trim(), _email.text.trim(), _password.text);
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
    return Scaffold(
      appBar: AppBar(),
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
                    'Create your account',
                    style: TextStyle(
                      color: t.textPrimary,
                      fontWeight: FontWeight.w800,
                      fontSize: 24,
                    ),
                  ),
                  const SizedBox(height: DukaSpacing.s2),
                  Text(
                    "You'll set up your business next.",
                    style: TextStyle(color: t.textSecondary, fontSize: 16),
                  ),
                  const SizedBox(height: DukaSpacing.s6),
                  NeuTextField(label: 'Your name', controller: _name),
                  const SizedBox(height: DukaSpacing.s4),
                  NeuTextField(
                    label: 'Email',
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: DukaSpacing.s4),
                  NeuTextField(
                    label: 'Password',
                    controller: _password,
                    obscureText: true,
                    hint: 'At least 12 characters',
                  ),
                  const SizedBox(height: DukaSpacing.s5),
                  NeuButton(
                    label: _busy ? 'Creating…' : 'Create account',
                    variant: NeuButtonVariant.primary,
                    expand: true,
                    onPressed: _busy ? null : _submit,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: DukaSpacing.s4),
                    ErrorByCodeCard(code: _error!.code, title: _error!.message),
                  ],
                  const SizedBox(height: DukaSpacing.s5),
                  Center(
                    child: TextButton(
                      onPressed: () => context.pop(),
                      child: const Text('Already have an account? Sign in'),
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
