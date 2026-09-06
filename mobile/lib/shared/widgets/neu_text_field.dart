import 'package:flutter/material.dart';
import 'package:pos_mobile/core/extensions/build_context_extensions.dart';
import 'package:pos_mobile/core/extensions/text_theme_extension.dart';
import 'package:pos_mobile/core/theme/duka_colors.dart';
import 'package:pos_mobile/core/theme/duka_tokens.dart';
import 'package:pos_mobile/core/theme/neu.dart';

class NeuTextField extends StatelessWidget {
  const NeuTextField({
    super.key,
    this.label,
    this.hint,
    this.helperText,
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
  final String? helperText;
  final String? errorText;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final bool obscureText;
  final Widget? prefix;
  final Widget? suffix;
  final ValueChanged<String>? onChanged;

  /// Figma `Container` height for the field row.
  static const double fieldHeight = 32;

  /// Figma `Input` inner padding (paddingLeft/Right 16, paddingTop/Bottom 18).
  static const EdgeInsets _fieldPadding = EdgeInsets.symmetric(
    horizontal: DukaSpacing.s4,
    vertical: 18,
  );

  /// Figma label / helper rows are indented 4dp from the field edge.
  static const EdgeInsets _sideMargin = EdgeInsets.only(left: DukaSpacing.s1);

  @override
  Widget build(BuildContext context) {
    final t = DukaColors.of(context);
    final hasError = errorText != null && errorText!.isNotEmpty;
    final subText = hasError ? errorText! : helperText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) ...[
          Padding(
            padding: _sideMargin,
            child: Text(
              label!,
              style: context.labelMedium.copyWith(
                color: context.colorScheme.onSurface,
              ),
            ),
          ),
          const SizedBox(height: DukaSpacing.s2),
        ],
        DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(DukaRadius.small),
            border: hasError ? Border.all(color: t.danger, width: 1) : null,
          ),
          child: NeuWell(
            padding: _fieldPadding,
            radius: DukaRadius.small,
            child: Row(
              children: [
                if (prefix != null) ...[
                  DefaultTextStyle.merge(
                    style: TextStyle(color: t.textSecondary),
                    child: prefix!,
                  ),
                  const SizedBox(width: DukaSpacing.s3),
                ],
                Expanded(
                  child: TextField(
                    controller: controller,
                    keyboardType: keyboardType,
                    obscureText: obscureText,
                    onChanged: onChanged,
                    style: TextStyle(
                      color: t.textPrimary,
                      fontSize: 14,
                      height: 21 / 14,
                    ),
                    cursorColor: t.accent,
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      hintText: hint,
                      hintStyle: TextStyle(
                        color: t.textDisabled,
                        fontSize: 14,
                        height: 21 / 14,
                      ),
                      contentPadding: EdgeInsets.zero,
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
        if (subText != null && subText.isNotEmpty) ...[
          const SizedBox(height: DukaSpacing.s1),
          Padding(
            padding: _sideMargin,
            child: Text(
              subText,
              style: TextStyle(
                color: hasError ? t.danger : t.textSecondary,
                fontSize: 10,
                height: 14 / 10,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
