---
name: documentation-framework
description: Route documentation work through the canonical workflow contract, enforce source-of-truth layering, bootstrap missing workflow structure, and validate docs policy before completion.
---

# Documentation Framework

Use this skill first for doc updates and planning tasks.

## Canonical Sources

1. `ai/workflow-contract/spec/workflow-spec.md`
2. `ai/workflow-contract/spec/layering-spec.md`
3. `ai/workflow-contract/spec/guardrails-spec.md`
4. `ai/workflow-contract/spec/enforcement-spec.md`
5. `ai/workflow-contract/adapters/<repo>.md` (generate if missing)

## Execution Steps

1. Classify target layer: `design` | `implementation` | `changes/proposed`.
2. Run bootstrap/init when workflow structure is missing:
   - `python3 ai/workflow-contract/scripts/init_workflow_contract.py`
3. Ensure adapter exists for current repo:
   - if missing, create `ai/workflow-contract/adapters/<repo>.md`.
4. Read source-of-truth docs in canonical order.
5. Update only the correct layer.
6. Run mandatory canonical validator:
   - `python3 ai/workflow-contract/scripts/validate_workflow.py`
7. Report and fix validation failures before completion.

## Documentation Tone

Apply the canonical tone from `ai/workflow-contract/README.md` on every doc task:

- optimize for brevity, clarity, and structured output
- remove non-essential wording and repetition
- write direct, precise, execution-oriented prose
- prefer headings, bullets, and short sections over long narrative blocks
