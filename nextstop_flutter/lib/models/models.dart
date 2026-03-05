class Station {
  final String stationId;
  final String stationName;

  Station({required this.stationId, required this.stationName});

  factory Station.fromJson(Map<String, dynamic> json) {
    return Station(
      stationId: json['stop_id'].toString(),
      stationName: json['stop_name'] as String,
    );
  }
}

class TrainRoute {
  final String routeId;
  final String routeLongName;
  final String routeShortName;
  final String? serviceType;
  final int? routeType;

  TrainRoute({
    required this.routeId,
    required this.routeLongName,
    required this.routeShortName,
    this.serviceType,
    this.routeType,
  });

  factory TrainRoute.fromJson(Map<String, dynamic> json) {
    return TrainRoute(
      routeId: json['route_id'].toString(),
      routeLongName: json['route_long_name'] as String,
      routeShortName: json['route_short_name'].toString(),
      serviceType: json['service_type'] as String?,
      routeType: json['route_type'] as int?,
    );
  }
}

class RouteGroup {
  final String serviceName;
  final List<TrainRoute> routes;

  RouteGroup({required this.serviceName, required this.routes});

  factory RouteGroup.fromJson(Map<String, dynamic> json) {
    return RouteGroup(
      serviceName: json['service_name'] as String,
      routes: (json['routes'] as List)
          .map((r) => TrainRoute.fromJson(r as Map<String, dynamic>))
          .toList(),
    );
  }
}

class TripSearchResult {
  final String tripId;
  final String departureTime;
  final String arrivalTime;
  final String routeLongName;
  final String routeShortName;
  final dynamic routeType;
  final String tripHeadsign;
  final String? gtfsRouteId;

  TripSearchResult({
    required this.tripId,
    required this.departureTime,
    required this.arrivalTime,
    required this.routeLongName,
    required this.routeShortName,
    required this.routeType,
    required this.tripHeadsign,
    this.gtfsRouteId,
  });

  factory TripSearchResult.fromJson(Map<String, dynamic> json) {
    return TripSearchResult(
      tripId: json['trip_id'] as String,
      departureTime: json['departure_time'] as String,
      arrivalTime: json['arrival_time'] as String,
      routeLongName: json['route_long_name'] as String,
      routeShortName: json['route_short_name'] as String,
      routeType: json['route_type'],
      tripHeadsign: json['trip_headsign'] as String,
      gtfsRouteId: json['gtfs_route_id'] as String?,
    );
  }
}

class TripSearchResponse {
  final String dayType;
  final List<TripSearchResult> trips;

  TripSearchResponse({required this.dayType, required this.trips});

  factory TripSearchResponse.fromJson(Map<String, dynamic> json) {
    return TripSearchResponse(
      dayType: json['day_type'] as String? ?? '',
      trips:
          (json['trips'] as List?)
              ?.map((t) => TripSearchResult.fromJson(t as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class VehiclePosition {
  final String id;
  final String tripId;
  final String routeId;
  final String startTime;
  final String startDate;
  final double latitude;
  final double longitude;
  final double bearing;
  final double speed;
  final int timestamp;
  final int? currentStatus;
  final String? stopId;
  final String? vehicleId;
  final String? vehicleLabel;

  VehiclePosition({
    required this.id,
    required this.tripId,
    required this.routeId,
    required this.startTime,
    required this.startDate,
    required this.latitude,
    required this.longitude,
    required this.bearing,
    required this.speed,
    required this.timestamp,
    this.currentStatus,
    this.stopId,
    this.vehicleId,
    this.vehicleLabel,
  });

  factory VehiclePosition.fromJson(Map<String, dynamic> json) {
    final vehicle = json['vehicle'] as Map<String, dynamic>;
    final trip = vehicle['trip'] as Map<String, dynamic>? ?? {};
    final position = vehicle['position'] as Map<String, dynamic>? ?? {};
    final vehicleInfo = vehicle['vehicle'] as Map<String, dynamic>? ?? {};

    return VehiclePosition(
      id: json['id'] as String,
      tripId: trip['tripId'] as String? ?? '',
      routeId: trip['routeId'] as String? ?? '',
      startTime: trip['startTime'] as String? ?? '',
      startDate: trip['startDate'] as String? ?? '',
      latitude: (position['latitude'] as num?)?.toDouble() ?? 0,
      longitude: (position['longitude'] as num?)?.toDouble() ?? 0,
      bearing: (position['bearing'] as num?)?.toDouble() ?? 0,
      speed: (position['speed'] as num?)?.toDouble() ?? 0,
      timestamp: vehicle['timestamp'] as int? ?? 0,
      currentStatus: vehicle['currentStatus'] as int?,
      stopId: vehicle['stopId'] as String?,
      vehicleId: vehicleInfo['id'] as String?,
      vehicleLabel: vehicleInfo['label'] as String?,
    );
  }

  String get statusText {
    switch (currentStatus) {
      case 0:
        return stopId != null ? 'Incoming at $stopId' : 'Arriving';
      case 1:
        return stopId != null ? 'Stopped at $stopId' : 'Stopped';
      case 2:
        return stopId != null ? 'In transit to $stopId' : 'In Transit';
      default:
        return 'Unknown';
    }
  }

  String get trainNumber {
    if (tripId.isEmpty) return '';
    final parts = tripId.split('_');
    return parts.length > 1 ? parts.sublist(1).join('_') : tripId;
  }
}

class VehiclePositionsResponse {
  final int timestamp;
  final List<VehiclePosition> vehicles;

  VehiclePositionsResponse({required this.timestamp, required this.vehicles});

  factory VehiclePositionsResponse.fromJson(Map<String, dynamic> json) {
    return VehiclePositionsResponse(
      timestamp: json['timestamp'] as int? ?? 0,
      vehicles:
          (json['vehicles'] as List?)
              ?.map((v) => VehiclePosition.fromJson(v as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class RecentSearch {
  final String id;
  final String originId;
  final String destinationId;
  final String originName;
  final String destinationName;
  final String serviceType;
  final int timestamp;

  RecentSearch({
    required this.id,
    required this.originId,
    required this.destinationId,
    required this.originName,
    required this.destinationName,
    required this.serviceType,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'originId': originId,
    'destinationId': destinationId,
    'originName': originName,
    'destinationName': destinationName,
    'serviceType': serviceType,
    'timestamp': timestamp,
  };

  factory RecentSearch.fromJson(Map<String, dynamic> json) {
    return RecentSearch(
      id: json['id'] as String,
      originId: json['originId'] as String,
      destinationId: json['destinationId'] as String,
      originName: json['originName'] as String,
      destinationName: json['destinationName'] as String,
      serviceType: json['serviceType'] as String,
      timestamp: json['timestamp'] as int,
    );
  }
}

class RouteStation {
  final String name;
  final double lat;
  final double lon;
  final double distTraveled;
  final String gtfsStopId;

  RouteStation({
    required this.name,
    required this.lat,
    required this.lon,
    required this.distTraveled,
    required this.gtfsStopId,
  });

  factory RouteStation.fromJson(Map<String, dynamic> json) {
    return RouteStation(
      name: json['name'] as String,
      lat: (json['lat'] as num).toDouble(),
      lon: (json['lon'] as num).toDouble(),
      distTraveled: (json['distTraveled'] as num).toDouble(),
      gtfsStopId: json['gtfsStopId'] as String,
    );
  }
}

class RouteShape {
  final int shapeGroup;
  final String name;
  final String color;
  final String gtfsRouteId;
  final List<List<double>> coordinates;
  final List<RouteStation> stations;

  RouteShape({
    required this.shapeGroup,
    required this.name,
    required this.color,
    required this.gtfsRouteId,
    required this.coordinates,
    required this.stations,
  });

  factory RouteShape.fromJson(Map<String, dynamic> json) {
    return RouteShape(
      shapeGroup: json['shapeGroup'] as int,
      name: json['name'] as String,
      color: json['color'] as String,
      gtfsRouteId: json['gtfsRouteId'] as String? ?? '',
      coordinates: (json['coordinates'] as List)
          .map((c) => (c as List).map((e) => (e as num).toDouble()).toList())
          .toList(),
      stations: (json['stations'] as List)
          .map((s) => RouteStation.fromJson(s as Map<String, dynamic>))
          .toList(),
    );
  }
}
