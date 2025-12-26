
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def check_schema():
    try:
        url = os.environ.get('DATABASE_URL')
        if not url:
            print("DATABASE_URL not found in env")
            return
            
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'routes';")
        columns = cur.fetchall()
        
        print("Columns in 'routes' table:")
        for col in columns:
            print(f"- {col[0]} ({col[1]})")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_schema()
