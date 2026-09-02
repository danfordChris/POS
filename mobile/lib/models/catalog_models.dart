class Product {
  Product({
    required this.id,
    required this.sku,
    required this.name,
    this.description,
    this.categoryId,
    required this.unit,
    this.imageUrl,
    required this.sellPrice,
    this.wingerPrice,
    required this.currency,
    required this.reorderThreshold,
    this.code,
    required this.isActive,
    this.costPrice,
  });

  final String id;
  final String sku;
  final String name;
  final String? description;
  final String? categoryId;
  final String unit;
  final String? imageUrl;
  final int sellPrice;
  final int? wingerPrice;
  final String currency;
  final int reorderThreshold;
  final String? code;
  final bool isActive;

  /// Owner only.
  final int? costPrice;

  factory Product.fromJson(Map<String, dynamic> j) => Product(
    id: j['id'] as String,
    sku: j['sku'] as String,
    name: j['name'] as String,
    description: j['description'] as String?,
    categoryId: j['category_id'] as String?,
    unit: (j['unit'] as String?) ?? 'each',
    imageUrl: j['image_url'] as String?,
    sellPrice: (j['sell_price'] as num?)?.toInt() ?? 0,
    wingerPrice: (j['winger_price'] as num?)?.toInt(),
    currency: (j['currency'] as String?) ?? 'TZS',
    reorderThreshold: (j['reorder_threshold'] as num?)?.toInt() ?? 0,
    code: j['code'] as String?,
    isActive: (j['is_active'] as bool?) ?? true,
    costPrice: (j['cost_price'] as num?)?.toInt(),
  );
}

class Category {
  Category({required this.id, required this.name});
  final String id;
  final String name;

  factory Category.fromJson(Map<String, dynamic> j) =>
      Category(id: j['id'] as String, name: j['name'] as String);
}

class StockItem {
  StockItem({
    required this.productId,
    required this.onHand,
    required this.reorderThreshold,
    required this.lowStock,
  });
  final String productId;
  final int onHand;
  final int reorderThreshold;
  final bool lowStock;

  factory StockItem.fromJson(Map<String, dynamic> j) => StockItem(
    productId: j['product_id'] as String,
    onHand: (j['on_hand'] as num?)?.toInt() ?? 0,
    reorderThreshold: (j['reorder_threshold'] as num?)?.toInt() ?? 0,
    lowStock: (j['low_stock'] as bool?) ?? false,
  );
}

class StockMovement {
  StockMovement({
    required this.id,
    required this.productId,
    required this.type,
    required this.quantityDelta,
    this.reason,
    required this.createdAt,
  });
  final String id;
  final String productId;
  final String type;
  final int quantityDelta;
  final String? reason;
  final DateTime createdAt;

  factory StockMovement.fromJson(Map<String, dynamic> j) => StockMovement(
    id: j['id'] as String,
    productId: j['product_id'] as String,
    type: j['type'] as String,
    quantityDelta: (j['quantity_delta'] as num).toInt(),
    reason: j['reason'] as String?,
    createdAt:
        DateTime.tryParse(j['created_at'] as String? ?? '') ?? DateTime.now(),
  );
}

class Paged<T> {
  Paged(this.data, this.nextCursor);
  final List<T> data;
  final String? nextCursor;

  factory Paged.fromJson(
    Map<String, dynamic> j,
    T Function(Map<String, dynamic>) item,
  ) => Paged(
    ((j['data'] as List?) ?? [])
        .map((e) => item(e as Map<String, dynamic>))
        .toList(),
    j['next_cursor'] as String?,
  );
}

const _zeroDecimal = {'TZS', 'UGX', 'KES', 'RWF', 'JPY'};

String formatMoney(int minor, String currency) {
  final value = _zeroDecimal.contains(currency) ? minor : minor / 100;
  return '$currency ${value.toString()}';
}
