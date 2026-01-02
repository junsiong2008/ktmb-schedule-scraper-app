import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def verify():
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor()
        
        tables = ['routes', 'schedules', 'trips', 'stations', 'stop_times']
        
        print("--- Database Verification ---")
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"{table}: {count}")
            
        # Check specific recent insertion
        cursor.execute("SELECT name FROM routes ORDER BY id DESC LIMIT 1")
        last_route_row = cursor.fetchone()
        print(f"Last Route Inserted: {last_route_row[0] if last_route_row else 'None'}")

        # Check ETS specific
        cursor.execute("SELECT COUNT(*) FROM trips t JOIN schedules s ON t.schedule_id = s.id JOIN routes r ON s.route_id = r.id WHERE r.service_type = 'ETS'")
        ets_count = cursor.fetchone()[0]
        print(f"Total ETS Trips: {ets_count}")

        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify()
