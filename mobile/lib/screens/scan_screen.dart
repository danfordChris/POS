import 'package:flutter/material.dart';
import 'stub_screen.dart';

class ScanScreen extends StatelessWidget {
  const ScanScreen({super.key});

  @override
  Widget build(BuildContext context) => const StubScreen(
    title: 'Scan',
    task: 'T-0107',
    blurb:
        'Camera QR / barcode capture. A match opens the product; an unknown '
        'code starts a new product with the code prefilled.',
  );
}
