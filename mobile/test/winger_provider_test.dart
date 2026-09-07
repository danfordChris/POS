import 'package:flutter_test/flutter_test.dart';
import 'package:pos_mobile/data/services/winger_service.dart';
import 'package:pos_mobile/features/winger/providers/winger_provider.dart';
import 'package:pos_mobile/models/catalog_models.dart' show Paged;
import 'package:pos_mobile/models/winger_models.dart';

class _FakeWingerApi implements WingerApi {
  _FakeWingerApi(this.pages);

  /// businessId -> list of pages, each `(items, nextCursor)`.
  final Map<String, List<(List<WingerProduct>, String?)>> pages;
  final List<String> productCalls = [];

  @override
  Future<List<WingerBusiness>> listBusinesses() async => [
    WingerBusiness(businessId: 'b1', businessName: 'Alpha'),
    WingerBusiness(businessId: 'b2', businessName: 'Beta'),
  ];

  @override
  Future<Paged<WingerProduct>> listProducts(
    String businessId, {
    String? cursor,
  }) async {
    productCalls.add('$businessId:${cursor ?? '-'}');
    final seq = pages[businessId]!;
    final idx = cursor == null ? 0 : int.parse(cursor);
    final (items, next) = seq[idx];
    return Paged(items, next);
  }
}

WingerProduct _p(String name) => WingerProduct(
  name: name,
  price: 1000,
  currency: 'TZS',
  inStock: true,
);

void main() {
  test('load picks the first business and its first page', () async {
    final api = _FakeWingerApi({
      'b1': [
        ([_p('a'), _p('b')], null),
      ],
      'b2': [
        ([_p('x')], null),
      ],
    });
    final p = WingerProvider(api: api);
    await p.load();

    expect(p.selectedBusinessId, 'b1');
    expect(p.products.map((e) => e.name), ['a', 'b']);
    expect(p.hasMore, isFalse);
  });

  test('selectBusiness swaps the catalog', () async {
    final api = _FakeWingerApi({
      'b1': [
        ([_p('a')], null),
      ],
      'b2': [
        ([_p('x'), _p('y')], null),
      ],
    });
    final p = WingerProvider(api: api);
    await p.load();
    await p.selectBusiness('b2');

    expect(p.selectedBusinessId, 'b2');
    expect(p.products.map((e) => e.name), ['x', 'y']);
  });

  test('loadMore appends the next page using the cursor', () async {
    final api = _FakeWingerApi({
      'b1': [
        ([_p('a')], '1'),
        ([_p('b')], null),
      ],
      'b2': [
        ([_p('x')], null),
      ],
    });
    final p = WingerProvider(api: api);
    await p.load();
    expect(p.hasMore, isTrue);

    await p.loadMore();
    expect(p.products.map((e) => e.name), ['a', 'b']);
    expect(p.hasMore, isFalse);
    expect(api.productCalls, ['b1:-', 'b1:1']);
  });

  test('selecting the already-selected business is a no-op', () async {
    final api = _FakeWingerApi({
      'b1': [
        ([_p('a')], null),
      ],
      'b2': [
        ([_p('x')], null),
      ],
    });
    final p = WingerProvider(api: api);
    await p.load();
    await p.selectBusiness('b1');
    expect(api.productCalls, ['b1:-']); // no second fetch
  });
}
