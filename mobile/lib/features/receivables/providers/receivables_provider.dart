import 'package:pos_mobile/data/services/customer_service.dart';
import 'package:pos_mobile/data/services/invoice_service.dart';
import 'package:pos_mobile/models/invoice_models.dart';
import 'package:pos_mobile/shared/providers/base_provider.dart';

/// Read-only accounts-receivable summary: which customers owe money and how
/// many invoices are overdue. Owner-facing.
class ReceivablesProvider extends BaseProvider {
  ReceivablesProvider({
    CustomerService customers = const CustomerService(),
    InvoiceService invoices = const InvoiceService(),
    // ignore: prefer_initializing_formals
  }) : _customers = customers,
       // ignore: prefer_initializing_formals
       _invoices = invoices;

  final CustomerService _customers;
  final InvoiceService _invoices;

  List<Customer> _owing = [];
  List<InvoiceSummary> _overdue = [];
  bool _loaded = false;

  List<Customer> get owing => _owing;
  List<InvoiceSummary> get overdue => _overdue;
  bool get loaded => _loaded;
  int get totalOutstanding =>
      _owing.fold(0, (a, c) => a + c.outstandingBalance);

  Future<void> load(String businessId) async {
    final ok = await guard(() async {
      final owing = await _customers.list(businessId, hasBalance: true);
      final overdue = await _invoices.list(businessId, overdue: true);
      _owing = owing.data;
      _overdue = overdue.data;
      return true;
    });
    if (ok == true) _loaded = true;
    notifyListeners();
  }
}
