// Winger portal shapes. The catalog response is a fixed whitelist — no
// quantity, cost, or SKU is ever sent to a winger.

class WingerBusiness {
  WingerBusiness({required this.businessId, required this.businessName});

  final String businessId;
  final String businessName;

  factory WingerBusiness.fromJson(Map<String, dynamic> j) => WingerBusiness(
    businessId: j['business_id'] as String,
    businessName: (j['business_name'] as String?) ?? '',
  );
}

class WingerProduct {
  WingerProduct({
    required this.name,
    required this.price,
    required this.currency,
    required this.inStock,
    this.imageUrl,
  });

  final String name;
  final String? imageUrl;
  final int price;
  final String currency;
  final bool inStock;

  factory WingerProduct.fromJson(Map<String, dynamic> j) => WingerProduct(
    name: (j['name'] as String?) ?? '',
    imageUrl: j['image_url'] as String?,
    price: (j['price'] as num?)?.toInt() ?? 0,
    currency: (j['currency'] as String?) ?? 'TZS',
    inStock: j['in_stock'] as bool? ?? false,
  );
}
