import os
import json
import psycopg2
import math
import argparse
from typing import List, Dict, Tuple, Any

# Map DB shape_group ID to Overpass route name(s).
# If multiple names are provided, we pick the one that has a feature with the most points.
DB_GROUP_TO_OVERPASS = {
    1: ['Port Klang Line (northbound)', 'Port Klang Line (southbound)'],
    2: ['Laluan Seremban'],
    3: ['Butterworth–Padang Besar (northbound)', 'Butterworth–Padang Besar (southbound)'],
    4: ['Butterworth–Ipoh (northbound)', 'Butterworth–Ipoh (southbound)'],
    8: ['ETS Gold (Padang Besar - Gemas)', 'ETS Gold (Gemas - Padang Besar)', 'ETS Gold (Gemas - Butterworth)'],
}

def haversine_dist(lat1, lon1, lat2, lon2):
    R = 6371e3
    phi1 = lat1 * math.pi / 180
    phi2 = lat2 * math.pi / 180
    dphi = (lat2 - lat1) * math.pi / 180
    dlam = (lon2 - lon1) * math.pi / 180
    a = math.sin(dphi / 2) * math.sin(dphi / 2) + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(dlam / 2) * math.sin(dlam / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def find_best_overpass_feature(features, names):
    best_feature = None
    max_pts = 0
    for f in features:
        props = f.get('properties', {})
        name = props.get('name', '')
        if name in names and f.get('geometry', {}).get('type') == 'LineString':
            coords = f['geometry']['coordinates']
            if len(coords) > max_pts:
                max_pts = len(coords)
                best_feature = f
    return best_feature

def get_db_connection():
    from dotenv import load_dotenv
    # try looking for .env in current dir and parent
    load_dotenv('../ktmb_api/.env')
    return psycopg2.connect(
        dbname=os.environ.get("DB_NAME", "ktmbdb"),
        user=os.environ.get("DB_USER", "postgres"),
        host=os.environ.get("DB_HOST", "localhost"),
        password=os.environ.get("DB_PASSWORD", "password"),
        port=5432
    )

def ingest_overpass_shapes(json_path: str, dry_run: bool = False):
    with open(json_path, 'r') as f:
        data = json.load(f)
    features = data.get('features', [])

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get distinct shape_groups
    cursor.execute("SELECT shape_group, route_label, route_color, gtfs_route_id FROM route_shapes GROUP BY shape_group, route_label, route_color, gtfs_route_id ORDER BY shape_group")
    groups = cursor.fetchall()
    
    total_new_points = 0

    for group_row in groups:
        shape_group, route_label, route_color, gtfs_route_id = group_row
        print(f"\nProcessing Group {shape_group}: {route_label}")

        if shape_group not in DB_GROUP_TO_OVERPASS:
            print("  Skipping: No Overpass mapping defined (fallback to straight lines).")
            continue

        overpass_names = DB_GROUP_TO_OVERPASS[shape_group]
        best_feature = find_best_overpass_feature(features, overpass_names)
        
        if not best_feature:
            print(f"  Skipping: Could not find any LineString in ktm.json matching {overpass_names}.")
            continue

        overpass_coords = best_feature['geometry']['coordinates']
        print(f"  Found matching Overpass geometry with {len(overpass_coords)} points.")

        # Fetch existing stations for this group
        cursor.execute("""
            SELECT station_id, station_name, latitude, longitude, shape_dist_traveled, gtfs_stop_id, route_id, stop_sequence 
            FROM route_shapes 
            WHERE shape_group = %s AND station_name IS NOT NULL
            ORDER BY stop_sequence ASC
        """, (shape_group,))
        stations = cursor.fetchall()

        if not stations:
            print("  Skipping: No existing stations found for this group.")
            continue

        # Check alignment: Is the Overpass line stored in the same sequence direction as our stations?
        # stations are ordered by stop_sequence
        first_station = stations[0]
        last_station = stations[-1]
        
        # overpass_coords is [lon, lat]
        op_first = overpass_coords[0]
        op_last = overpass_coords[-1]

        # Calculate dist from first station to OP's start and end
        dist_s0_op0 = haversine_dist(first_station[2], first_station[3], op_first[1], op_first[0])
        dist_s0_opN = haversine_dist(first_station[2], first_station[3], op_last[1], op_last[0])

        if dist_s0_opN < dist_s0_op0:
            print("  Reversing Overpass coordinates to match station sequence direction.")
            overpass_coords = list(reversed(overpass_coords))

        # We will clear the existing rows for this shape_group and re-insert 
        # both shape points and station points.
        if not dry_run:
            cursor.execute("DELETE FROM route_shapes WHERE shape_group = %s", (shape_group,))
        
        # Insert shape points with integer sequences (e.g., 10, 20, 30...)
        # We will find the nearest shape point for each station to determine its insertion seq.
        station_inserts = []
        for st in stations:
            st_lat, st_lon = st[2], st[3]
            min_d = float('inf')
            best_idx = 0
            for i, op_pt in enumerate(overpass_coords):
                d = haversine_dist(st_lat, st_lon, op_pt[1], op_pt[0])
                if d < min_d:
                    min_d = d
                    best_idx = i
            # Station will be placed slightly after the closest Overpass point
            # seq = best_idx * 10 + 5 
            station_inserts.append({
                'station_id': st[0],
                'station_name': st[1],
                'latitude': st[2],
                'longitude': st[3],
                'shape_dist_traveled': st[4],
                'gtfs_stop_id': st[5],
                'route_id': st[6],
                'seq_score': best_idx * 10 + 5
            })

        # To avoid identical sequences (if 2 stations snap to same point), we ensure monotonic increase
        for i in range(1, len(station_inserts)):
            if station_inserts[i]['seq_score'] <= station_inserts[i-1]['seq_score']:
                station_inserts[i]['seq_score'] = station_inserts[i-1]['seq_score'] + 1

        inserts = []
        # Add pure shape coords (station_name = NULL)
        for i, op_pt in enumerate(overpass_coords):
            inserts.append({
                'route_id': None, # We don't have route_id mostly
                'station_id': None,
                'station_name': None,
                'latitude': op_pt[1],
                'longitude': op_pt[0],
                'shape_dist_traveled': None,
                'gtfs_stop_id': None,
                'seq_score': i * 10
            })
        
        # Combine and sort by seq_score
        all_inserts = inserts + station_inserts
        all_inserts.sort(key=lambda x: x['seq_score'])

        # Final insertion sequentially
        import psycopg2.extras
        
        insert_data = []
        current_seq = 1
        for row in all_inserts:
            insert_data.append((
                row['route_id'], row['station_id'], row['station_name'], 
                row['latitude'], row['longitude'], current_seq, 
                row['shape_dist_traveled'], shape_group, route_label, 
                route_color, gtfs_route_id, row['gtfs_stop_id']
            ))
            current_seq += 1
            
        if not dry_run and insert_data:
            psycopg2.extras.execute_values(
                cursor,
                """
                INSERT INTO route_shapes 
                (route_id, station_id, station_name, latitude, longitude, stop_sequence, shape_dist_traveled, 
                 shape_group, route_label, route_color, gtfs_route_id, gtfs_stop_id)
                VALUES %s
                """,
                insert_data
            )
        
        points_inserted = len(insert_data)
        print(f"  Inserted {points_inserted} mixed (shape + station) points.")
        total_new_points += points_inserted

    if not dry_run:
        conn.commit()
    print(f"\nDone! Total rows inserted across modified groups: {total_new_points}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser("Ingest high-res Overpass shapes into route_shapes")
    parser.add_argument("--json", default="ktmb_api/ktmb_overpass_route/ktm.json")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    ingest_overpass_shapes(args.json, args.dry_run)
