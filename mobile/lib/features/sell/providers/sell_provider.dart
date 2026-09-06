import 'package:pos_mobile/core/network/api_exception.dart';
import 'package:pos_mobile/data/services/sales_service.dart';
import 'package:pos_mobile/models/catalog_models.dart';
import 'package:pos_mobile/models/sale_models.dart';
import 'package:pos_mobile/shared/providers/base_provider.dart';

/// One line in the sell cart.
class CartLine {
  CartLine(this.product, {this.quantity = 1, this.discount = 0});

  final Product product;
  int quantity;
  int discount;

  int get gross => product.sellPrice * quantity;
  int get lineTotal => (gross - discount).clamp(0, gross);
}

/// Sell-screen cart + `POST /sales` submission. One idempotency key per cart
/// version, so a retry of the same cart never double-charges.
class SellProvider extends BaseProvider {
  final List<CartLine> _lines = [];
  String _idempotencyKey = _freshKey();
  Set<String> _insufficient = {};
  Sale? _lastSale;

  List<CartLine> get lines => List.unmodifiable(_lines);
  bool get isEmpty => _lines.isEmpty;

  int get subtotal => _lines.fold(0, (a, l) => a + l.gross);
  int get discountTotal => _lines.fold(0, (a, l) => a + l.discount);
  int get total => _lines.fold(0, (a, l) => a + l.lineTotal);
  String get currency =>
      _lines.isEmpty ? 'TZS' : _lines.first.product.currency;

  /// Product ids the last `422 insufficient_stock` flagged as short.
  Set<String> get insufficientProductIds => _insufficient;
  bool isShort(String productId) => _insufficient.contains(productId);

  /// The sale returned by the most recent successful [submit].
  Sale? get lastSale => _lastSale;

  CartLine? _find(String productId) {
    for (final l in _lines) {
      if (l.product.id == productId) return l;
    }
    return null;
  }

  void addProduct(Product p) {
    final existing = _find(p.id);
    if (existing != null) {
      existing.quantity += 1;
    } else {
      _lines.add(CartLine(p));
    }
    _touch();
  }

  void setQuantity(String productId, int qty) {
    final line = _find(productId);
    if (line == null) return;
    if (qty <= 0) {
      _lines.remove(line);
    } else {
      line.quantity = qty;
    }
    _touch();
  }

  void setDiscount(String productId, int discount) {
    final line = _find(productId);
    if (line == null) return;
    line.discount = discount < 0 ? 0 : discount;
    _touch();
  }

  void remove(String productId) {
    _lines.removeWhere((l) => l.product.id == productId);
    _touch();
  }

  void clear() {
    _lines.clear();
    _insufficient = {};
    _lastSale = null;
    _idempotencyKey = _freshKey();
    notifyListeners();
  }

  /// Submits the cart. Returns the created [Sale] on success, or null — on
  /// failure `error` carries the typed exception and, for
  /// `insufficient_stock`, [insufficientProductIds] names the short lines.
  Future<Sale?> submit(String businessId, {String? customerLabel}) async {
    if (_lines.isEmpty) return null;
    _insufficient = {};
    final sale = await guard(
      () => SalesService.createSale(
        businessId,
        lines: _lines
            .map(
              (l) => SaleLineInput(
                productId: l.product.id,
                quantity: l.quantity,
                discount: l.discount == 0 ? null : l.discount,
              ),
            )
            .toList(),
        customerLabel: customerLabel,
        idempotencyKey: _idempotencyKey,
      ),
    );
    if (sale == null) {
      final e = error;
      if (e is ApiException && e.code == 'insufficient_stock') {
        _insufficient = parseShortfalls(e.details);
        notifyListeners();
      }
      return null;
    }
    _lastSale = sale;
    return sale;
  }

  /// A new idempotency key + cleared shortfall marks whenever the cart changes.
  void _touch() {
    _idempotencyKey = _freshKey();
    _insufficient = {};
    notifyListeners();
  }

  static String _freshKey() =>
      'sell-${DateTime.now().microsecondsSinceEpoch}';

  /// Extract the short product ids from a `422 insufficient_stock` envelope's
  /// `details` — each `issue` is `<product_id>: requested N, available M`.
  static Set<String> parseShortfalls(List<Map<String, dynamic>> details) => details
      .map((d) => (d['issue'] as String? ?? '').split(':').first.trim())
      .where((s) => s.isNotEmpty)
      .toSet();
}
