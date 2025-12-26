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
        last_route = cursor.fetchone()
        print(f"Last Route Inserted: {last_route[0] if last_route else 'None'}")

        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify()
