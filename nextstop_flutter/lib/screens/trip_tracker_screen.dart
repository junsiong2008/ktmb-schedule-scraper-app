import 'dart:async';
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/train_utils.dart';
import '../widgets/trip_timeline.dart';

class TripTrackerScreen extends StatefulWidget {
  final String tripId;
  final String? gtfsRouteId;

  const TripTrackerScreen({super.key, required this.tripId, this.gtfsRouteId});

  @override
  State<TripTrackerScreen> createState() => _TripTrackerScreenState();
}

class _TripTrackerScreenState extends State<TripTrackerScreen> {
  final ApiService _api = ApiService();

  VehiclePosition? _vehicle;
  List<RouteShape> _routes = [];
  bool _loading = true;
  DateTime? _lastUpdate;
  bool _stale = false;
  String? _error;
  int _consecutiveMisses = 0;

  Timer? _refreshTimer;

  // Cached data for smooth updates
  VehiclePosition? _vehicleRef;
  static const int _missThreshold = 3;

  @override
  void initState() {
    super.initState();
    _fetchData();
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => _fetchData(),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();

    super.dispose();
  }

  Future<void> _fetchData() async {
    try {
      // Fetch routes only once
      if (_routes.isEmpty) {
        final routes = await _api.getRouteShapes();
        if (mounted) {
          setState(() => _routes = routes);
        }
      }

      final vehicleData = await _api.getVehiclePositions();

      if (!mounted) return;

      final found = vehicleData.vehicles
          .where((v) => v.tripId == widget.tripId)
          .firstOrNull;

      if (found != null) {
        setState(() {
          _vehicle = found;
          _vehicleRef = found;
          _error = null;
          _stale = false;
          _consecutiveMisses = 0;
          _lastUpdate = DateTime.fromMillisecondsSinceEpoch(
            vehicleData.timestamp * 1000,
          );
        });
      } else {
        _consecutiveMisses++;
        if (_vehicleRef != null) {
          // Keep cached data but mark as stale
          setState(() {
            _stale = true;
            if (_consecutiveMisses >= _missThreshold) {
              _error = 'Train not found. It may have completed its journey.';
            }
          });
        } else {
          setState(() {
            _error = 'Train not found. It may have completed its journey.';
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching tracking data: $e');
      if (mounted) {
        setState(() {
          if (_vehicleRef == null) {
            _error = 'Failed to fetch tracking data.';
          } else {
            // Mark as stale if we have cached data but fetch failed
            _stale = true;
          }
        });
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  // Ported logic from TripTracker.tsx
  TrainPosition? _calculateTrainPosition() {
    if (_vehicle == null || _routes.isEmpty) return null;

    final vehicle = _vehicle!;
    // Skip if invalid coordinates
    if (vehicle.latitude == 0 && vehicle.longitude == 0) return null;

    // Filter to only route shapes belonging to this trip's DB route, avoiding
    // false snaps to nearby routes on parallel tracks (e.g. Mid Valley vs Abdullah Hukum).
    List<RouteShape> candidateRoutes = _routes;
    if (widget.gtfsRouteId != null && widget.gtfsRouteId!.isNotEmpty) {
      final filtered =
          _routes.where((r) => r.gtfsRouteId == widget.gtfsRouteId).toList();
      if (filtered.isNotEmpty) candidateRoutes = filtered;
    }

    return TrainUtils.findTrainPosition(
      vehicle.latitude,
      vehicle.longitude,
      candidateRoutes,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final trainPos = _calculateTrainPosition();

    return Scaffold(
      backgroundColor: isDark ? AppTheme.darkSurface : AppTheme.lightSurface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_rounded,
            color: isDark ? Colors.white : Colors.black,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Trip Tracker',
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black,
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(
              Icons.refresh_rounded,
              color: isDark ? Colors.white : Colors.black,
            ),
            onPressed: () {
              setState(() => _loading = true);
              _fetchData();
            },
          ),
        ],
      ),
      body: _loading && _vehicle == null
          ? Center(
              child: CircularProgressIndicator(color: AppTheme.primaryBlue),
            )
          : Column(
              children: [
                _buildHeaderCard(context, isDark, trainPos),
                if (_error != null)
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16.0),
                    child: Container(
                      padding: const EdgeInsets.all(12.0),
                      decoration: BoxDecoration(
                        color: Colors.orange.withValues(alpha: 0.1),
                        border: Border.all(
                          color: Colors.orange.withValues(alpha: 0.3),
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.warning_amber_rounded,
                            color: Colors.orange,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _error!,
                              style: const TextStyle(color: Colors.orange),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                Expanded(
                  child: trainPos != null
                      ? TripTimeline(
                          trainPos: trainPos,
                          vehicle: _vehicle,
                          isDark: isDark,
                        )
                      : _buildNoRouteState(isDark),
                ),
              ],
            ),
    );
  }

  Widget _buildHeaderCard(
    BuildContext context,
    bool isDark,
    TrainPosition? trainPos,
  ) {
    return Container(
      margin: EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.darkSurface : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppTheme.accentEmerald.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  widget.tripId.split('_').last,
                  style: const TextStyle(
                    color: AppTheme.accentEmerald,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      trainPos?.route.name ?? 'Tracking...',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                    ),
                    if (_vehicle != null)
                      Row(
                        children: [
                          const Icon(
                            Icons.speed_rounded,
                            size: 14,
                            color: Colors.grey,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${_vehicle!.speed.round()} km/h',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.grey,
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.accentEmerald.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppTheme.accentEmerald.withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: AppTheme.accentEmerald,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Text(
                      'LIVE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.accentEmerald,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (_lastUpdate != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Row(
                children: [
                  Text(
                    'Last updated: ${_lastUpdate!.hour.toString().padLeft(2, '0')}:${_lastUpdate!.minute.toString().padLeft(2, '0')}',
                    style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                  ),
                  if (_stale)
                    Text(
                      ' · Cached',
                      style: TextStyle(fontSize: 11, color: Colors.amber[700]),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildNoRouteState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.gps_off_rounded, size: 48, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            'GPS Only',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black,
            ),
          ),
          if (_vehicle != null) ...[
            const SizedBox(height: 8),
            Text(
              '${_vehicle!.latitude.toStringAsFixed(4)}, ${_vehicle!.longitude.toStringAsFixed(4)}',
              style: const TextStyle(color: Colors.grey),
            ),
          ],
        ],
      ),
    );
  }
}
