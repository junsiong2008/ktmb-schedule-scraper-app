"""
Ingests GTFS station coordinates into the database.

This script:
1. Reads gtfs_data/stops.txt to get station lat/lon
2. Updates the stations table with coordinates (fuzzy name matching)
3. Builds route_shapes from gtfs_data/stop_times.txt, trips.txt, routes.txt
"""
import os
import sys
import csv
import re
import argparse
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    import psycopg2
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)



# Manual aliases: map DB name variants -> canonical GTFS normalized name
# These handle known spelling differences between the CSV-ingested DB and GTFS stops.txt
NAME_ALIASES = {
    'BANDAR TASEK SELATAN': 'BANDAR TASEK',
    'BANDAR TASIK SELATAN': 'BANDAR TASEK',
    'KG RAJA UDA': 'KAMPUNG RAJA UDA',
    'KEMPAS BARU': 'KEMPAS BAHRU',
    'ALOR SETAR': 'ALOR STAR',
    'PULAU SEBANG TAMPIN': 'PULAU SEBANG',  # After removing '/' -> "PULAU SEBANG TAMPIN"
    'KG DATO HARUN': 'KGDATUK HARUN',
    'SUNGAI BULOH': 'SUNGAI BULUH',
    'KUALA KUBU BHARU': 'KUALA KUBU BARU',
    'PELABUHAN KLANG': 'PEL KLANG',
    'SEPUTEH': 'SEPUTEH',  # Does not exist in GTFS
}


def normalize_name(name):
    """Normalize station name for matching: lowercase, strip parenthetical, remove special chars."""
    name = name.strip().upper()
    # Remove parenthetical content like "(S)" or "(PK)"
    name = re.sub(r'\s*\(.*?\)', '', name)
    # Remove special chars but keep spaces
    name = re.sub(r'[^A-Z0-9\s]', '', name)
    # Collapse whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    # Apply manual aliases
    if name in NAME_ALIASES:
        name = NAME_ALIASES[name]
    return name


def load_gtfs_stops(gtfs_dir):
    """Load stops from GTFS stops.txt."""
    stops = {}
    stops_file = os.path.join(gtfs_dir, 'stops.txt')
    with open(stops_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            stop_id = row['stop_id'].strip()
            stop_name = row['stop_name'].strip()
            lat = float(row['stop_lat'])
            lon = float(row['stop_lon'])
            normalized = normalize_name(stop_name)
            stops[stop_id] = {
                'name': stop_name,
                'normalized': normalized,
                'lat': lat,
                'lon': lon,
            }
    return stops


def load_gtfs_routes(gtfs_dir):
    """Load routes from GTFS routes.txt."""
    routes = {}
    routes_file = os.path.join(gtfs_dir, 'routes.txt')
    with open(routes_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            route_id = row['route_id'].strip()
            routes[route_id] = {
                'short_name': row['route_short_name'].strip(),
                'long_name': row['route_long_name'].strip(),
                'color': row.get('route_color', '').strip(),
            }
    return routes


def load_gtfs_trips(gtfs_dir):
    """Load trips from GTFS trips.txt. Returns dict: trip_id -> {route_id, direction_id}."""
    trips = {}
    trips_file = os.path.join(gtfs_dir, 'trips.txt')
    with open(trips_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            trip_id = row['trip_id'].strip()
            trips[trip_id] = {
                'route_id': row['route_id'].strip(),
                'direction_id': int(row['direction_id']),
            }
    return trips


def load_gtfs_stop_times(gtfs_dir):
    """Load stop_times from GTFS stop_times.txt. Returns dict: trip_id -> list of stop entries."""
    stop_times = defaultdict(list)
    st_file = os.path.join(gtfs_dir, 'stop_times.txt')
    with open(st_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            trip_id = row['trip_id'].strip()
            stop_times[trip_id].append({
                'stop_id': row['stop_id'].strip(),
                'stop_sequence': int(row['stop_sequence']),
                'shape_dist_traveled': float(row['shape_dist_traveled']) if row.get('shape_dist_traveled') else None,
            })
    # Sort each trip's stops by sequence
    for tid in stop_times:
        stop_times[tid].sort(key=lambda x: x['stop_sequence'])
    return dict(stop_times)


def update_station_coordinates(conn, gtfs_stops, dry_run=False):
    """Update stations table with coordinates from GTFS stops."""
    cursor = conn.cursor()
    
    # Get all stations from DB
    cursor.execute("SELECT id, name FROM stations")
    db_stations = cursor.fetchall()
    
    # Build normalized lookup from GTFS stops
    gtfs_by_normalized = {}
    for stop_id, stop_data in gtfs_stops.items():
        norm = stop_data['normalized']
        # Keep the first match (or override if we want)
        if norm not in gtfs_by_normalized:
            gtfs_by_normalized[norm] = stop_data

    matched = 0
    unmatched = []

    for station_id, station_name in db_stations:
        norm_db = normalize_name(station_name)
        
        if norm_db in gtfs_by_normalized:
            gtfs = gtfs_by_normalized[norm_db]
            if not dry_run:
                cursor.execute(
                    "UPDATE stations SET latitude = %s, longitude = %s WHERE id = %s",
                    (gtfs['lat'], gtfs['lon'], station_id)
                )
            matched += 1
            print(f"  ✓ Matched: '{station_name}' -> ({gtfs['lat']}, {gtfs['lon']})")
        else:
            unmatched.append(station_name)
    
    if not dry_run:
        conn.commit()
    
    print(f"\n  Matched: {matched}/{len(db_stations)}")
    if unmatched:
        print(f"  Unmatched ({len(unmatched)}):")
        for name in unmatched:
            print(f"    ✗ '{name}'")
    
    return matched, unmatched


def build_route_shapes(conn, gtfs_stops, gtfs_routes, gtfs_trips, gtfs_stop_times, dry_run=False):
    """Build route_shapes table from GTFS data."""
    cursor = conn.cursor()
    
    # Get DB routes to map to
    cursor.execute("SELECT id, name, service_type FROM routes")
    db_routes = cursor.fetchall()
    
    # Get DB stations for matching
    cursor.execute("SELECT id, name FROM stations")
    db_stations = {normalize_name(name): sid for sid, name in cursor.fetchall()}
    
    # Group GTFS trips by route_id and direction
    route_trips = defaultdict(lambda: defaultdict(list))
    for trip_id, trip_data in gtfs_trips.items():
        route_trips[trip_data['route_id']][trip_data['direction_id']].append(trip_id)
    
    # Clear existing route_shapes
    if not dry_run:
        cursor.execute("DELETE FROM route_shapes")
        conn.commit()
    
    total_inserted = 0
    
    for gtfs_route_id, directions in route_trips.items():
        gtfs_route = gtfs_routes.get(gtfs_route_id, {})
        route_name = gtfs_route.get('long_name', gtfs_route_id)
        
        print(f"\n  Processing GTFS route: {route_name} ({gtfs_route_id})")
        
        # For each direction, pick the trip with the most stops (most complete representation)
        for direction_id, trip_ids in directions.items():
            best_trip_id = None
            best_stop_count = 0
            
            for tid in trip_ids:
                stops = gtfs_stop_times.get(tid, [])
                if len(stops) > best_stop_count:
                    best_stop_count = len(stops)
                    best_trip_id = tid
            
            if not best_trip_id:
                continue
            
            stops = gtfs_stop_times[best_trip_id]
            print(f"    Direction {direction_id}: using trip {best_trip_id} ({len(stops)} stops)")
            
            # Try to find matching DB route
            # We'll insert with route_id=NULL if no match, but prefer matching
            matched_db_route_id = None
            
            # For each DB route, check if route names overlap
            for db_rid, db_rname, db_stype in db_routes:
                # Simple heuristic: check if key station names appear
                # More robust: we'll assign based on GTFS route naming
                pass  # We'll handle this below
            
            # Build coordinates for this route+direction
            coords = []
            for stop_entry in stops:
                gtfs_stop = gtfs_stops.get(stop_entry['stop_id'])
                if not gtfs_stop:
                    continue
                
                # Try to find matching DB station
                norm_stop = gtfs_stop['normalized']
                db_station_id = db_stations.get(norm_stop)
                
                coords.append({
                    'station_id': db_station_id,
                    'station_name': gtfs_stop['name'],
                    'lat': gtfs_stop['lat'],
                    'lon': gtfs_stop['lon'],
                    'stop_sequence': stop_entry['stop_sequence'],
                    'shape_dist_traveled': stop_entry['shape_dist_traveled'],
                })
            
            if not coords:
                print(f"    ✗ No coordinates found for direction {direction_id}")
                continue
            
            # Insert into route_shapes
            # We use a composite key: gtfs_route_id + direction as description
            # For route_id, we set NULL since GTFS routes may not map 1:1 to DB routes
            # The API will query all shapes regardless
            if not dry_run:
                for c in coords:
                    cursor.execute("""
                        INSERT INTO route_shapes (route_id, station_id, station_name, latitude, longitude, stop_sequence, shape_dist_traveled)
                        VALUES (NULL, %s, %s, %s, %s, %s, %s)
                    """, (c['station_id'], c['station_name'], c['lat'], c['lon'], c['stop_sequence'], c['shape_dist_traveled']))
                    total_inserted += 1
        
    if not dry_run:
        conn.commit()
    
    print(f"\n  Total route shape points inserted: {total_inserted}")
    return total_inserted


def deduplicate_shapes(conn, gtfs_stops, gtfs_routes, gtfs_trips, gtfs_stop_times, dry_run=False):
    """
    Build deduplicated route shapes: merge direction 0 and 1 into a single polyline per route.
    For rail, direction 0 and 1 share the same track, so we pick the direction with more stops.
    Stores shape_group, route_label, and route_color for proper grouping.
    """
    cursor = conn.cursor()
    
    # Get DB stations for matching
    cursor.execute("SELECT id, name FROM stations")
    db_stations = {normalize_name(name): sid for sid, name in cursor.fetchall()}
    
    # Group GTFS trips by route_id
    route_trips = defaultdict(list)
    for trip_id, trip_data in gtfs_trips.items():
        route_trips[trip_data['route_id']].append(trip_id)
    
    # Clear existing route_shapes
    if not dry_run:
        cursor.execute("DELETE FROM route_shapes")
        conn.commit()
    
    total_inserted = 0
    route_counter = 0
    
    for gtfs_route_id, trip_ids in route_trips.items():
        gtfs_route = gtfs_routes.get(gtfs_route_id, {})
        route_name = gtfs_route.get('long_name', gtfs_route_id)
        route_color = gtfs_route.get('color', '')
        if route_color and not route_color.startswith('#'):
            route_color = f'#{route_color}'
        
        # Fallback colors for routes missing color in GTFS
        if not route_color:
            name_upper = route_name.upper()
            if 'ELECTRIC TRAIN' in name_upper or 'ETS' in name_upper:
                route_color = '#FFB300'  # Gold for ETS
            elif 'TEBRAU' in name_upper or 'WOODLANDS' in name_upper:
                route_color = '#7B1FA2'  # Purple for Shuttle Tebrau
            elif 'EKSPRES RAKYAT' in name_upper:
                route_color = '#E65100'  # Orange for Intercity East Coast
            elif 'INTERCITY' in name_upper or 'SHUTTLE' in name_upper:
                route_color = '#00695C'  # Teal for other Intercity
            else:
                route_color = '#888888'
        
        # Pick the trip with the most stops across ALL directions for this route
        best_trip_id = None
        best_stop_count = 0
        
        for tid in trip_ids:
            stops = gtfs_stop_times.get(tid, [])
            if len(stops) > best_stop_count:
                best_stop_count = len(stops)
                best_trip_id = tid
        
        if not best_trip_id:
            continue
        
        stops = gtfs_stop_times[best_trip_id]
        route_counter += 1
        print(f"  [{route_counter}] Route '{route_name}' (color: {route_color}): using trip {best_trip_id} ({len(stops)} stops)")
        
        # Build coordinates
        coords = []
        for stop_entry in stops:
            gtfs_stop = gtfs_stops.get(stop_entry['stop_id'])
            if not gtfs_stop:
                continue
            
            norm_stop = gtfs_stop['normalized']
            db_station_id = db_stations.get(norm_stop)
            
            coords.append({
                'station_id': db_station_id,
                'station_name': gtfs_stop['name'],
                'lat': gtfs_stop['lat'],
                'lon': gtfs_stop['lon'],
                'stop_sequence': stop_entry['stop_sequence'],
                'shape_dist_traveled': stop_entry['shape_dist_traveled'],
            })
        
        if not coords:
            continue
        
        if not dry_run:
            for c in coords:
                cursor.execute("""
                    INSERT INTO route_shapes 
                    (route_id, station_id, station_name, latitude, longitude, stop_sequence, shape_dist_traveled, shape_group, route_label, route_color)
                    VALUES (NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (c['station_id'], c['station_name'], c['lat'], c['lon'], 
                      c['stop_sequence'], c['shape_dist_traveled'],
                      route_counter, route_name, route_color))
                total_inserted += 1
    
    if not dry_run:
        conn.commit()
    
    print(f"\n  Routes processed: {route_counter}")
    print(f"  Total shape points inserted: {total_inserted}")
    return total_inserted


def main():
    parser = argparse.ArgumentParser(description="Ingest GTFS station coordinates and build route shapes")
    parser.add_argument("--gtfs-dir", default="gtfs_data", help="Path to GTFS data directory")
    parser.add_argument("--dry-run", action="store_true", help="Parse but do not write to DB")
    parser.add_argument("--skip-stations", action="store_true", help="Skip updating station coordinates")
    parser.add_argument("--skip-shapes", action="store_true", help="Skip building route shapes")
    args = parser.parse_args()
    
    gtfs_dir = args.gtfs_dir
    if not os.path.isdir(gtfs_dir):
        print(f"GTFS directory not found: {gtfs_dir}")
        sys.exit(1)
    
    print("=" * 60)
    print("GTFS Station Coordinates & Route Shapes Ingestion")
    print("=" * 60)
    
    # Load GTFS data
    print("\n[1/2] Loading GTFS files...")
    gtfs_stops = load_gtfs_stops(gtfs_dir)
    print(f"  Loaded {len(gtfs_stops)} stops")
    
    gtfs_routes = load_gtfs_routes(gtfs_dir)
    print(f"  Loaded {len(gtfs_routes)} routes")
    
    gtfs_trips = load_gtfs_trips(gtfs_dir)
    print(f"  Loaded {len(gtfs_trips)} trips")
    
    gtfs_stop_times = load_gtfs_stop_times(gtfs_dir)
    print(f"  Loaded stop times for {len(gtfs_stop_times)} trips")
    
    conn = None
    if not args.dry_run:
        conn = get_db_connection()
    
    try:
        # Step 1: Update station coordinates
        if not args.skip_stations:
            print("\n[2a] Updating station coordinates...")
            if args.dry_run:
                print("  (DRY RUN - no DB changes)")
                # Just print what we'd match
                for stop_id, stop_data in list(gtfs_stops.items())[:10]:
                    print(f"  Would update: {stop_data['name']} -> ({stop_data['lat']}, {stop_data['lon']})")
                print(f"  ... and {len(gtfs_stops) - 10} more")
            else:
                update_station_coordinates(conn, gtfs_stops)
        
        # Step 2: Build route shapes
        if not args.skip_shapes:
            print("\n[2b] Building route shapes (deduplicated)...")
            if args.dry_run:
                print("  (DRY RUN - no DB changes)")
                # Show what routes we'd process
                route_trip_counts = defaultdict(int)
                for tid, td in gtfs_trips.items():
                    route_trip_counts[td['route_id']] += 1
                for rid, count in route_trip_counts.items():
                    rname = gtfs_routes.get(rid, {}).get('long_name', rid)
                    print(f"  Would process: {rname} ({count} trips)")
            else:
                deduplicate_shapes(conn, gtfs_stops, gtfs_routes, gtfs_trips, gtfs_stop_times)
        
        print("\n" + "=" * 60)
        print("Done!")
        print("=" * 60)
        
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    main()
