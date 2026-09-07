// Shapes for the `sales` invoicing endpoints
// (`/v1/businesses/{id}/customers` and `/v1/businesses/{id}/invoices`).

class Customer {
  const Customer({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    this.address,
    this.taxId,
    this.outstandingBalance = 0,
    this.disabled = false,
  });

  final String id;
  final String name;
  final String? phone;
  final String? email;
  final String? address;
  final String? taxId;
  final int outstandingBalance;
  final bool disabled;

  factory Customer.fromJson(Map<String, dynamic> j) => Customer(
    id: j['id'] as String,
    name: j['name'] as String,
    phone: j['phone'] as String?,
    email: j['email'] as String?,
    address: j['address'] as String?,
    taxId: j['tax_id'] as String?,
    outstandingBalance: (j['outstanding_balance'] as num?)?.toInt() ?? 0,
    disabled: j['disabled'] as bool? ?? false,
  );
}

class InvoiceLine {
  const InvoiceLine({
    required this.description,
    required this.quantity,
    required this.unitPriceMinor,
    required this.discountMinor,
    required this.lineTotalMinor,
    this.productId,
    this.id,
  });

  final String? id;
  final String? productId;
  final String description;
  final int quantity;
  final int unitPriceMinor;
  final int discountMinor;
  final int lineTotalMinor;

  factory InvoiceLine.fromJson(Map<String, dynamic> j) => InvoiceLine(
    id: j['id'] as String?,
    productId: j['product_id'] as String?,
    description: j['description'] as String? ?? '',
    quantity: (j['quantity'] as num?)?.toInt() ?? 0,
    unitPriceMinor: (j['unit_price_minor'] as num?)?.toInt() ?? 0,
    discountMinor: (j['discount_minor'] as num?)?.toInt() ?? 0,
    lineTotalMinor: (j['line_total_minor'] as num?)?.toInt() ?? 0,
  );
}

class InvoicePayment {
  const InvoicePayment({
    required this.id,
    required this.amountMinor,
    required this.method,
    required this.receivedAt,
    this.reference,
  });

  final String id;
  final int amountMinor;
  final String method;
  final String? reference;
  final DateTime receivedAt;

  factory InvoicePayment.fromJson(Map<String, dynamic> j) => InvoicePayment(
    id: j['id'] as String,
    amountMinor: (j['amount_minor'] as num).toInt(),
    method: j['method'] as String? ?? 'other',
    reference: j['reference'] as String?,
    receivedAt:
        DateTime.tryParse(j['received_at'] as String? ?? '') ?? DateTime.now(),
  );
}

/// The `invoice` summary embedded on a `Sale` (T-0603).
class SaleInvoiceRef {
  const SaleInvoiceRef({
    required this.id,
    required this.number,
    required this.status,
    required this.publicToken,
    required this.balanceDueMinor,
  });

  final String id;
  final int number;
  final String status;
  final String publicToken;
  final int balanceDueMinor;

  factory SaleInvoiceRef.fromJson(Map<String, dynamic> j) => SaleInvoiceRef(
    id: j['id'] as String,
    number: (j['number'] as num).toInt(),
    status: j['status'] as String? ?? 'issued',
    publicToken: j['public_token'] as String,
    balanceDueMinor: (j['balance_due_minor'] as num?)?.toInt() ?? 0,
  );
}

class InvoiceSummary {
  const InvoiceSummary({
    required this.id,
    required this.number,
    required this.customerId,
    required this.customerName,
    required this.status,
    required this.currency,
    required this.totalMinor,
    required this.balanceDueMinor,
    required this.issueDate,
    required this.dueDate,
  });

  final String id;
  final int number;
  final String customerId;
  final String customerName;
  final String status;
  final String currency;
  final int totalMinor;
  final int balanceDueMinor;
  final DateTime issueDate;
  final DateTime dueDate;

  factory InvoiceSummary.fromJson(Map<String, dynamic> j) => InvoiceSummary(
    id: j['id'] as String,
    number: (j['number'] as num).toInt(),
    customerId: j['customer_id'] as String,
    customerName: j['customer_name'] as String? ?? '',
    status: j['status'] as String? ?? 'issued',
    currency: j['currency'] as String? ?? 'TZS',
    totalMinor: (j['total_minor'] as num?)?.toInt() ?? 0,
    balanceDueMinor: (j['balance_due_minor'] as num?)?.toInt() ?? 0,
    issueDate:
        DateTime.tryParse(j['issue_date'] as String? ?? '') ?? DateTime.now(),
    dueDate:
        DateTime.tryParse(j['due_date'] as String? ?? '') ?? DateTime.now(),
  );
}

class Invoice {
  const Invoice({
    required this.id,
    required this.number,
    required this.customerId,
    required this.customerName,
    required this.status,
    required this.currency,
    required this.subtotalMinor,
    required this.discountMinor,
    required this.taxMinor,
    required this.totalMinor,
    required this.amountPaidMinor,
    required this.balanceDueMinor,
    required this.issueDate,
    required this.dueDate,
    required this.publicToken,
    this.saleId,
    this.lines = const [],
    this.payments = const [],
  });

  final String id;
  final int number;
  final String? saleId;
  final String customerId;
  final String customerName;
  final String status;
  final String currency;
  final int subtotalMinor;
  final int discountMinor;
  final int taxMinor;
  final int totalMinor;
  final int amountPaidMinor;
  final int balanceDueMinor;
  final DateTime issueDate;
  final DateTime dueDate;
  final String publicToken;
  final List<InvoiceLine> lines;
  final List<InvoicePayment> payments;

  factory Invoice.fromJson(Map<String, dynamic> j) => Invoice(
    id: j['id'] as String,
    number: (j['number'] as num).toInt(),
    saleId: j['sale_id'] as String?,
    customerId: j['customer_id'] as String,
    customerName: j['customer_name'] as String? ?? '',
    status: j['status'] as String? ?? 'issued',
    currency: j['currency'] as String? ?? 'TZS',
    subtotalMinor: (j['subtotal_minor'] as num?)?.toInt() ?? 0,
    discountMinor: (j['discount_minor'] as num?)?.toInt() ?? 0,
    taxMinor: (j['tax_minor'] as num?)?.toInt() ?? 0,
    totalMinor: (j['total_minor'] as num?)?.toInt() ?? 0,
    amountPaidMinor: (j['amount_paid_minor'] as num?)?.toInt() ?? 0,
    balanceDueMinor: (j['balance_due_minor'] as num?)?.toInt() ?? 0,
    issueDate:
        DateTime.tryParse(j['issue_date'] as String? ?? '') ?? DateTime.now(),
    dueDate:
        DateTime.tryParse(j['due_date'] as String? ?? '') ?? DateTime.now(),
    publicToken: j['public_token'] as String? ?? '',
    lines: ((j['lines'] as List?) ?? [])
        .map((e) => InvoiceLine.fromJson(e as Map<String, dynamic>))
        .toList(),
    payments: ((j['payments'] as List?) ?? [])
        .map((e) => InvoicePayment.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}
