---
name: ipf-database
description: Use when implementing local persistence in this Notify Flutter app. Trigger for SQLite or encrypted database setup, feature repositories, schema updates, migrations, and replacing temporary in-memory data with persistent storage.
---

# iPF Database

Use this skill for local database work.

## Repo Rules

- Keep database models and repositories close to the feature unless they are clearly shared.
- Version schema changes deliberately and keep migrations forward-safe.
- Do not mix repository persistence logic into UI or provider classes.
- Prefer one clear repository abstraction per stored entity or aggregate.

## Notify Conventions

- Local persistence may use Hive or SQLite depending on the feature.
- Sensitive local data should use encrypted storage paths where appropriate.
- Any persistence added for a feature should still keep the feature analyzable and testable in isolation.

## When To Read More

- Read `../../../skills/ipf-database.md` when you need the starter-pack `BaseDatabaseManager`, `BaseDatabaseModel`, repository CRUD patterns, or automatic migration behavior.
