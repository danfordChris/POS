# Live Activity Command

Use this command guide for iOS Live Activities (Lock Screen / Dynamic Island) in a generic app.

## Architecture

- Flutter service layer maps domain state to activity payload.
- MethodChannel bridges Flutter and iOS native code.
- iOS ActivityKit layer handles start/update/end lifecycle.

## Required Files (Typical)

- `lib/services/live_activity_service.dart`
- `ios/LiveActivityManager.swift`
- `ios/<WidgetExtension>/...LiveActivity.swift`
- `ios/<WidgetExtension>/...Attributes.swift`
- `ios/Runner/Info.plist` with `NSSupportsLiveActivities=true`

## Channel Contract

Use stable method names:

- `startActivity`
- `updateActivity`
- `endActivity`

## Payload Guidance

Include only stable keys used by the widget UI, for example:

- `activityId`
- `title`
- `subtitle`
- `status`
- `eta`
- `progress`

## Lifecycle Rules

- Start when the tracked process becomes active.
- Update on state changes.
- End on completed/cancelled/failed terminal states.
- Clean up stale activities on app launch.

## Testing Notes

- Live Activities require physical iOS device (iOS 16.1+).
- Keep native logs for channel calls (`start/update/end`) to debug mismatches.
