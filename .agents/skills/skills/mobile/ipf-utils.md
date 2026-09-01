# iPF Flutter Starter Pack — Utils & Services

## Scenery — navigation & toasts

```dart
await Scenery.switchScene(context, Screen());         // push
await Scenery.replaceScene(context, Screen());        // replace
await Scenery.pushUntil(context, Screen());           // removeUntil

Scenery.showToast("Info");
Scenery.showSuccess("Done!");
Scenery.showWarning("Check this");
Scenery.showError("Failed");
Scenery.addPostFrameCallback((_) => provider.load());
```

## AppUtility

```dart
AppUtility.log("debug message");          // no-op in release
bool ok = await AppUtility.networkConnected;
String v = await AppUtility.appVersion;   // "Version 1.0.0 Build 1"
await AppUtility.openUrl("https://...");
await AppUtility.openWhatsApp(phoneNumber: "+255...", message: "Hi");
await AppUtility.openEmail(email: "x@x.com");
await AppUtility.makePhoneCall("+255...");
```

## LocationService

```dart
Position? pos = await LocationService.getCurrentLocation();
// pos.latitude, pos.longitude
```

## Permissions

```dart
bool granted = await Permissions.request(Permission.camera);
bool granted = await Permissions.request(Permission.location);
```

## StorageHelper

```dart
Directory dir = await StarterStorage.storagePath(suffix: "exports");
Directory file = await StarterStorage.storagePath(suffix: "exports", file: "doc.pdf");
```

## ProgressDialog

```dart
ProgressDialog.show(context, message: "Loading...");
ProgressDialog.hide(context);
```

## TextFormatter

```dart
inputFormatters: [TextFormatter.commaSeparated, TextFormatter.maxValue(9999)]
```
