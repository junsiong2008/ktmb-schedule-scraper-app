import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/schedule_provider.dart';
import 'providers/theme_provider.dart';
import 'screens/home_screen.dart';
import 'screens/live_map_screen.dart';
import 'screens/trip_tracker_screen.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const NextStopApp());
}

class NextStopApp extends StatelessWidget {
  const NextStopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ScheduleProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, _) => MaterialApp(
          title: 'Next Stop',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: themeProvider.themeMode,
          initialRoute: '/',
          routes: {
            '/': (context) => const HomeScreen(),
            '/live': (context) => const LiveMapScreen(),
            '/trip_tracker': (context) {
              final args = ModalRoute.of(context)!.settings.arguments;
              if (args is Map) {
                return TripTrackerScreen(
                  tripId: args['tripId'] as String,
                  gtfsRouteId: args['gtfsRouteId'] as String?,
                );
              }
              return TripTrackerScreen(tripId: args as String);
            },
          },
        ),
      ),
    );
  }
}
