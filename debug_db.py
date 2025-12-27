import os
import psycopg2
from dotenv import load_dotenv

# Load env from the api directory
load_dotenv('/Users/tengjunsiong/Projects/ktmb0t/Stack/ktmb_timetable/ktmb_api/.env')

def check_db():
    try:
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            print("DATABASE_URL not found in .env")
            return

        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()

        print("--- Routes ---")
        cursor.execute("SELECT id, name, service_type FROM routes WHERE service_type = 'ETS'")
        routes = cursor.fetchall()
        print(f"Found {len(routes)} ETS routes:")
        for r in routes:
            print(r)
            
        if not routes:
            print("No ETS routes found. Checking all service types...")
            cursor.execute("SELECT DISTINCT service_type FROM routes")
            print(cursor.fetchall())
            return

        print("\n--- Schedules for 28 Dec 2025 ---")
        # Check if we have valid schedules covering this date
        cursor.execute("""
            SELECT s.id, s.valid_from, s.valid_to, s.day_type, r.name 
            FROM schedules s 
            JOIN routes r ON s.route_id = r.id 
            WHERE r.service_type = 'ETS'
        """)
        schedules = cursor.fetchall()
        print(f"Found {len(schedules)} ETS schedules:")
        for s in schedules:
            print(s)

        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
