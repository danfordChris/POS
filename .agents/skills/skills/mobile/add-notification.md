# Add Notification — Handle a New Push Notification Type

Use this skill to register and handle a new push notification type in the app.

## Arguments
`$ARGUMENTS` — notification type name and the action it should trigger, e.g. `<feature>Alert: navigate to <feature> details screen with <feature>Id`

---

## Notification Architecture

| File | Role |
|---|---|
| `lib/services/notifications/enum/notification_type.dart` | `NotificationType` enum — one value per type |
| `lib/services/notifications/notification_payload.dart` | `NotificationPayload` model parsed from FCM data |
| `lib/services/notifications/notification_service.dart` | FCM setup, foreground/background handlers |
| `lib/services/notifications/notification_action_controller.dart` | Routes notification tap to the correct screen |

---

## Step 1 — Add Enum Value to `NotificationType`

Open `lib/services/notifications/enum/notification_type.dart`:

```dart
enum NotificationType {
  // ... existing values ...
  <feature>Alert(7);  // integer must match the value sent by the backend

  final int id;
  const NotificationType(this.id);

  static NotificationType fromId(int id) => NotificationType.values.firstWhere(
        (e) => e.id == id,
        orElse: () => NotificationType.general,
      );
}
```

---

## Step 2 — Parse Payload in `NotificationPayload`

Open `lib/services/notifications/notification_payload.dart`. The payload model parses the FCM `data` map.

If the new type carries extra data (e.g., `<feature>Id`), add a field:

```dart
class NotificationPayload {
  // existing fields...
  final int? <feature>Id;

  NotificationPayload.fromJson(Map<String, dynamic> data)
    : // existing assignments...
      <feature>Id = BaseModel.castToInt(data['<feature>Id']);
}
```

---

## Step 3 — Handle the Action in `NotificationActionController`

Open `lib/services/notifications/notification_action_controller.dart`.

Add a case for the new type in the `handle` (or equivalent) method:

```dart
case NotificationType.<feature>Alert:
  if (payload.<feature>Id != null) {
    NavigationKeys.root.currentContext?.push(
      AppRoute.<feature>Details.path.replaceFirst(
        ':<feature>Id', '${payload.<feature>Id}',
      ),
    );
  }
  break;
```

---

## Step 4 — Store Notification in DB (Optional)

If notifications are persisted locally (via `NotificationModel`), no extra work is needed — the existing `notification_service.dart` saves all incoming FCM messages to the `notification` table automatically.

Retrieve stored notifications via `NotificationRepository.instance.all`.

---

## Step 5 — Display In-App Notification

For foreground notifications, the service shows a local notification banner. No extra setup needed if the type is already registered in `NotificationType`.

To show a custom in-app widget on foreground receipt:
```dart
// In notification_service.dart foreground handler, add a case:
case NotificationType.<feature>Alert:
  AppAlert.show(
    payload.title ?? <AppStrings>.instance.notification<Feature>Alert,
    type: AlertType.info,
  );
  break;
```

---

## Checklist

- [ ] `NotificationType` enum value added with correct backend integer ID
- [ ] `NotificationPayload` updated if new fields are needed
- [ ] `NotificationActionController` routes the new type to the correct screen
- [ ] Route exists in `AppRoute` for the target screen
- [ ] L10n key added for the notification message if shown as in-app alert
