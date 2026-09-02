import 'package:flutter/foundation.dart';

/// Base for every feature provider. Adds shared busy/error plumbing so screens
/// can render loading + error-by-code states without each provider re-inventing
/// the flags.
///
/// This repo has no `ipf_flutter_starter_pack`, so `BaseProvider` is implemented
/// locally (the skill files describe the starter-pack version).
abstract class BaseProvider extends ChangeNotifier {
  bool _busy = false;
  Object? _error;

  bool get isBusy => _busy;

  /// The last error thrown by a [guard]ed call, cleared on the next call.
  Object? get error => _error;

  @protected
  void setBusy(bool value) {
    if (_busy == value) return;
    _busy = value;
    notifyListeners();
  }

  /// Runs [action] with busy=true, capturing any error into [error]. Returns the
  /// action's result, or null if it threw. Always resets busy in `finally`.
  @protected
  Future<T?> guard<T>(Future<T> Function() action) async {
    _error = null;
    setBusy(true);
    try {
      return await action();
    } catch (e) {
      _error = e;
      return null;
    } finally {
      setBusy(false);
    }
  }
}
