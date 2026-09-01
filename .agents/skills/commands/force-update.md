# Force Update Command

Use this command guide for a generic app-level forced update and optional update flow.

## Config Source

Store update config in a remote source (for example Firestore, REST, or Remote Config):

- `minVersion`: minimum allowed app version (force update)
- `latestVersion`: latest available app version (soft update)
- `updateMessageEn`: English message
- `updateMessageAlt`: secondary locale message (optional)
- Platform overrides (optional):
  - `ios_minVersion`, `ios_latestVersion`
  - `android_minVersion`, `android_latestVersion`

## Decision Rules

- `currentVersion < minVersion` => force update
- `currentVersion < latestVersion` => soft update
- otherwise => no update prompt

## Caching

Recommended defaults:

- Cache `soft` and `none` states for 6 hours
- Do not cache `force` state
- Soft prompt dismissal cool-down: 24 hours

## Required UX Behavior

- Force update screen must be non-dismissable.
- Soft update can be dismissed and should respect cool-down.
- Update actions should open the platform store URL.

## App Integration Points

1. Run update check on app startup.
2. Re-apply localized message after locale changes.
3. Keep prompt logic inside one service class for consistency.

## Testing Checklist

- Test force update by setting `minVersion` above current app version.
- Test soft update by setting `latestVersion` above current app version.
- Verify fallback from platform-specific fields to generic fields.
- Verify cool-down and cache expiry behavior.
