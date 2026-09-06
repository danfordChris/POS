import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/catalog/providers/catalog_provider.dart';
import 'package:pos_mobile/features/sell/providers/sell_provider.dart';
import 'package:pos_mobile/features/stock/providers/stock_provider.dart';
import 'package:pos_mobile/shared/providers/app_provider.dart';

/// App-wide providers, mounted once above the router in `main.dart`. Only state
/// that must survive route/tab changes belongs here.
List<SingleChildWidget> appProviders = [
  ChangeNotifierProvider(create: (_) => AppProvider()),
  ChangeNotifierProvider(create: (_) => SessionProvider()..bootstrap()),
  ChangeNotifierProvider(create: (_) => CatalogProvider()),
  ChangeNotifierProvider(create: (_) => StockProvider()),
  ChangeNotifierProvider(create: (_) => SellProvider()),
];
