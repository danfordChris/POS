import 'package:flutter/material.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';

/// Inset-well text field. The well recesses into the sunken surface.
class NeuTextField extends StatelessWidget {
  const NeuTextField({
    super.key,
    this.label,
    this.hint,
    this.errorText,
    this.controller,
    this.keyboardType,
    this.obscureText = false,
    this.prefix,
    this.suffix,
    this.onChanged,
  });

  final String? label;
  final String? hint;
  final String? errorText;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final bool obscureText;
  final Widget? prefix;
  final Widget? suffix;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final hasError = errorText != null && errorText!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) ...[
          Text(
            label!,
            style: TextStyle(
              color: t.textSecondary,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: DukaSpacing.s2),
        ],
        DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(DukaRadius.control),
            border: hasError ? Border.all(color: t.danger, width: 1) : null,
          ),
          child: NeuWell(
            padding: const EdgeInsets.symmetric(
              horizontal: DukaSpacing.s4,
              vertical: DukaSpacing.s1,
            ),
            child: Row(
              children: [
                if (prefix != null) ...[
                  DefaultTextStyle.merge(
                    style: TextStyle(color: t.textSecondary),
                    child: prefix!,
                  ),
                  const SizedBox(width: DukaSpacing.s2),
                ],
                Expanded(
                  child: TextField(
                    controller: controller,
                    keyboardType: keyboardType,
                    obscureText: obscureText,
                    onChanged: onChanged,
                    style: TextStyle(color: t.textPrimary, fontSize: 16),
                    cursorColor: t.accent,
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      hintText: hint,
                      hintStyle: TextStyle(color: t.textDisabled, fontSize: 16),
                      contentPadding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
                if (suffix != null) ...[
                  const SizedBox(width: DukaSpacing.s2),
                  suffix!,
                ],
              ],
            ),
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: DukaSpacing.s2),
          Text(errorText!, style: TextStyle(color: t.danger, fontSize: 13)),
        ],
      ],
    );
  }
}
