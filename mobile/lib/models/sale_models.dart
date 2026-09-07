// Shapes for the `sales` service (`/v1/businesses/{id}/sales`).

import 'package:pos_mobile/models/invoice_models.dart' show SaleInvoiceRef;

/// One cart line submitted to `POST /sales`.
class SaleLineInput {
  const SaleLineInput({
    required this.productId,
    required this.quantity,
    this.unitPrice,
    this.discount,
  });

  final String productId;
  final int quantity;

  /// Minor units. Omit to let the server use the cached catalog price.
  final int? unitPrice;

  /// Minor units off this line.
  final int? discount;

  Map<String, dynamic> toJson() => {
    'product_id': productId,
    'quantity': quantity,
    if (unitPrice != null) 'unit_price': unitPrice,
    if (discount != null && discount != 0) 'discount': discount,
  };
}

class SaleLine {
  const SaleLine({
    required this.productId,
    required this.name,
    required this.unitPrice,
    required this.quantity,
    required this.discount,
    required this.lineTotal,
  });

  final String productId;
  final String name;
  final int unitPrice;
  final int quantity;
  final int discount;
  final int lineTotal;

  factory SaleLine.fromJson(Map<String, dynamic> j) => SaleLine(
    productId: j['product_id'] as String,
    name: j['name'] as String,
    unitPrice: (j['unit_price'] as num).toInt(),
    quantity: (j['quantity'] as num).toInt(),
    discount: (j['discount'] as num?)?.toInt() ?? 0,
    lineTotal: (j['line_total'] as num).toInt(),
  );
}

class Receipt {
  const Receipt({required this.publicToken, required this.status});
  final String publicToken;
  final String status;

  factory Receipt.fromJson(Map<String, dynamic> j) => Receipt(
    publicToken: j['public_token'] as String,
    status: (j['status'] as String?) ?? 'issued',
  );
}

class Sale {
  const Sale({
    required this.id,
    required this.number,
    required this.status,
    required this.subtotal,
    required this.discountTotal,
    required this.total,
    required this.currency,
    required this.createdAt,
    this.customerLabel,
    this.voidedAt,
    this.lines = const [],
    this.receipt,
    this.invoice,
  });

  final String id;
  final int number;
  final String status;
  final int subtotal;
  final int discountTotal;
  final int total;
  final String currency;
  final DateTime createdAt;
  final String? customerLabel;
  final DateTime? voidedAt;
  final List<SaleLine> lines;
  final Receipt? receipt;

  /// Present when the sale was rung up on `credit` terms (T-0603).
  final SaleInvoiceRef? invoice;

  factory Sale.fromJson(Map<String, dynamic> j) => Sale(
    id: j['id'] as String,
    number: (j['number'] as num).toInt(),
    status: j['status'] as String,
    subtotal: (j['subtotal'] as num).toInt(),
    discountTotal: (j['discount_total'] as num).toInt(),
    total: (j['total'] as num).toInt(),
    currency: (j['currency'] as String?) ?? 'TZS',
    createdAt:
        DateTime.tryParse(j['created_at'] as String? ?? '') ?? DateTime.now(),
    customerLabel: j['customer_label'] as String?,
    voidedAt: (j['voided_at'] as String?) != null
        ? DateTime.tryParse(j['voided_at'] as String)
        : null,
    lines: ((j['lines'] as List?) ?? [])
        .map((e) => SaleLine.fromJson(e as Map<String, dynamic>))
        .toList(),
    receipt: (j['receipt'] as Map<String, dynamic>?) != null
        ? Receipt.fromJson(j['receipt'] as Map<String, dynamic>)
        : null,
    invoice: (j['invoice'] as Map<String, dynamic>?) != null
        ? SaleInvoiceRef.fromJson(j['invoice'] as Map<String, dynamic>)
        : null,
  );
}
