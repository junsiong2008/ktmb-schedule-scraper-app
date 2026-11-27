import 'package:flutter/material.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';

class TrainPosition {
  final RouteShape route;
  final int segmentIndex;
  final double fraction;
  final int? atStation;

  TrainPosition({
    required this.route,
    required this.segmentIndex,
    required this.fraction,
    this.atStation,
  });
}

class TrainUtils {
  /// Pair the API-computed track position with its route shape for display.
  /// Returns null when the API couldn't match the train or the route isn't loaded.
  static TrainPosition? positionFor(
    VehiclePosition? vehicle,
    List<RouteShape> routes,
  ) {
    final pos = vehicle?.trackPosition;
    if (pos == null) return null;
    final route = routes
        .where((r) => r.shapeGroup == pos.shapeGroup)
        .firstOrNull;
    if (route == null) return null;
    return TrainPosition(
      route: route,
      segmentIndex: pos.segmentIndex,
      fraction: pos.fraction,
      atStation: pos.atStation,
    );
  }

  static Color parseColor(String colorObj) {
    try {
      // Expecting hex string like "#FF0000" or simple string
      final hex = colorObj.replaceAll('#', '');
      if (hex.length == 6) {
        return Color(int.parse('0xFF$hex'));
      }
    } catch (_) {}
    return AppTheme.primaryBlue;
  }
}
