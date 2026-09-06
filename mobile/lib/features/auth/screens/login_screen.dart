import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/core/app_info.dart';
import 'package:pos_mobile/core/network/api_exception.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/shared/widgets/error_by_code_card.dart';
import 'package:pos_mobile/shared/widgets/neu_button.dart';
import 'package:pos_mobile/shared/widgets/neu_text_field.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  ApiException? _error;
  bool _busy = false;

  @override
  void dispose() {
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
      await context.read<SessionProvider>().signIn(
        _email.text.trim(),
        _password.text,
      );
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
                    AppInfo.name,
                    style: TextStyle(
                      color: t.textPrimary,
                      fontWeight: FontWeight.w800,
                      fontSize: 24,
                    ),
                  ),
                  const SizedBox(height: DukaSpacing.s2),
                  Text(
                    'Sign in to your account.',
                    style: TextStyle(color: t.textSecondary, fontSize: 16),
                  ),
                  const SizedBox(height: DukaSpacing.s6),
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
                  ),
                  const SizedBox(height: DukaSpacing.s5),
                  NeuButton(
                    label: _busy ? 'Signing in…' : 'Sign in',
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
                      onPressed: () => context.push('/register'),
                      child: const Text('New here? Create an account'),
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
