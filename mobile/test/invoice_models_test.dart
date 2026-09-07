import 'package:flutter_test/flutter_test.dart';
import 'package:pos_mobile/models/invoice_models.dart';
import 'package:pos_mobile/models/sale_models.dart';

void main() {
  test('Customer.fromJson parses balance + disabled', () {
    final c = Customer.fromJson({
      'id': 'c1',
      'name': 'Asha Traders',
      'email': 'asha@t.io',
      'outstanding_balance': 12000,
      'disabled': false,
    });
    expect(c.name, 'Asha Traders');
    expect(c.outstandingBalance, 12000);
    expect(c.disabled, isFalse);
  });

  test('Invoice.fromJson parses lines + payments + balances', () {
    final inv = Invoice.fromJson({
      'id': 'i1',
      'number': 3,
      'sale_id': 's1',
      'customer_id': 'c1',
      'customer_name': 'Asha',
      'status': 'partially_paid',
      'currency': 'TZS',
      'subtotal_minor': 10000,
      'discount_minor': 0,
      'tax_minor': 0,
      'total_minor': 10000,
      'amount_paid_minor': 4000,
      'balance_due_minor': 6000,
      'issue_date': '2026-09-07T00:00:00.000Z',
      'due_date': '2026-09-21T00:00:00.000Z',
      'public_token': 'tok_abc',
      'lines': [
        {
          'id': 'l1',
          'description': 'Sukari',
          'quantity': 4,
          'unit_price_minor': 2500,
          'discount_minor': 0,
          'line_total_minor': 10000,
        },
      ],
      'payments': [
        {
          'id': 'p1',
          'amount_minor': 4000,
          'method': 'cash',
          'received_at': '2026-09-08T00:00:00.000Z',
        },
      ],
    });
    expect(inv.number, 3);
    expect(inv.balanceDueMinor, 6000);
    expect(inv.lines.single.description, 'Sukari');
    expect(inv.payments.single.method, 'cash');
  });

  test('Sale.fromJson picks up the embedded invoice ref', () {
    final sale = Sale.fromJson({
      'id': 's1',
      'number': 1,
      'status': 'completed',
      'subtotal': 10000,
      'discount_total': 0,
      'total': 10000,
      'currency': 'TZS',
      'created_at': '2026-09-07T00:00:00.000Z',
      'lines': [],
      'invoice': {
        'id': 'i1',
        'number': 7,
        'status': 'issued',
        'public_token': 'tok_x',
        'balance_due_minor': 10000,
      },
    });
    expect(sale.invoice, isNotNull);
    expect(sale.invoice!.number, 7);
    expect(sale.invoice!.publicToken, 'tok_x');
  });
}
