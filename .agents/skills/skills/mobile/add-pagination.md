# Add Pagination — Fetching Lists from the API

Use this skill whenever:
- Fetching a list of items from the API (even a simple, non-paginated list)
- Adding server-side pagination (page + pageSize) and infinite scroll
- Adding keyword search that resets to page 1

**Any API endpoint that returns an array of items should follow the service pattern in Step 1**, even if pagination or search are not needed yet. This keeps all list-fetching consistent and makes it trivial to add pagination or search later without refactoring the service.

## Arguments
`$ARGUMENTS` — feature name and model type, e.g. `<Feature>: <Feature>Model`

---

## Architecture Overview

- **Package:** `easy_scroll_pagination` — provides `OffsetPaginationController<T>` and `PaginatedView`. **Not currently a dependency of `notify`** (not in `pubspec.yaml`/`pubspec.lock`) — no feature uses it yet. Add it to `pubspec.yaml` before following this guide; don't assume it's already available.
- **Flow:** UI scroll event → controller → fetcher callback → service → API
- **Search:** update keyword in provider → call `controller.fetchNext(refresh: true)` → fetches page 1 with new query
- **Where each piece lives** (substitute your own feature name for `<feature>`):
  - Provider: `lib/features/<feature>/providers/<feature>_provider.dart`
  - Service: `lib/features/<feature>/services/<feature>_services.dart`
  - UI: `lib/features/<feature>/widgets/<feature>_list.dart`

---

## Step 1 — Service: add page/pageSize/query params

The API call must accept `page`, `pageSize`, and optional `query`. Always use `currentPage` as the param key (matches backend convention). Only send `q` when non-empty.

```dart
static Future<List<WidgetModel>> fetchAll({int? page, int? pageSize, String? query}) async {
  APIResponse apiResponse = await APIManager.instance.apiAuthGet(
    _Endpoints.fetchAll,
    params: {
      "pageSize": pageSize,
      "currentPage": page,
      if (query?.isNotEmpty ?? false) "q": query,
    },
  );
  apiResponse.raiseOnError();
  apiResponse.log();
  List<dynamic> data = apiResponse.responseBody["data"];
  return List.generate(data.length, (index) => WidgetModel.fromJson(data[index]));
}
```

If the endpoint requires a fixed filter param (e.g. `activeOnly=true`), include it alongside the pagination params — not hardcoded into the URL string.

---

## Step 2 — Provider: controller + queue-guard search

Add these to the provider class. Never put the `OffsetPaginationController` in `initState` of a widget — it belongs in the provider.

```dart
import 'dart:async';
import 'package:easy_scroll_pagination/easy_scroll_pagination.dart';

class WidgetProvider extends BaseProvider with LoggerMixin {
  String _keyword = '';
  bool _searchQueued = false;

  late final OffsetPaginationController<WidgetModel> _controller = OffsetPaginationController(
    limit: 20,
    fetcher: _fetch,
  );

  OffsetPaginationController<WidgetModel> get controller => _controller;

  Future<List<WidgetModel>> _fetch(int page, int limit) async {
    return WidgetService.fetchAll(page: page, pageSize: limit, query: _keyword);
  }

  Future<void> search(String? keyword) async {
    _keyword = keyword?.trim() ?? '';
    if (_controller.isFetching) {
      _searchQueued = true;
      unawaited(_runQueuedSearch());
      return;
    }
    do {
      _searchQueued = false;
      await _controller.fetchNext(refresh: true);   // resets to page 1
    } while (_searchQueued);
    notifyListeners();
  }

  Future<void> _runQueuedSearch() async {
    while (_controller.isFetching) {
      await Future.delayed(const Duration(milliseconds: 100));
    }
    await search(_keyword);
  }
}
```

**Why the queue-guard?** If the user types fast, a new search can arrive while the previous fetch is still in flight. The guard waits for the in-flight fetch to finish, then fires the latest keyword — avoiding race conditions and out-of-order results.

`refresh: true` on `fetchNext` resets the controller back to page 1 with the new keyword.

---

## Step 3 — UI: PaginatedView.list

Wire up the controller in `initState` and hand it to `PaginatedView`. The `initState` fetch must run inside `addPostFrameCallback` so the widget tree is fully built first.

```dart
class _WidgetListState extends State<WidgetList> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.stateRead<WidgetProvider>().controller.fetchNext(refresh: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final WidgetProvider provider = context.stateWatch<WidgetProvider>();

    return RefreshIndicator(
      onRefresh: () => provider.controller.fetchNext(refresh: true),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12.0),
        child: PaginatedView<WidgetModel>.list(
          controller: provider.controller,
          onEmpty: EmptyState(title: <AppStrings>.instance.noItemFound),
          onInitialLoading: _skeletonLoader,
          separatorWidget: const Gap(8),
          onError: EmptyState(title: <AppStrings>.instance.noItemFound),
          itemBuilder: (context, item, index) => WidgetTile(item: item),
          onLoadingMore: const SizedBox(),
        ),
      ),
    );
  }

  Widget get _skeletonLoader => AppSkeletonizer(
    enabled: true,
    child: ListView.separated(
      shrinkWrap: true,
      itemCount: 10,
      padding: const EdgeInsets.only(bottom: kBottomNavigationBarHeight + 24),
      separatorBuilder: (_, __) => const Gap(8),
      itemBuilder: (_, i) => ListTile(
        leading: Container(
          height: 40, width: 40,
          decoration: BoxDecoration(
            color: context.colorScheme.outlineVariant.withAlpha(100),
            borderRadius: BorderRadius.circular(30),
          ),
        ),
        title: Container(height: 16, width: double.infinity, color: context.colorScheme.outlineVariant.withAlpha(100)),
        subtitle: Container(height: 14, width: double.infinity, color: context.colorScheme.outlineVariant.withAlpha(100)),
      ),
    ),
  );
}
```

---

## Step 4 — Wiring search from a screen or top bar

In a screen's search callback, call the provider's `search()` method through a debounce timer. Always pass `null` (not `''`) to clear — the provider normalises it.

```dart
Timer? _searchDebounce;

void _onSearch(String? keyword) {
  _searchDebounce?.cancel();
  if (keyword == null) {
    _search(keyword);    // immediate clear, no debounce
    return;
  }
  _searchDebounce = Timer(const Duration(milliseconds: 350), () {
    _search(keyword);
  });
}

void _search(String? keyword) {
  if (!mounted) return;
  unawaited(context.stateRead<WidgetProvider>().search(keyword));
}
```

**Clearing search (e.g. close button):** call `_onSearch(null)` BEFORE collapsing the search bar and clearing the text controller — this resets the provider's keyword and triggers a full-list reload while the controller is still accessible.

```dart
onPressed: () {
  _onSearch(null);                          // reset provider + pagination
  _searchController.clear();               // clear input field
  homeProvider.clearSearch();              // reset UI state
  FocusScope.of(context).unfocus();
  // collapse bar...
},
```

---

## Search routing by category

When multiple list types share one search bar (e.g. a shared top bar), switch on the active category:

```dart
void _search(String? keyword) {
  if (!mounted) return;
  final HomeProvider homeProvider = context.stateRead();
  switch (homeProvider.category) {
    case HomeCategory.<categoryA>:
      unawaited(context.stateRead<<FeatureA>Provider>().search<FeatureA>(keyword));
    case HomeCategory.<categoryB>:
      unawaited(context.stateRead<<FeatureB>Provider>().search<FeatureB>(keyword));
    case HomeCategory.<categoryC>:
      unawaited(context.stateRead<<FeatureC>Provider>().search<FeatureC>(keyword));
  }
}
```

Each category routes to its own provider's search method — never reuse another category's method (e.g. do not call `<FeatureA>`'s search method for `<FeatureB>`).

---

## Rules

- Always use `currentPage` (not `page`) as the query param key — matches the backend convention used throughout the app.
- Only include `"q": query` when non-empty — use the `if (query?.isNotEmpty ?? false)` guard.
- The controller `limit` is 20 for all current list types — keep it consistent.
- Never call `controller.fetchNext()` without `refresh: true` for search resets — omitting it appends instead of replacing.
- The queue-guard pattern (`isFetching` check + `_runQueuedSearch`) is mandatory for search methods — do not skip it.
- Do not put `OffsetPaginationController` in a widget's `State` — it belongs in the provider so it survives rebuilds.
- Use `onLoadingMore: const SizedBox()` to suppress the default loading spinner at the bottom — current UI uses no visible load-more indicator.
