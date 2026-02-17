import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
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
  static const double _stationSnapDistanceKm = 0.3;

  static TrainPosition? findTrainPosition(
    double trainLat,
    double trainLon,
    List<RouteShape> routes,
  ) {
    RouteShape? bestRoute;
    int bestSegment = 0;
    double bestFraction = 0;
    double bestDist = double.infinity;
    const distance = Distance();

    for (final route in routes) {
      final stations = route.stations;
      if (stations.length < 2) continue;

      for (int i = 0; i < stations.length - 1; i++) {
        final a = stations[i];
        final b = stations[i + 1];

        // Simple projection logic
        final p1 = LatLng(a.lat, a.lon);
        final p2 = LatLng(b.lat, b.lon);
        final pTrain = LatLng(trainLat, trainLon);

        // Project train position onto segment A-B
        final dA = distance.as(LengthUnit.Kilometer, pTrain, p1);
        final dB = distance.as(LengthUnit.Kilometer, pTrain, p2);
        final dAB = distance.as(LengthUnit.Kilometer, p1, p2);

        double fraction = 0;
        if (dAB > 0.01) {
          fraction = math.max(
            0,
            math.min(1, (dA * dA - dB * dB + dAB * dAB) / (2 * dAB * dAB)),
          );
        }

        // Calculate projected point
        // Simplified planar interpolation for projection (good enough for short segments)
        final projLat = a.lat + fraction * (b.lat - a.lat);
        final projLon = a.lon + fraction * (b.lon - a.lon);

        final distToSegment = distance.as(
          LengthUnit.Kilometer,
          pTrain,
          LatLng(projLat, projLon),
        );

        if (distToSegment < bestDist) {
          bestDist = distToSegment;
          bestRoute = route;
          bestSegment = i;
          bestFraction = fraction;
        }
      }
    }

    // Only match if within 15km
    if (bestRoute != null && bestDist < 15) {
      // Check snap to station
      int? atStation;
      for (int i = 0; i < bestRoute.stations.length; i++) {
        final s = bestRoute.stations[i];
        final d = distance.as(
          LengthUnit.Kilometer,
          LatLng(trainLat, trainLon),
          LatLng(s.lat, s.lon),
        );
        if (d < _stationSnapDistanceKm) {
          atStation = i;
          break;
        }
      }

      return TrainPosition(
        route: bestRoute,
        segmentIndex: bestSegment,
        fraction: bestFraction,
        atStation: atStation,
      );
    }

    return null;
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
