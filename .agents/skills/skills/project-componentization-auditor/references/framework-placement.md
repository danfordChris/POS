# Framework Placement

Use the relevant section for the current codebase. Do not load unrelated sections unless the project is genuinely multi-stack.

## Flutter

- Inspect `lib/features/<feature>/` and the existing shared layer before adding anything new.
- Put app-wide reusable widgets in the repo's established shared location, commonly `lib/shared/widgets/`, `lib/shared/widgets/repo/`, or `lib/core/widgets/`.
- Keep feature-specific compositions in `lib/features/<feature>/widgets/`.
- Preserve Provider, Riverpod, Bloc, or other state ownership exactly as implemented.
- Keep theme tokens in their current source of truth; do not duplicate color or spacing constants into widget files.
- When variants affect layout or visuals only, model them in widget props. When variants change state orchestration, keep orchestration outside the shared widget.

## React

- Inspect the app structure first: `src/components`, `src/features`, `app`, `pages`, `ui`, or design-system folders.
- Put cross-feature reusable components in the established shared component layer.
- Keep route-specific compositions close to the route or feature.
- Preserve existing state boundaries between local state, context, store hooks, and server data hooks.
- Reuse the current token system: CSS variables, Tailwind tokens, theme objects, design tokens, or component library primitives.
- Avoid inventing a new design-system wrapper unless the repo already uses one.

## SwiftUI

- Inspect shared `Views`, `Components`, `DesignSystem`, or feature modules before extracting anything.
- Put reusable visual components in the shared view layer the project already uses.
- Keep feature flow coordination in feature-specific view models or coordinators.
- Preserve bindings, environment objects, navigation destinations, transitions, and animation semantics.
- Keep colors, spacing, typography, and materials sourced from the existing theme or design tokens.

## Generic Frontend

- Follow the project's current architecture instead of imposing a new one.
- Shared/global/common should mean "reused across multiple features with a stable contract", not merely "looks similar once".
- Prefer extending an existing shared primitive over creating parallel abstractions.
- If the project has no shared layer, create the minimal one that matches the current structure and document that choice in the plan and final report.
