---
name: project-componentization-auditor
description: Use when a user wants to componentize a software project, extract reusable widgets/components, remove duplicate UI, analyze design redundancy across features, or enforce design consistency without redesigning. Trigger for Flutter, React, SwiftUI, and similar frontend refactors that must preserve the existing design and behavior exactly while moving repeated patterns into shared/global components.
---

# Project Componentization Auditor

## Overview

Use this skill to audit an existing UI codebase, identify genuinely repeated patterns, and refactor them into shared components without changing the visual design or runtime behavior.

This skill is for production refactors, not redesigns. Preserve the current UI exactly unless the user explicitly asks for design changes.

## Non-Negotiables

- Never assume. Ask when project structure, design intent, component behavior, naming, or reuse boundaries are unclear.
- Never recreate the design.
- Never invent new UI.
- Always inspect the full project context before refactoring.
- Always write a clear implementation plan before editing.
- Complete the componentization end to end; do not stop after partial extraction.
- Preserve routing, state management, validation, animations, responsiveness, accessibility, and side effects.
- Extract only patterns that are truly reusable across multiple screens, features, or states.
- Support variants through parameters, enums, configuration objects, slots, or composition instead of forking nearly identical components.
- Migrate all affected call sites to the shared component before deleting duplicates.
- Run analysis, implementation, formatting, linting, and tests/build checks where available.

## When To Trigger

Trigger this skill when the user asks to:

- componentize a project
- extract reusable widgets or components
- remove duplicate UI
- refactor Flutter, React, SwiftUI, or frontend components
- create shared, global, or common widgets/components
- make an app production-ready through reusable components
- analyze UI redundancy across features
- enforce design consistency without redesigning

## Workflow

### 1. Discover The Real Surface Area

Inspect the project before proposing abstractions.

- Identify the framework, architecture, routing, state approach, and design-token sources.
- Map features, screens, subviews, and reusable layers already present.
- Find repeated layouts, cards, headers, list rows, form sections, buttons, chips, empty states, shells, and modal patterns.
- Compare not just visuals, but behavior: validation, interaction states, async loading, disabled states, animation, and responsive rules.
- Record where patterns are identical, where they are similar with variants, and where they only look similar but should stay separate.

If the project structure or intended shared layer is unclear, ask before editing.

For placement guidance by stack, read `references/framework-placement.md`.

### 2. Build A Componentization Plan

Write the plan before changing files.

The plan should include:

1. Candidate repeated patterns with all current file locations.
2. Why each candidate is genuinely reusable.
3. What the shared abstraction will be called.
4. Which props, variants, slots, enums, or config objects are required.
5. Where the shared component belongs in the architecture.
6. Migration order across all affected features.
7. Validation steps after each migration wave.

Do not extract a shared component when:

- only one screen uses it
- the shared API would be more complex than the duplication
- two flows differ in behavior or semantics in ways that would create a misleading abstraction

### 3. Define The Shared API From Existing Reality

Base the API on the current implementation, not an imagined design system.

- Preserve existing spacing, colors, typography, radius, borders, alignment, and sizing.
- Preserve current DOM/widget hierarchy when it affects layout or behavior.
- Preserve event contracts and state ownership boundaries.
- Prefer additive parameters over hidden defaults that mask real variants.
- Prefer composition when sections differ structurally.
- Keep names descriptive and aligned with project terminology.

### 4. Implement In Small Safe Steps

Use this order:

1. Create or extend the shared component in the correct shared/common/global layer.
2. Migrate one representative usage first.
3. Verify the migrated screen matches the previous behavior exactly.
4. Migrate the remaining usages.
5. Remove superseded duplicate implementations only after replacements are stable.

Inspect surrounding code before every edit so you do not break feature-specific state, navigation, or validation.

### 5. Validate Thoroughly

Run the strongest checks available:

- formatter
- linter
- tests
- typecheck or analyzer
- build or compile checks

If visual verification is possible, compare before/after states for:

- default state
- loading state
- error state
- empty state
- filled or success state
- mobile/tablet/desktop breakpoints where applicable

If checks are unavailable, say so explicitly in the final report.

### 6. Deliver A Final Audit Report

End with a concise report that covers:

- what was extracted
- the new shared component locations
- all migrated call sites
- props or variants introduced
- duplicate implementations removed
- validations run
- remaining non-extracted duplicates and why they were left alone

Use `references/report-template.md` when a concrete report structure helps.

## Refactoring Heuristics

- Extract containers, section shells, rows, buttons, badges, and form fields only when repeated structure and behavior are stable.
- Keep business-specific composition in the feature layer even when it uses shared primitives.
- If multiple screens share a skeleton but not the content model, extract the shell and keep content injection local.
- If colors or spacing differ intentionally, model them as explicit variants only when the visual language is still one family.
- If a repeated pattern already exists in shared code, extend that component first instead of creating a second abstraction.

## Questions To Ask When Unclear

Ask concise questions when any of these are unresolved:

- Which layer should own shared components in this repo?
- Are visually similar patterns expected to remain distinct for product reasons?
- Is an existing shared component considered canonical even if current usages diverge?
- Should this refactor preserve exact naming or can shared APIs be renamed for clarity?
- Are there screens, states, or breakpoints not obvious from the code that must remain unchanged?

## References

- Read `references/framework-placement.md` for Flutter, React, SwiftUI, and generic placement guidance.
- Read `references/report-template.md` when you need a reusable structure for the final audit summary.
