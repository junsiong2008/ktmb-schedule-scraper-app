import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/train_utils.dart';
import '../widgets/trip_timeline.dart';

class LiveMapScreen extends StatefulWidget {
  const LiveMapScreen({super.key});

  @override
  State<LiveMapScreen> createState() => _LiveMapScreenState();
}

class _LiveMapScreenState extends State<LiveMapScreen> {
  final ApiService _api = ApiService();
  final MapController _mapController = MapController();

  List<VehiclePosition> _vehicles = [];
  final ValueNotifier<List<VehiclePosition>> _vehiclesNotifier = ValueNotifier(
    [],
  );
  List<RouteShape> _routes = []; // Add routes state
  bool _routesLoaded = false;
  DateTime? _lastUpdated;
  bool _loading = true;
  String? _focusTripId;
  bool _hasFocused = false;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _fetchVehicles();
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _fetchVehicles(),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is String) {
      _focusTripId = args;
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _vehiclesNotifier.dispose();
    super.dispose();
  }

  Future<void> _fetchVehicles() async {
    try {
      // Fetch routes if not loaded
      if (!_routesLoaded) {
        final routes = await _api.getRouteShapes();
        if (mounted) {
          setState(() {
            _routes = routes;
            _routesLoaded = true;
          });
        }
      }

      final data = await _api.getVehiclePositions();
      if (mounted) {
        setState(() {
          _vehicles = data.vehicles;
          _vehiclesNotifier.value = data.vehicles;
          _lastUpdated = DateTime.fromMillisecondsSinceEpoch(
            data.timestamp * 1000,
          );
          _loading = false;
        });

        // Focus on a specific train if needed
        if (_focusTripId != null && !_hasFocused) {
          final target = _vehicles
              .where((v) => v.tripId == _focusTripId)
              .firstOrNull;
          if (target != null && target.latitude != 0) {
            _mapController.move(LatLng(target.latitude, target.longitude), 14);
            _hasFocused = true;
          }
        }
      }
    } catch (e) {
      debugPrint('Failed to fetch vehicles: $e');
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final focusedVehicle = _focusTripId != null
        ? _vehicles.where((v) => v.tripId == _focusTripId).firstOrNull
        : null;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: isDark
            ? AppTheme.darkSurface.withValues(alpha: 0.95)
            : AppTheme.primaryBlue,
        foregroundColor: Colors.white,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.map_rounded,
                size: 18,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 10),
            const Text(
              'Live Map',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Focused train banner
          if (_focusTripId != null) _buildFocusBanner(isDark, focusedVehicle),

          // Stats bar
          _buildStatsBar(isDark),

          // Map
          Expanded(
            child: _loading
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(
                          color: AppTheme.primaryBlueLight,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Loading live positions...',
                          style: TextStyle(color: Colors.grey.shade500),
                        ),
                      ],
                    ),
                  )
                : Stack(
                    children: [
                      FlutterMap(
                        mapController: _mapController,
                        options: MapOptions(
                          initialCenter: const LatLng(3.140853, 101.693207),
                          initialZoom: 12,
                        ),
                        children: [
                          TileLayer(
                            urlTemplate: isDark
                                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
                            subdomains: const ['a', 'b', 'c', 'd'],
                          ),
                          // Add PolylineLayer for routes
                          if (_routesLoaded)
                            PolylineLayer(
                              polylines: _routes.map((route) {
                                return Polyline(
                                  points: route.coordinates
                                      .map((c) => LatLng(c[0], c[1]))
                                      .toList(),
                                  strokeWidth: 3.0,
                                  color: _parseColor(
                                    route.color,
                                  ).withValues(alpha: isDark ? 0.5 : 0.6),
                                );
                              }).toList(),
                            ),
                          // Station Markers
                          if (_routesLoaded)
                            MarkerLayer(
                              markers: _routes.expand((route) {
                                final routeColor = _parseColor(route.color);
                                return route.stations.map((station) {
                                  return Marker(
                                    point: LatLng(station.lat, station.lon),
                                    width: 20,
                                    height: 20,
                                    child: GestureDetector(
                                      onTap: () {
                                        ScaffoldMessenger.of(
                                          context,
                                        ).hideCurrentSnackBar();
                                        ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          SnackBar(
                                            content: Text(station.name),
                                            duration: const Duration(
                                              seconds: 1,
                                            ),
                                            behavior: SnackBarBehavior.floating,
                                          ),
                                        );
                                      },
                                      child: Center(
                                        child: Container(
                                          width: 12,
                                          height: 12,
                                          decoration: BoxDecoration(
                                            color: Colors.transparent,
                                            shape: BoxShape.circle,
                                            border: Border.all(
                                              color: routeColor,
                                              width: 2,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                });
                              }).toList(),
                            ),
                          MarkerLayer(
                            markers: _vehicles
                                .where(
                                  (v) => v.latitude != 0 && v.longitude != 0,
                                )
                                .map((v) {
                                  final isFocused =
                                      _focusTripId != null &&
                                      v.tripId == _focusTripId;
                                  final isDimmed =
                                      _focusTripId != null && !isFocused;

                                  return Marker(
                                    point: LatLng(v.latitude, v.longitude),
                                    width: isFocused ? 32 : 22,
                                    height: isFocused ? 32 : 22,
                                    child: GestureDetector(
                                      onTap: () => _showTrainInfo(
                                        context,
                                        v.tripId,
                                        isDark,
                                      ),
                                      child: _TrainMarker(
                                        isFocused: isFocused,
                                        isDimmed: isDimmed,
                                      ),
                                    ),
                                  );
                                })
                                .toList(),
                          ),
                        ],
                      ),
                      // Legend Button
                      Positioned(
                        top: 16,
                        right: 16,
                        child: FloatingActionButton.small(
                          heroTag: 'legend_fab',
                          onPressed: () => _showLegend(context, isDark),
                          backgroundColor: isDark
                              ? AppTheme.darkCard
                              : Colors.white,
                          foregroundColor: isDark
                              ? Colors.white
                              : Colors.black87,
                          child: const Icon(Icons.menu_book_rounded, size: 20),
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  void _showLegend(BuildContext context, bool isDark) {
    // Deduplicate routes by name and color
    final uniqueRoutes = <String, RouteShape>{};
    for (final route in _routes) {
      final key = '${route.name}_${route.color}';
      if (!uniqueRoutes.containsKey(key)) {
        uniqueRoutes[key] = route;
      }
    }

    final sortedRoutes = uniqueRoutes.values.toList()
      ..sort((a, b) => a.name.compareTo(b.name));

    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? AppTheme.darkCard : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(left: 8, bottom: 16),
                child: Text(
                  'Route Legend',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const BouncingScrollPhysics(),
                  itemCount: sortedRoutes.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final route = sortedRoutes[index];
                    final color = _parseColor(route.color);
                    return Row(
                      children: [
                        Container(
                          width: 16,
                          height: 16,
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isDark ? Colors.white24 : Colors.black12,
                              width: 1.5,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            route.name,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: isDark
                                  ? Colors.grey[300]
                                  : Colors.grey[800],
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFocusBanner(bool isDark, VehiclePosition? focusedVehicle) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark
            ? AppTheme.accentEmerald.withValues(alpha: 0.1)
            : AppTheme.accentEmerald.withValues(alpha: 0.05),
        border: Border(
          bottom: BorderSide(
            color: AppTheme.accentEmerald.withValues(alpha: 0.2),
          ),
        ),
      ),
      child: Row(
        children: [
          _AnimatedPulse(color: AppTheme.accentEmerald, size: 12),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Tracking Train ${_focusTripId != null ? _getTrainNumber(_focusTripId!) : ''}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: isDark
                        ? AppTheme.accentEmeraldLight
                        : AppTheme.accentEmerald,
                  ),
                ),
                if (focusedVehicle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    focusedVehicle.statusText,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark
                          ? Colors.grey.shade400
                          : Colors.grey.shade600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          IconButton(
            onPressed: () {
              setState(() {
                _focusTripId = null;
                _hasFocused = false;
              });
            },
            icon: Icon(
              Icons.close_rounded,
              size: 18,
              color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
            ),
            style: IconButton.styleFrom(
              backgroundColor: isDark
                  ? Colors.white.withValues(alpha: 0.08)
                  : Colors.black.withValues(alpha: 0.05),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsBar(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.white,
        border: Border(
          bottom: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.05)
                : const Color(0xFFE2E8F0),
          ),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: isDark
                  ? AppTheme.primaryBlueLight.withValues(alpha: 0.1)
                  : AppTheme.primaryBlue.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isDark
                    ? AppTheme.primaryBlueLight.withValues(alpha: 0.2)
                    : AppTheme.primaryBlue.withValues(alpha: 0.15),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _AnimatedPulse(color: AppTheme.primaryBlueLight, size: 10),
                const SizedBox(width: 6),
                Text(
                  '${_vehicles.length} Active Trains',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? AppTheme.primaryBlueLight
                        : AppTheme.primaryBlue,
                  ),
                ),
              ],
            ),
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.05)
                  : const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.08)
                    : const Color(0xFFE2E8F0),
              ),
            ),
            child: Text(
              _lastUpdated != null
                  ? 'Updated: ${_lastUpdated!.hour.toString().padLeft(2, '0')}:${_lastUpdated!.minute.toString().padLeft(2, '0')}:${_lastUpdated!.second.toString().padLeft(2, '0')}'
                  : 'Loading...',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: Colors.grey.shade500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _getTrainNumber(String tripId) {
    final parts = tripId.split('_');
    return parts.length > 1 ? parts.sublist(1).join('_') : tripId;
  }

  void _showTrainInfo(BuildContext context, String tripId, bool isDark) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true, // Allow taller sheet
      backgroundColor: isDark ? AppTheme.darkCard : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return _LiveTrainDetailsSheet(
          tripId: tripId,
          vehiclesNotifier: _vehiclesNotifier,
          routes: _routes,
          isDark: isDark,
        );
      },
    );
  }

  Color _parseColor(String colorObj) {
    try {
      final hex = colorObj.replaceAll('#', '');
      if (hex.length == 6) {
        return Color(int.parse('0xFF$hex'));
      }
    } catch (_) {}
    return AppTheme.primaryBlue;
  }
}

// Animated train marker
class _TrainMarker extends StatelessWidget {
  final bool isFocused;
  final bool isDimmed;

  const _TrainMarker({required this.isFocused, required this.isDimmed});

  @override
  Widget build(BuildContext context) {
    final color = isFocused
        ? AppTheme.accentEmerald
        : AppTheme.primaryBlueLight;

    return AnimatedOpacity(
      opacity: isDimmed ? 0.3 : 1.0,
      duration: const Duration(milliseconds: 300),
      child: Container(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
          border: Border.all(color: Colors.white, width: isFocused ? 3 : 2),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.4),
              blurRadius: isFocused ? 12 : 6,
              spreadRadius: isFocused ? 2 : 0,
            ),
          ],
        ),
        child: isFocused
            ? const Center(
                child: Icon(Icons.train_rounded, size: 14, color: Colors.white),
              )
            : null,
      ),
    );
  }
}

// Animated pulsing dot
class _AnimatedPulse extends StatefulWidget {
  final Color color;
  final double size;

  const _AnimatedPulse({required this.color, required this.size});

  @override
  State<_AnimatedPulse> createState() => _AnimatedPulseState();
}

class _AnimatedPulseState extends State<_AnimatedPulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        children: [
          AnimatedBuilder(
            animation: _controller,
            builder: (_, __) => Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.color.withValues(
                  alpha: (1 - _controller.value) * 0.5,
                ),
              ),
            ),
          ),
          Center(
            child: Container(
              width: widget.size * 0.5,
              height: widget.size * 0.5,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveTrainDetailsSheet extends StatefulWidget {
  final String tripId;
  final ValueNotifier<List<VehiclePosition>> vehiclesNotifier;
  final List<RouteShape> routes;
  final bool isDark;

  const _LiveTrainDetailsSheet({
    required this.tripId,
    required this.vehiclesNotifier,
    required this.routes,
    required this.isDark,
  });

  @override
  State<_LiveTrainDetailsSheet> createState() => _LiveTrainDetailsSheetState();
}

class _LiveTrainDetailsSheetState extends State<_LiveTrainDetailsSheet> {
  VehiclePosition? _lastKnownVehicle;
  int _misses = 0;
  bool _isStale = false;
  static const int _missThreshold = 3;

  @override
  void initState() {
    super.initState();
    _updateVehicle(widget.vehiclesNotifier.value);
    widget.vehiclesNotifier.addListener(_onVehiclesUpdated);
  }

  @override
  void dispose() {
    widget.vehiclesNotifier.removeListener(_onVehiclesUpdated);
    super.dispose();
  }

  void _onVehiclesUpdated() {
    _updateVehicle(widget.vehiclesNotifier.value);
  }

  void _updateVehicle(List<VehiclePosition> vehicles) {
    if (!mounted) return;

    final found = vehicles.where((v) => v.tripId == widget.tripId).firstOrNull;

    if (found != null) {
      if (_lastKnownVehicle != found || _isStale) {
        setState(() {
          _lastKnownVehicle = found;
          _misses = 0;
          _isStale = false;
        });
      }
    } else {
      if (_lastKnownVehicle != null) {
        _misses++;
        if (!_isStale) {
          setState(() => _isStale = true);
        }
        if (_misses >= _missThreshold && mounted) {
          setState(() {});
        }
      }
    }
  }

  String _getTripNumber(String tripId) {
    final parts = tripId.split('_');
    if (parts.length > 1) {
      // Try to find numeric part (e.g. weekday_2382_... -> 2382)
      for (final part in parts) {
        if (int.tryParse(part) != null) {
          return 'No. $part';
        }
      }
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    if (_lastKnownVehicle == null) {
      return Container(
        padding: const EdgeInsets.all(24),
        height: 200,
        child: const Center(child: Text('Train no longer active')),
      );
    }

    final v = _lastKnownVehicle!;
    TrainPosition? trainPos;
    if (v.latitude != 0 && v.longitude != 0 && widget.routes.isNotEmpty) {
      trainPos = TrainUtils.findTrainPosition(
        v.latitude,
        v.longitude,
        widget.routes,
      );
    }

    final lastUpdated = DateTime.fromMillisecondsSinceEpoch(v.timestamp * 1000);

    final isLost = _misses >= _missThreshold;

    return DraggableScrollableSheet(
      initialChildSize: 0.7, // Increased height
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade400,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'Train ${v.vehicleLabel ?? v.vehicleId ?? v.trainNumber}',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: widget.isDark
                              ? Colors.white
                              : Colors.grey.shade900,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: widget.isDark
                              ? Colors.white.withValues(alpha: 0.1)
                              : Colors.black.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: widget.isDark
                                ? Colors.white.withValues(alpha: 0.2)
                                : Colors.black.withValues(alpha: 0.1),
                          ),
                        ),
                        child: Text(
                          _getTripNumber(v.tripId),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: widget.isDark
                                ? Colors.white.withValues(alpha: 0.7)
                                : Colors.black.withValues(alpha: 0.6),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    trainPos?.route.name ?? 'Unknown Route',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey.shade500,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 2,
                  ),
                  const SizedBox(height: 12), // Add spacing before speed/time
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: v.speed > 0
                              ? AppTheme.accentEmerald.withValues(alpha: 0.1)
                              : Colors.orange.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              v.speed > 0
                                  ? Icons.speed_rounded
                                  : Icons.motion_photos_paused_rounded,
                              size: 14,
                              color: v.speed > 0
                                  ? AppTheme.accentEmerald
                                  : Colors.orange,
                            ),
                            const SizedBox(width: 4),
                            ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 80),
                              child: Text(
                                v.speed > 0
                                    ? '${v.speed.round()} km/h'
                                    : 'Stopped',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: v.speed > 0
                                      ? AppTheme.accentEmerald
                                      : Colors.orange,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Updated: ${lastUpdated.hour.toString().padLeft(2, '0')}:${lastUpdated.minute.toString().padLeft(2, '0')}:${lastUpdated.second.toString().padLeft(2, '0')}',
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.grey.shade500,
                            ),
                          ),
                          if (_isStale)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                isLost ? 'Train lost' : 'Using cached data',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: isLost ? Colors.red : Colors.orange,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 20),

              Expanded(
                child: trainPos != null
                    ? TripTimeline(
                        trainPos: trainPos,
                        vehicle: v,
                        isDark: widget.isDark,
                      )
                    : Center(
                        child: Text(
                          'Route information unavailable',
                          style: TextStyle(color: Colors.grey.shade500),
                        ),
                      ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context); // Close modal
                    Navigator.pushNamed(
                      context,
                      '/trip_tracker',
                      arguments: v.tripId,
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: widget.isDark
                        ? AppTheme.accentEmerald
                        : AppTheme.primaryBlue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text(
                    'Full Journey Details',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
