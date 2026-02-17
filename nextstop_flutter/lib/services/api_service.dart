import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/models.dart';

class ApiService {
  static const String baseUrl =
      'https://ktmb-api-769756648802.us-central1.run.app/api';

  final http.Client _client;

  ApiService({http.Client? client}) : _client = client ?? http.Client();

  Future<List<Station>> getStations({
    String? serviceType,
    String? routeId,
  }) async {
    final params = <String, String>{};
    if (serviceType != null) params['service_type'] = serviceType;
    if (routeId != null) params['route_id'] = routeId;

    final uri = Uri.parse(
      '$baseUrl/stations',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await _client.get(uri);

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data
          .map((e) => Station.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    throw Exception('Failed to load stations: ${response.statusCode}');
  }

  Future<List<RouteGroup>> getRoutes() async {
    final response = await _client.get(Uri.parse('$baseUrl/routes'));

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data
          .map((e) => RouteGroup.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    throw Exception('Failed to load routes: ${response.statusCode}');
  }

  Future<TripSearchResponse> searchTrips({
    required String from,
    required String to,
    required String date,
    String? serviceType,
    String? time,
  }) async {
    final params = <String, String>{'from': from, 'to': to, 'date': date};
    if (serviceType != null) params['service_type'] = serviceType;
    if (time != null && time.isNotEmpty) params['time'] = time;

    final uri = Uri.parse(
      '$baseUrl/schedule/search',
    ).replace(queryParameters: params);
    final response = await _client.get(uri);

    if (response.statusCode == 200) {
      return TripSearchResponse.fromJson(json.decode(response.body));
    }
    throw Exception('Failed to search trips: ${response.statusCode}');
  }

  Future<VehiclePositionsResponse> getVehiclePositions() async {
    final response = await _client.get(
      Uri.parse(
        '$baseUrl/gtfs/vehicle-positions?_=${DateTime.now().millisecondsSinceEpoch}',
      ),
    );

    if (response.statusCode == 200) {
      return VehiclePositionsResponse.fromJson(json.decode(response.body));
    }
    throw Exception('Failed to load vehicle positions: ${response.statusCode}');
  }

  Future<List<RouteShape>> getRouteShapes() async {
    final response = await _client.get(Uri.parse('$baseUrl/gtfs/route-shapes'));

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data
          .map((e) => RouteShape.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    throw Exception('Failed to load route shapes: ${response.statusCode}');
  }
}
