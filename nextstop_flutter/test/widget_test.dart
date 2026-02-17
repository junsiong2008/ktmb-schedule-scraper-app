import 'package:flutter_test/flutter_test.dart';
import 'package:nextstop_flutter/main.dart';

void main() {
  testWidgets('App launches', (WidgetTester tester) async {
    await tester.pumpWidget(const NextStopApp());
    expect(find.text('Next Stop'), findsOneWidget);
  });
}
