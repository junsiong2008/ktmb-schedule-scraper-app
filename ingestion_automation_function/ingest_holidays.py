"""Fill the public_holidays table.

Holidays come from the `holidays` package (Malaysia, Kuala Lumpur by default),
plus any extra dates in holiday_overrides.csv, for example a one-off holiday
the government announces at short notice.

Usage:
    python ingest_holidays.py                 # this year and next
    python ingest_holidays.py --years 2026 2027
    python ingest_holidays.py --dry-run
"""
import argparse
import csv
import os
import sys
from datetime import date, datetime

import holidays
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DEFAULT_STATE = 'KUL'
OVERRIDES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'holiday_overrides.csv')

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS public_holidays (
    holiday_date DATE NOT NULL,
    state VARCHAR(10) NOT NULL DEFAULT 'KUL',
    name VARCHAR(255) NOT NULL,
    PRIMARY KEY (holiday_date, state)
);
"""


def load_overrides(path=OVERRIDES_FILE):
    """Read extra holidays (date,name) from the overrides CSV, if it exists."""
    extra = {}
    if not os.path.isfile(path):
        return extra
    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            raw = (row.get('date') or '').strip()
            if not raw or raw.startswith('#'):
                continue
            extra[datetime.strptime(raw, '%Y-%m-%d').date()] = (row.get('name') or 'Public holiday').strip()
    return extra


def build_holidays(years, state=DEFAULT_STATE):
    """Return {date: name} for the given years and state."""
    result = dict(holidays.Malaysia(subdiv=state, years=years, language='en_US').items())
    for d, name in load_overrides().items():
        if d.year in years:
            result[d] = name
    return result


def ingest_holidays(years=None, state=DEFAULT_STATE, dry_run=False):
    years = years or [date.today().year, date.today().year + 1]
    rows = sorted(build_holidays(years, state).items())
    print(f"Found {len(rows)} holidays for {state} in {', '.join(map(str, years))}")

    if dry_run:
        for d, name in rows:
            print(f"  {d}  {name}")
        return rows

    if not os.environ.get('DATABASE_URL'):
        print('DATABASE_URL is not set.')
        sys.exit(1)
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    try:
        cur = conn.cursor()
        cur.execute(CREATE_TABLE_SQL)
        # Replace the covered years so holidays that were moved or dropped don't linger.
        cur.execute(
            "DELETE FROM public_holidays WHERE state = %s AND EXTRACT(YEAR FROM holiday_date) = ANY(%s)",
            (state, list(years)),
        )
        cur.executemany(
            "INSERT INTO public_holidays (holiday_date, state, name) VALUES (%s, %s, %s)",
            [(d, state, name[:255]) for d, name in rows],
        )
        conn.commit()
        print(f"Inserted {len(rows)} holidays.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return rows


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fill the public_holidays table')
    parser.add_argument('--years', type=int, nargs='+', help='Years to load (default: this year and next)')
    parser.add_argument('--state', default=DEFAULT_STATE, help='Malaysian state code (default: KUL)')
    parser.add_argument('--dry-run', action='store_true', help='Print holidays without writing to the DB')
    args = parser.parse_args()
    ingest_holidays(args.years, args.state, args.dry_run)
