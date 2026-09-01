---
name: ipf-codegen
description: Use when generating or regenerating repetitive Flutter code in this Notify app. Trigger for starter-pack model generation, repository scaffolding, build_runner execution, and deterministic generation workflows that should not be handwritten repeatedly.
---

# iPF Codegen

Use this skill when generation is cheaper and safer than manual repetition.

## Repo Rules

- Prefer generated code for repetitive model or repository boilerplate.
- Keep generator entry points or scripts checked into the repo when they are part of the intended workflow.
- Review generated output before wiring it into screens or providers.
- Avoid introducing generated files that the current repo cannot rebuild.

## Notify Conventions

- Generated code should still follow the feature-first module layout.
- Keep manual edits out of generated surfaces unless the generation workflow explicitly supports them.

## When To Read More

- Read `../../../skills/ipf-codegen.md` when you need the starter-pack model generator, repository generator, or `build_runner` usage patterns.
