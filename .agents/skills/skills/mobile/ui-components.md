### UI Components Documentation

`notify` has a library of shared, reusable widgets in `lib/shared/widgets/`, with the core design-system catalog (59 widgets as of this pass) under `lib/shared/widgets/repo/`. These components ensure UI consistency and speed up development. See `docs/design/architecture/componentization.md` for the shared-vs-feature-local placement rule.

#### AppButton

`AppButton` is the primary button widget with multiple variants.

**Variants**: `primary`, `secondary`, `tertiary`, `outline`, `surface`, `text`, `success`, `destructive`, `red`, `glass`, `glassIcon`.

**Usage**:
```dart
AppButton(
  title: 'Next',
  onPressed: () => print('Button pressed'),
  variant: AppButtonVariant.primary,
  loading: false,
)

// Using named constructors
AppButton.outline(
  title: 'Cancel',
  onPressed: () => context.pop(),
)
```

#### InputField

`InputField` handles all forms of user input including text, phone numbers, PINs, and dropdowns.

**Variants**: `standard`, `glass`, `phone`, `pin`, `dropdown`.

**Usage**:
```dart
// Standard text input
InputField(
  controller: _nameController,
  labelText: 'Full Name',
  hintText: 'Enter your name',
  validator: (val) => val!.isEmpty ? 'Required' : null,
)

// Dropdown input
InputField.dropdown<String>(
  items: ['Option 1', 'Option 2'],
  onChanged: (val) => print(val),
  labelText: 'Select Option',
)

// Phone number input (uses intl_phone_number_input)
InputField.phone(
  onChanged: (phone) => print(phone.phoneNumber),
  labelText: 'Phone Number',
)
```

#### AppTile

`AppTile` is used for list items, settings, or menu entries.

**Usage**:
```dart
AppTile(
  title: 'Personal Details',
  leading: Icon(SolarLinearIcons.user),
  onTap: () => context.push(AppRoute.personalDetails.path),
  trailing: Icon(SolarLinearIcons.altArrowRight),
)
```

#### Loading & Shimmer

The app uses `Skeletonizer` for shimmer effects and custom loading indicators.

- **AppSkeletonizer**: Wraps a widget to show a skeleton loading state.
- **LoadingIndicator**: A standard circular progress indicator themed for the app.

#### Animations

Common animations are available as wrappers:
- **ScaleUpAnimation**: Scales up the child widget.
- **SlideUpAnimation**: Slides the child widget from bottom to top.

#### Guidelines for UI Components

1. **Use Shared Widgets**: Always prefer using widgets from `lib/shared/widgets/` over standard Flutter material widgets to maintain the app's design language.
2. **Follow Theming**: Components are designed to respect the `AppTheme`. Avoid hardcoding colors; use `context.colorScheme` or `context.textTheme`.
3. **Handle States**: Ensure widgets handle `loading`, `disabled`, and `error` states where applicable.
