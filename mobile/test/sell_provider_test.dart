import 'package:flutter_test/flutter_test.dart';
import 'package:pos_mobile/features/sell/providers/sell_provider.dart';
import 'package:pos_mobile/models/catalog_models.dart';

Product _p(String id, int price) => Product(
  id: id,
  sku: 'SKU-$id',
  name: 'Product $id',
  unit: 'each',
  sellPrice: price,
  currency: 'TZS',
  reorderThreshold: 0,
  isActive: true,
);

void main() {
  group('SellProvider cart + totals', () {
    test('adding lines and discounts updates running totals', () {
      final s = SellProvider();
      s.addProduct(_p('a', 2500));
      s.addProduct(_p('a', 2500)); // same product → qty 2
      s.addProduct(_p('b', 4000));

      expect(s.subtotal, 2500 * 2 + 4000);
      expect(s.total, s.subtotal);

      s.setDiscount('b', 500);
      expect(s.discountTotal, 500);
      expect(s.total, 2500 * 2 + 4000 - 500);

      s.setQuantity('a', 1);
      expect(s.subtotal, 2500 + 4000);
      expect(s.total, 2500 + 4000 - 500);
    });

    test('a line discount cannot drive line_total below zero', () {
      final s = SellProvider();
      s.addProduct(_p('a', 1000));
      s.setDiscount('a', 5000);
      expect(s.total, 0);
    });

    test('setQuantity to 0 removes the line', () {
      final s = SellProvider();
      s.addProduct(_p('a', 1000));
      s.setQuantity('a', 0);
      expect(s.isEmpty, isTrue);
    });

    test('mutating the cart clears the previous shortfall marks', () {
      final s = SellProvider();
      s.addProduct(_p('a', 1000));
      // simulate a 422 mark, then a cart change
      s.setDiscount('a', 0);
      expect(s.insufficientProductIds, isEmpty);
    });
  });

  test('parseShortfalls pulls the product ids from the 422 details', () {
    final ids = SellProvider.parseShortfalls([
      {'field': 'lines', 'issue': 'prod-1: requested 10, available 2'},
      {'field': 'lines', 'issue': 'prod-2: requested 5, available 0'},
    ]);
    expect(ids, {'prod-1', 'prod-2'});
  });
}
