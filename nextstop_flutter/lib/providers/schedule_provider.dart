import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import '../services/api_service.dart';

class ScheduleProvider extends ChangeNotifier {
  final ApiService _api;

  ScheduleProvider({ApiService? api}) : _api = api ?? ApiService() {
    _init();
  }

  // Service type
  String _serviceType = 'Komuter';
  String get serviceType => _serviceType;

  // Route data
  List<RouteGroup> _routeGroups = [];
  List<RouteGroup> get routeGroups => _routeGroups;

  List<TrainRoute> _availableRoutes = [];
  List<TrainRoute> get availableRoutes => _availableRoutes;

  String _selectedRouteId = '';
  String get selectedRouteId => _selectedRouteId;

  // Stations
  List<Station> _stations = [];
  List<Station> get stations => _stations;
  bool _stationLoading = false;
  bool get stationLoading => _stationLoading;

  String _originId = '';
  String get originId => _originId;

  String _destinationId = '';
  String get destinationId => _destinationId;

  // Date/Time
  String _date = '';
  String get date => _date;

  String _time = '';
  String get time => _time;

  String _todayStr = '';
  String get todayStr => _todayStr;

  // Results
  List<TripSearchResult> _trips = [];
  List<TripSearchResult> get trips => _trips;

  bool _loading = false;
  bool get loading => _loading;

  bool _hasSearched = false;
  bool get hasSearched => _hasSearched;

  String _dayType = '';
  String get dayType => _dayType;

  Map<String, String> _liveTrainMap = {};
  Map<String, String> get liveTrainMap => _liveTrainMap;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  // Recent searches
  List<RecentSearch> _recentSearches = [];
  List<RecentSearch> get recentSearches => _recentSearches;

  List<RecentSearch> get filteredRecentSearches =>
      _recentSearches.where((s) => s.serviceType == _serviceType).toList();

  // Initialization
  Future<void> _init() async {
    // Set today's date (UTC+8 for Malaysia)
    final now = DateTime.now().toUtc().add(const Duration(hours: 8));
    _todayStr =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    _date = _todayStr;
    _time =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

    // Load recent searches
    await _loadRecentSearches();

    // Load routes
    try {
      _routeGroups = await _api.getRoutes();
      _updateAvailableRoutes();
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to fetch routes: $e');
    }
  }

  // Update available routes when service type changes
  void _updateAvailableRoutes() {
    final serviceNameMap = {'Komuter': 'KTM Komuter', 'ETS': 'ETS'};

    final group = _routeGroups
        .where((g) => g.serviceName == serviceNameMap[_serviceType])
        .toList();
    var routes = group.isNotEmpty ? group.first.routes : <TrainRoute>[];

    // Deduplicate Komuter routes
    if (_serviceType == 'Komuter') {
      final uniqueRoutes = <TrainRoute>[];
      final seenNames = <String>{};

      for (final r in routes) {
        var simplifiedName = r.routeLongName;
        if (simplifiedName.contains(' KE ')) {
          final parts = simplifiedName
              .split(' KE ')
              .map((s) => s.trim())
              .toList();
          parts.sort();
          simplifiedName = parts.join(' - ');
        }
        if (!seenNames.contains(simplifiedName)) {
          seenNames.add(simplifiedName);
          uniqueRoutes.add(
            TrainRoute(
              routeId: r.routeId,
              routeLongName: simplifiedName,
              routeShortName: r.routeShortName,
              serviceType: r.serviceType,
              routeType: r.routeType,
            ),
          );
        }
      }
      routes = uniqueRoutes;
    }

    _availableRoutes = routes;
    if (routes.isNotEmpty) {
      _selectedRouteId = routes.first.routeId;
    } else {
      _selectedRouteId = '';
    }
  }

  // Actions
  void setServiceType(String type) {
    if (_serviceType == type) return;
    _serviceType = type;
    _updateAvailableRoutes();
    _originId = '';
    _destinationId = '';
    notifyListeners();
    _fetchStations();
  }

  void setSelectedRoute(String routeId) {
    if (_selectedRouteId == routeId) return;
    _selectedRouteId = routeId;
    _originId = '';
    _destinationId = '';
    notifyListeners();
    _fetchStations();
  }

  void setOrigin(String id) {
    _originId = id;
    notifyListeners();
  }

  void setDestination(String id) {
    _destinationId = id;
    notifyListeners();
  }

  void swapStations() {
    if (_stationLoading) return;
    final temp = _originId;
    _originId = _destinationId;
    _destinationId = temp;
    notifyListeners();
  }

  void setDate(String newDate) {
    _date = newDate;
    _time = '';
    notifyListeners();
  }

  void setTime(String newTime) {
    _time = newTime;
    notifyListeners();
  }

  void resetSearch() {
    _originId = '';
    _destinationId = '';
    _trips = [];
    _hasSearched = false;
    _liveTrainMap = {};
    _dayType = '';
    _errorMessage = null;
    notifyListeners();
  }

  Future<void> _fetchStations() async {
    _stationLoading = true;
    notifyListeners();

    try {
      _stations = await _api.getStations(
        serviceType: _serviceType,
        routeId: _selectedRouteId.isNotEmpty ? _selectedRouteId : null,
      );
    } catch (e) {
      debugPrint('Failed to fetch stations: $e');
    } finally {
      _stationLoading = false;
      notifyListeners();
    }
  }

  Future<void> search() async {
    if (_originId.isEmpty || _destinationId.isEmpty || _date.isEmpty) return;

    _loading = true;
    _hasSearched = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.searchTrips(
        from: _originId,
        to: _destinationId,
        date: _date,
        serviceType: _serviceType,
        time: _time,
      );
      _trips = response.trips;
      _dayType = response.dayType;

      // Fetch live positions if searching for today
      if (_date == _todayStr) {
        try {
          final vehicleData = await _api.getVehiclePositions();
          _liveTrainMap = {};
          for (final v in vehicleData.vehicles) {
            if (v.tripId.isNotEmpty) {
              final trainNum = _extractTrainNumber(v.tripId);
              _liveTrainMap[trainNum] = v.tripId;
            }
          }
        } catch (_) {
          _liveTrainMap = {};
        }
      } else {
        _liveTrainMap = {};
      }

      // Update recent searches
      _updateRecentSearches();
    } catch (e) {
      debugPrint('Search failed: $e');
      _trips = [];
      _liveTrainMap = {};
      _errorMessage = 'Failed to search. Please check your connection.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> executeRecentSearch(RecentSearch item) async {
    if (item.serviceType != _serviceType) {
      _serviceType = item.serviceType;
      _updateAvailableRoutes();
    }

    _originId = item.originId;
    _destinationId = item.destinationId;
    notifyListeners();

    // Fetch stations for the service in the background, but don't wait
    _fetchStations();

    _loading = true;
    _hasSearched = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.searchTrips(
        from: item.originId,
        to: item.destinationId,
        date: _date,
        serviceType: item.serviceType,
        time: _time,
      );
      _trips = response.trips;
      _dayType = response.dayType;

      if (_date == _todayStr) {
        try {
          final vehicleData = await _api.getVehiclePositions();
          _liveTrainMap = {};
          for (final v in vehicleData.vehicles) {
            if (v.tripId.isNotEmpty) {
              final trainNum = _extractTrainNumber(v.tripId);
              _liveTrainMap[trainNum] = v.tripId;
            }
          }
        } catch (_) {
          _liveTrainMap = {};
        }
      }
    } catch (e) {
      _trips = [];
      _liveTrainMap = {};
      _errorMessage = 'Failed to search. Please check your connection.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  // Extract train number from GTFS trip ID (e.g. "weekday_2067" -> "2067")
  String _extractTrainNumber(String gtfsTripId) {
    final parts = gtfsTripId.split('_');
    return parts.length > 1 ? parts.sublist(1).join('_') : gtfsTripId;
  }

  // Match by train number only (ignores weekday/weekend prefix)
  String? getLiveTripId(String tripId) {
    if (_liveTrainMap.isEmpty) return null;
    return _liveTrainMap[tripId];
  }

  // Duration calculation
  String calculateDuration(String dep, String arr) {
    if (dep.isEmpty || arr.isEmpty) return '';
    final depParts = dep.split(':').map(int.parse).toList();
    final arrParts = arr.split(':').map(int.parse).toList();
    var depMin = depParts[0] * 60 + depParts[1];
    var arrMin = arrParts[0] * 60 + arrParts[1];
    if (arrMin < depMin) arrMin += 24 * 60;
    final diff = arrMin - depMin;
    final h = diff ~/ 60;
    final m = diff % 60;
    return h > 0 ? '${h}h ${m}m' : '${m}m';
  }

  String formatTime(String time) {
    return time.isNotEmpty ? time.substring(0, 5) : '--:--';
  }

  // Recent searches persistence
  void _updateRecentSearches() {
    final oName =
        _stations
            .where((s) => s.stationId == _originId)
            .firstOrNull
            ?.stationName ??
        _originId;
    final dName =
        _stations
            .where((s) => s.stationId == _destinationId)
            .firstOrNull
            ?.stationName ??
        _destinationId;

    final newItem = RecentSearch(
      id: '$_originId-$_destinationId-$_serviceType',
      originId: _originId,
      destinationId: _destinationId,
      originName: oName,
      destinationName: dName,
      serviceType: _serviceType,
      timestamp: DateTime.now().millisecondsSinceEpoch,
    );

    // Remove duplicate
    _recentSearches.removeWhere(
      (item) =>
          item.originId == _originId &&
          item.destinationId == _destinationId &&
          item.serviceType == _serviceType,
    );

    _recentSearches.insert(0, newItem);

    // Enforce max 3 per service type
    final serviceCounts = <String, int>{};
    _recentSearches = _recentSearches.where((item) {
      final count = serviceCounts[item.serviceType] ?? 0;
      if (count < 3) {
        serviceCounts[item.serviceType] = count + 1;
        return true;
      }
      return false;
    }).toList();

    _saveRecentSearches();
  }

  Future<void> _loadRecentSearches() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString('ktmb_recent_searches');
      if (saved != null) {
        final List<dynamic> data = json.decode(saved);
        _recentSearches = data
            .map((e) => RecentSearch.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } catch (e) {
      debugPrint('Failed to load recent searches: $e');
    }
  }

  Future<void> _saveRecentSearches() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        'ktmb_recent_searches',
        json.encode(_recentSearches.map((e) => e.toJson()).toList()),
      );
    } catch (e) {
      debugPrint('Failed to save recent searches: $e');
    }
  }
}
