# iPF Flutter Starter Pack — Notifications

## Extend BaseNotificationService

```dart
class AppNotificationService extends BaseNotificationService {
  static final AppNotificationService instance = AppNotificationService._();
  AppNotificationService._() : super("@mipmap/ic_launcher");

  @override
  void selectNotification(BuildContext context, NotificationResponse response) {
    final payload = response.payload;
    // navigate based on payload
  }
}

// main.dart
AppNotificationService.instance.init();
```

## Show notification

```dart
AppNotificationService.instance.showNotification(
  id: 1,
  title: "Title",
  subtitle: "Body text",
);
```

## Schedule notification

```dart
AppNotificationService.instance.setupScheduled(
  id: 100,
  title: "Reminder",
  body: "Don't forget!",
  dateTime: DateTime.now().add(const Duration(hours: 1)),
  payload: "reminder:1",
  // Recurring: matchDateTimeComponents: DateTimeComponents.time (daily)
  //            matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime (weekly)
);
```
