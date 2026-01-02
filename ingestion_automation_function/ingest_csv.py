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
# Malay Month Mapping
MONTH_MAPPING = {
    "JANUARI": 1, "FEBRUARI": 2, "MAC": 3, "APRIL": 4, "MEI": 5, "JUN": 6,
    "JULAI": 7, "OGOS": 8, "SEPTEMBER": 9, "OKTOBER": 10, "NOVEMBER": 11, "DISEMBER": 12,
    "DIS": 12, # Abbreviation for DISEMBER
    "JAN": 1, "FEB": 2, "APR": 4, "MAY": 5, "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12 # Common short forms
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
    """Parses a Malay date string (e.g., '25 OGOS 2025' or '12 Dis 2025') into a Python date object."""
    try:
        parts = date_str.strip().upper().split()
        if len(parts) != 3:
            return None
        day = int(parts[0])
        month_str = parts[1]
        year = int(parts[2])
        
        month = MONTH_MAPPING.get(month_str)
        if not month:
            # Try matching partial keys? No, dictionary lookup is exact.
            return None
            
        return datetime(year, month, day).date()
    except Exception as e:
        print(f"Error parsing date '{date_str}': {e}")
        return None

def extract_metadata(df, filename=""):
    """Extracts metadata from the second row (index 1) of the CSV or filename fallback."""
    
    # Attempt to read from file content first
    meta_row = ""
    # Scan first 5 rows for metadata
    found_metadata = False
    for i in range(min(5, df.shape[0])):
        if pd.notna(df.iloc[i, 0]):
            val = str(df.iloc[i, 0]).upper()
            if "LALUAN" in val or "ETS" in val or "MULAI" in val:
                meta_row = val
                found_metadata = True
                break
    
    if not found_metadata and df.shape[0] > 1:
         meta_row = str(df.iloc[1, 0]) if pd.notna(df.iloc[1, 0]) else ""
    
    # Defaults
    service_type = None
    route_name = "Unknown Route"
    valid_from = None
    day_type = "Weekday" # Default to Weekday

    # 1. Determine Service Type
    if "ETS" in meta_row or "ETS" in filename.upper():
        service_type = "ETS"
    elif "INTERCITY" in meta_row or "INTERCITY" in filename.upper():
        service_type = "Intercity"
    else:
        service_type = "Komuter" # Default to Komuter usually
    
    # 2. Determine Route Name
    # Try from file content pattern
    route_match = re.search(r"LALUAN (.*?) (?:TAHUN|BERKUATKUASA)", meta_row)
    if route_match:
        route_name = route_match.group(1).strip()
    else:
        route_match = re.search(r"LALUAN (.*?) \(", meta_row)
        if route_match:
             route_name = route_match.group(1).strip()
        else:
            # Check for "KOMUTER [ROUTE] [HARI...]"
            route_match = re.search(r"KOMUTER (.*?) (?:HARI|SABTU|AHAD|MULAI)", meta_row)
            if route_match:
                route_name = route_match.group(1).strip()
    
    # Fallback to Filename or Header inference for ETS
    if route_name == "Unknown Route" and service_type == "ETS":
        # Check specific headers in file to guess direction/route
        # Scan first few rows for direction
        direction_hint = ""
        for i in range(min(5, df.shape[0])):
            row_val = str(df.iloc[i, 0]).upper()
            if "UTARA" in row_val or "NORTHBOUND" in row_val:
                direction_hint = "Northbound"
                break
            elif "SELATAN" in row_val or "SOUTHBOUND" in row_val:
                direction_hint = "Southbound"
                break
        
        if direction_hint:
             # ETS is usually Gemas - Padang Besar
             if direction_hint == "Northbound":
                 route_name = "Gemas - Padang Besar (Northbound)"
             else:
                 route_name = "Padang Besar - Gemas (Southbound)"
        else:
             route_name = f"ETS Route ({filename})"


    # 3. Determine Valid From Date
    # Try logic in file content "MULAI ..."
    mulai_match = re.search(r"MULAI (.*)", meta_row)
    if mulai_match:
        date_str = mulai_match.group(1).strip()
        valid_from = parse_malay_date(date_str)
    
    # Fallback to filename regex (e.g. "12 Dis 2025" or "1 Jan 2026")
    if not valid_from:
        date_match = re.search(r"(\d{1,2} [a-zA-Z]+ \d{4})", filename)
        if date_match:
             valid_from = parse_malay_date(date_match.group(1))

    # 4. Determine Day Type
    if "HARI BEKERJA" in meta_row:
        day_type = "Weekday"
    elif "KELEPASAN AM" in meta_row or "SABTU" in meta_row:
        day_type = "Weekend"
    else:
        # Fallback based on filename? If not specified, usually daily for ETS?
        # ETS usually runs daily unless specified otherwise.
        if service_type == "ETS":
             day_type = "Daily"
        
    return {
        "service_type": service_type,
        "route_name": route_name,
        "valid_from": valid_from,
        "day_type": day_type,
        "raw_string": meta_row
    }

def ingest_csv(csv_path, dry_run=False):
    filename = os.path.basename(csv_path)
    print(f"Processing {filename}...")
    
    # Read CSV
    # We read without header first to locate things
    raw_df = pd.read_csv(csv_path, header=None)
    metadata = extract_metadata(raw_df, filename)
    
    print(f"Metadata extracted: {metadata}")
    
    if not metadata['valid_from']:
        print("Warning: Could not parse logical start date. Skipping file.")
        if not dry_run:
            return # Skip instead of crashing
    
    # Find the header row (containing "TRAIN NUMBER" or "STESEN")
    stesen_row_idx = None
    for idx, row in raw_df.iterrows():
        first_col = str(row[0]).upper()
        if "TRAIN NUMBER" in first_col or "STESEN" in first_col or "STATION" in first_col or "NOMBOR TREN" in first_col:
            stesen_row_idx = idx
            break
            
    if stesen_row_idx is None:
        print("Error: Could not find Header row (TRAIN NUMBER / STATION).")
        return

    # Check if this row actually contains train numbers (cols > 0)
    # If not, check the next row
    header_row_idx = stesen_row_idx
    header_series = raw_df.iloc[stesen_row_idx]
    
    has_data = False
    for col_idx in range(1, len(header_series)):
        if pd.notna(header_series.iloc[col_idx]) and str(header_series.iloc[col_idx]).strip():
            has_data = True
            break
    
    if not has_data:
        # Check next row
        next_idx = stesen_row_idx + 1
        if next_idx < len(raw_df):
            next_series = raw_df.iloc[next_idx]
            # Check if THIS has data
            has_next_data = False
            for col_idx in range(1, len(next_series)):
                 if pd.notna(next_series.iloc[col_idx]) and str(next_series.iloc[col_idx]).strip():
                    has_next_data = True
                    break
            
            if has_next_data:
                print(f"Detected split header. 'STESEN' at {stesen_row_idx}, Train Numbers at {next_idx}")
                header_row_idx = next_idx

    # Extract the header row content
    # header_row = raw_df.iloc[header_row_idx].tolist()
    
    # Identify Data Columns and Clean Headers using indices from raw_df
    # We define df_data as raw_df to prevent confusion, we will iterate using explicit integer indexing.
    # df_data = raw_df 
    
    # Identify Train Columns by Index
    # Map col_idx -> List of train numbers (since one cell might have multiple)
    col_idx_to_train_nos = {}
    
    header_row_series = raw_df.iloc[header_row_idx]
    
    # Iterate over columns starting from index 1 (skip Station Name at 0)
    for col_idx in range(1, len(header_row_series)):
        cell_val = header_row_series.iloc[col_idx] if hasattr(header_row_series, 'iloc') else header_row_series[col_idx]
        if pd.notna(cell_val) and isinstance(cell_val, str) and cell_val.strip():
             # Check if it contains multiple train numbers separated by space or newline
             cleaned_val = cell_val.strip().replace('\n', ' ')
             train_nos = [t.strip() for t in cleaned_val.split() if t.strip()]
             
             if train_nos:
                 col_idx_to_train_nos[col_idx] = train_nos
             
    if not col_idx_to_train_nos:
         print("Error: No train numbers found in header.")
         return
    
    print(f"Found {len(col_idx_to_train_nos)} train columns (some may have merged trains).")
    
    conn = None
    if not dry_run:
        conn = get_db_connection()
        cursor = conn.cursor()
    
    try:
        if not dry_run:
            # 1. Upsert Route
            cursor.execute("SELECT id FROM routes WHERE name = %s AND service_type = %s", (metadata['route_name'], metadata['service_type']))
            route = cursor.fetchone()
            if not route:
                cursor.execute("INSERT INTO routes (name, service_type) VALUES (%s, %s) RETURNING id", (metadata['route_name'], metadata['service_type']))
                route_id = cursor.fetchone()[0]
            else:
                route_id = route[0]

            # 2. Create Schedule
            cursor.execute("""
                INSERT INTO schedules (route_id, valid_from, day_type, source_file)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (route_id, metadata['valid_from'], metadata['day_type'], filename))
            schedule_id = cursor.fetchone()[0]
            
            # 3. Create Trips
            # We map the DataFrame column INDEX to a LIST of created Trip IDs
            col_to_trip_ids = {}
            
            # Direction Inference fallback
            direction = "Unknown"
            if "Northbound" in metadata['route_name'] or "UTARA" in metadata['route_name'].upper():
                direction = "Northbound"
            elif "Southbound" in metadata['route_name'] or "SELATAN" in metadata['route_name'].upper():
                 direction = "Southbound"

            # Iterate through identified column indices
            for col_idx, train_nos in col_idx_to_train_nos.items():
                trip_ids = []
                for train_no in train_nos:
                    cursor.execute("""
                        INSERT INTO trips (schedule_id, train_number, direction)
                        VALUES (%s, %s, %s)
                        RETURNING id
                    """, (schedule_id, train_no, direction))
                    trip_ids.append(cursor.fetchone()[0])
                col_to_trip_ids[col_idx] = trip_ids

            conn.commit()
            total_trips = sum(len(ids) for ids in col_to_trip_ids.values())
            print(f"Created Schedule ID: {schedule_id} with {total_trips} trips.")
        else:
             # Dry run simulation
             col_to_trip_ids = {}
             total_trips = 0
             # Just map to dummy IDs
             for col_idx, train_nos in col_idx_to_train_nos.items():
                 # Create a dummy ID for EACH train number in the cell
                 dummy_ids = [f"dry_trip_{train_no}" for train_no in train_nos]
                 col_to_trip_ids[col_idx] = dummy_ids
                 total_trips += len(dummy_ids)
             
             print(f"Dry Run: Would create {total_trips} trips.")


        # 4. Process Stop Times
        stop_times_batch = []
        stop_seq = 0
        
        # We assume Station Name is Column 0
        station_col_idx = 0
        
        # Iterate over raw_df starting from header_row_idx + 1
        for idx in range(header_row_idx + 1, len(raw_df)):
            row = raw_df.iloc[idx]
            station_name = str(row[station_col_idx]).strip()
            
            if not station_name or station_name.lower() in ['nan', 'stesen/station', 'station']:
                continue
            
            # Skip if it's the metadata rows (checking again just in case)
            if idx <= header_row_idx:
                continue

            stop_seq += 1
            
            station_id = None
            if not dry_run:
                cursor.execute("""
                    INSERT INTO stations (name) VALUES (%s)
                    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                    RETURNING id
                """, (station_name,))
                station_id = cursor.fetchone()[0]

            # Iterate over valid train columns
            for col_idx, trip_ids in col_to_trip_ids.items():
                time_val = str(row[col_idx]).strip()
                
                # Check valid time format (HH:MM)
                # Ignore '-', empty, NaN
                if time_val and time_val.lower() not in ['nan', '-', '--', '---']:
                    try:
                        # Sometimes cells have garbage like "08:40." or spaces
                        clean_time = time_val.replace('.', ':').strip()
                        
                        if ':' in clean_time:
                            parts = clean_time.split(':')
                            h = int(parts[0])
                            m = int(parts[1])
                            # Basic validation
                            if 0 <= h <= 30 and 0 <= m <= 59:
                                if h >= 24: h -= 24
                                time_formatted = f"{h:02d}:{m:02d}:00"
                                
                                # Insert stop time for EVERY trip sharing this column
                                for trip_id in trip_ids:
                                    if not dry_run:
                                        stop_times_batch.append((trip_id, station_id, time_formatted, time_formatted, stop_seq))
                                    else:
                                        pass # Dry run
                    except ValueError:
                        pass # Not a time
                        
        # Batch Insert
        if not dry_run and stop_times_batch:
            print(f"Inserting {len(stop_times_batch)} stop times...")
            try:
                args_str = ','.join(cursor.mogrify("(%s,%s,%s,%s,%s)", x).decode('utf-8') for x in stop_times_batch)
                cursor.execute("INSERT INTO stop_times (trip_id, station_id, arrival_time, departure_time, stop_sequence) VALUES " + args_str)
                conn.commit()
            except Exception as e:
                print(f"Batch insert failed: {e}")
                conn.rollback()
        elif dry_run:
            print(f"Dry Run: parsed stations.")

    except Exception as e:
        if conn: conn.rollback()
        print(f"Error processing file: {e}")
        raise
    finally:
        if conn: conn.close()
        
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
        csv_files.sort() 
        
        print(f"Found {len(csv_files)} CSV files in {args.input_path}")
        
        for f in csv_files:
            full_path = os.path.join(args.input_path, f)
            try:
                ingest_csv(full_path, args.dry_run)
            except Exception as e:
                print(f"Failed to ingest {f}: {e}")
                
    elif os.path.isfile(args.input_path):
        # Single file mode
        ingest_csv(args.input_path, args.dry_run)
    else:
        print(f"Path not found: {args.input_path}")
