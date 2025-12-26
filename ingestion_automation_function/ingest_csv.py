import os
import sys
import pandas as pd
import psycopg2
import re
import argparse
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Malay Month Mapping
MONTH_MAPPING = {
    "JANUARI": 1, "FEBRUARI": 2, "MAC": 3, "APRIL": 4, "MEI": 5, "JUN": 6,
    "JULAI": 7, "OGOS": 8, "SEPTEMBER": 9, "OKTOBER": 10, "NOVEMBER": 11, "DISEMBER": 12
}

def get_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)

def parse_malay_date(date_str):
    """Parses a Malay date string (e.g., '25 OGOS 2025') into a Python date object."""
    try:
        parts = date_str.strip().upper().split()
        if len(parts) != 3:
            return None
        day = int(parts[0])
        month_str = parts[1]
        year = int(parts[2])
        
        month = MONTH_MAPPING.get(month_str)
        if not month:
            return None
            
        return datetime(year, month, day).date()
    except Exception as e:
        print(f"Error parsing date '{date_str}': {e}")
        return None

def extract_metadata(df):
    """Extracts metadata from the second row (index 1) of the CSV."""
    # Example: JADUAL WAKTU KOMUTER LALUAN BATU CAVES KE PULAU SEBANG TAHUN 2025 (HARI BEKERJA) MULAI 25 OGOS 2025
    # Row 1 in 0-indexed DF is the second row of the file
    
    # We load the dataframe with header=2 effectively to get the "TRAIN NUMBER" as header, 
    # but we need to read the raw meta row first.
    # Let's assume we read the whole file without header first to get meta.
    
    meta_row = df.iloc[1, 0] # Column 0 of Row 1
    
    # Defaults
    service_type = "Komuter" # specific to this CSV structure usually
    if "ETS" in meta_row:
        service_type = "ETS"
    elif "INTERCITY" in meta_row:
        service_type = "Intercity"
        
    route_name = "Unknown Route"
    route_match = re.search(r"LALUAN (.*?) (?:TAHUN|BERKUATKUASA)", meta_row)
    if route_match:
        route_name = route_match.group(1).strip()
    else:
        # Fallback regex if TAHUN is not present or slightly different
        route_match = re.search(r"LALUAN (.*?) \(", meta_row)
        if route_match:
             route_name = route_match.group(1).strip()

    valid_from = None
    mulai_match = re.search(r"MULAI (.*)", meta_row)
    if mulai_match:
        date_str = mulai_match.group(1).strip()
        # Remove trailing commas or empty cells representation if pandas read them into the string? 
        # Usually it's just the string in the cell.
        valid_from = parse_malay_date(date_str)
        
    day_type = "Weekday"
    if "HARI BEKERJA" in meta_row:
        day_type = "Weekday"
    elif "KELEPASAN AM" in meta_row or "SABTU" in meta_row:
        day_type = "Weekend"
        
    return {
        "service_type": service_type,
        "route_name": route_name,
        "valid_from": valid_from,
        "day_type": day_type,
        "raw_string": meta_row
    }

def ingest_csv(csv_path, dry_run=False):
    print(f"Processing {csv_path}...")
    
    # Read first few lines to get metadata
    # We assume standard format:
    # Row 0: Empty or numbers
    # Row 1: Title/Meta
    # Row 2: "NOMBOR TRIP", 1, 2, ...
    # Row 3: "TRAIN NUMBER", 2003, ...
    # Row 4+: Data
    
    raw_df = pd.read_csv(csv_path, header=None)
    metadata = extract_metadata(raw_df)
    
    print(f"Metadata extracted: {metadata}")
    
    if not metadata['valid_from']:
        print("Warning: Could not parse logical start date. Using today?? No, failing.")
        if not dry_run:
            sys.exit("Error: Valid From date is parsing failed.")
    
    # Find the header row (containing "TRAIN NUMBER")
    # In the sample: Row index 3 (0-based) starts with "TRAIN NUMBER"
    header_row_idx = None
    for idx, row in raw_df.iterrows():
        if isinstance(row[0], str) and "TRAIN NUMBER" in row[0]:
            header_row_idx = idx
            break
            
    if header_row_idx is None:
        sys.exit("Error: Could not find 'TRAIN NUMBER' row.")
        
    # Reload DF with correct header
    df = pd.read_csv(csv_path, header=header_row_idx)
    
    # Clean train numbers columns
    # The first column is usually 'TRAIN NUMBER' or station names in subsequent rows.
    # The columns AFTER the first one are the train numbers.
    train_columns = df.columns[1:] # All columns except the first
    
    # Filter out columns that might be unnamed or empty if trailing commas exist
    valid_train_cols = [c for c in train_columns if str(c).strip() != '' and 'Unnamed' not in str(c)]
    
    conn = None
    if not dry_run:
        conn = get_db_connection()
        cursor = conn.cursor()
    
    try:
        if not dry_run:
            # 1. Upsert Route
            cursor.execute("""
                INSERT INTO routes (name, service_type)
                VALUES (%s, %s)
                ON CONFLICT (id) DO NOTHING -- Routes usually don't have unique name constraint in schema, but let's check duplicates manually?
                -- Schema says routes.id is PK, no unique constraint on name.
                -- We should check if it exists first to avoid duplicates.
            """, (metadata['route_name'], metadata['service_type']))
            
            # Since name isn't unique, let's select to see if it exists
            cursor.execute("SELECT id FROM routes WHERE name = %s AND service_type = %s", (metadata['route_name'], metadata['service_type']))
            route = cursor.fetchone()
            if not route:
                cursor.execute("INSERT INTO routes (name, service_type) VALUES (%s, %s) RETURNING id", (metadata['route_name'], metadata['service_type']))
                route_id = cursor.fetchone()[0]
            else:
                route_id = route[0]

            # 2. Create Schedule
            # Usually we might want to update if matches same file/date, but let's insert new for now
            cursor.execute("""
                INSERT INTO schedules (route_id, valid_from, day_type, source_file)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (route_id, metadata['valid_from'], metadata['day_type'], os.path.basename(csv_path)))
            schedule_id = cursor.fetchone()[0]
            
            # Map column index to trip_id
            col_to_trip_id = {}
            for col_name in valid_train_cols:
                train_no = str(col_name).split('.')[0] # Handle 2003.0 if pandas parsed as float
                
                # Direction Inference
                # If Route is "Batu Caves - Pulau Sebang", and this is one direction, usually the file represents one direction?
                # The sample CSV name implies "Batu Caves ke Pulau Sebang".
                # If the filename or route name has "KE", we can infer.
                direction = "Unknown"
                if " KE " in metadata['route_name']:
                    direction = metadata['route_name'] # e.g. "BATU CAVES KE PULAU SEBANG"
                
                cursor.execute("""
                    INSERT INTO trips (schedule_id, train_number, direction)
                    VALUES (%s, %s, %s)
                    RETURNING id
                """, (schedule_id, train_no, direction))
                trip_id = cursor.fetchone()[0]
                col_to_trip_id[col_name] = trip_id

            conn.commit()
            print(f"Created Schedule ID: {schedule_id} with {len(valid_train_cols)} trips.")

        # 3. Process Stations and Times
        stop_times_batch = []
        
        # Iterate over the rows of the dataframe
        stop_seq = 0
        for idx, row in df.iterrows():
            station_name = str(row[df.columns[0]]).strip()
            
            # Skip empty rows or weird headers if they leaked
            if not station_name or station_name.lower() == 'nan':
                continue
                
            stop_seq += 1
            
            if not dry_run:
                # Upsert Station
                # We need station_id for stop_times, so we still have to query/insert station one by one 
                # unless we bulk fetch stations. But stations are few (30-50).
                cursor.execute("""
                    INSERT INTO stations (name) VALUES (%s)
                    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                    RETURNING id
                """, (station_name,))
                station_id = cursor.fetchone()[0]
                
                # Collect Stop Times for batch insert
                for col_name in valid_train_cols:
                    time_val = str(row[col_name]).strip()
                    if time_val and time_val.lower() != 'nan':
                        # Parse time
                        try:
                            if ':' in time_val:
                                parts = time_val.split(':')
                                h = int(parts[0])
                                m = int(parts[1])
                                if h >= 24:
                                    h = h - 24
                                time_formatted = f"{h:02d}:{m:02d}:00"
                                
                                trip_id = col_to_trip_id[col_name]
                                
                                stop_times_batch.append((trip_id, station_id, time_formatted, time_formatted, stop_seq))
                        except Exception as e:
                            print(f"Error parsing time {time_val} for station {station_name}: {e}")
        
        # Batch Insert Stop Times
        if not dry_run and stop_times_batch:
            print(f"Inserting {len(stop_times_batch)} stop times...")
            try:
                args_str = ','.join(cursor.mogrify("(%s,%s,%s,%s,%s)", x).decode('utf-8') for x in stop_times_batch)
                cursor.execute("INSERT INTO stop_times (trip_id, station_id, arrival_time, departure_time, stop_sequence) VALUES " + args_str)
            except Exception as e:
                print(f"Batch insert failed, fallback to executemany: {e}")
                # Fallback to executemany if mogrify fails (unlikely)
                cursor.executemany("""
                    INSERT INTO stop_times (trip_id, station_id, arrival_time, departure_time, stop_sequence)
                    VALUES (%s, %s, %s, %s, %s)
                """, stop_times_batch)
                
        if not dry_run:
            conn.commit()
            print("Ingestion complete.")
        else:
            print("Dry run complete. No changes made to DB.")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error during processing: {e}")
        raise
    finally:
        if conn:
            conn.close()


def truncate_tables():
    """Truncates all tables to clear data before ingestion."""
    print("Truncating all tables...")
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("TRUNCATE routes, schedules, trips, stations, stop_times RESTART IDENTITY CASCADE;")
        conn.commit()
        print("Tables truncated successfully.")
    except Exception as e:
        print(f"Error truncating tables: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest KTMB Timetable CSV")
    parser.add_argument("input_path", help="Path to the CSV file or directory containing CSV files")
    parser.add_argument("--dry-run", action="store_true", help="Parse but do not insert into DB")
    
    args = parser.parse_args()
    
    if os.path.isdir(args.input_path):
        # Bulk mode
        if not args.dry_run:
            truncate_tables()
            
        csv_files = [f for f in os.listdir(args.input_path) if f.lower().endswith('.csv')]
        csv_files.sort() # Ensure deterministic order
        
        print(f"Found {len(csv_files)} CSV files in {args.input_path}")
        
        for f in csv_files:
            full_path = os.path.join(args.input_path, f)
            try:
                ingest_csv(full_path, args.dry_run)
            except Exception as e:
                print(f"Failed to ingest {f}: {e}")
                # Continue with other files? Yes.
                
    elif os.path.isfile(args.input_path):
        # Single file mode
        ingest_csv(args.input_path, args.dry_run)
    else:
        print(f"Path not found: {args.input_path}")
