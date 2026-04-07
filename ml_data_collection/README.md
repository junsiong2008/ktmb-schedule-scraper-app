# KTMB ML Data Collector

Polls the KTMB GTFS-Realtime vehicle position feed every 30 seconds and stores train positions into a TimescaleDB hypertable. The data is intended for training a train delay prediction model.

The collector:
- Fetches live vehicle positions from `api.data.gov.my`
- Skips vehicles whose feed timestamp hasn't changed (deduplication)
- Snaps each train's GPS position to the nearest station (Haversine, 300m threshold)
- Batch-inserts rows into `vehicle_positions_log`
- Refreshes route shapes from the DB every 24 hours

> **Prerequisite:** The main app database (`ktmb_api`) must already be set up and populated with timetable data, because the collector reads from the `route_shapes` table to perform station snapping.

---

## Server Requirements

- Ubuntu 22.04 (or similar)
- Node.js >= 18
- PostgreSQL with TimescaleDB installed and running
- IAM role `roles/iap.tunnelResourceAccessor` granted to your Google account (for IAP tunnel access)
- Firewall rule allowing ingress from `35.235.240.0/20` on port 22 (IAP range)

---

## 1. Copy Files to VM

From your local machine, use `gcloud compute scp` with IAP tunnelling (required if the VM has no external IP):

```bash
gcloud compute scp --recurse ml_data_collection/ <YOUR_USERNAME>@<VM_NAME>:~/ml_data_collection \
  --zone=<ZONE> \
  --tunnel-through-iap
```

---

## 2. SSH into the VM

```bash
gcloud compute ssh <YOUR_USERNAME>@<VM_NAME> --zone=<ZONE> --tunnel-through-iap
```

---

## 3. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should print v20.x.x
```

---

## 4. Install Dependencies

```bash
cd ~/ml_data_collection
npm install
```

---

## 5. Set Up the Database Schema

TimescaleDB must already be installed and enabled. If not:

```bash
sudo apt install -y timescaledb-2-postgresql-15
sudo timescaledb-tune --quiet --yes
sudo systemctl restart postgresql
```

Then run the schema:

```bash
psql -U postgres -d <your_db_name> -f schema.sql
```

This creates:
- `vehicle_positions_log` — TimescaleDB hypertable, partitioned by day
- Indexes for trip and station queries
- A 6-month retention policy (auto-drops data older than 6 months)

If you have previously run an older version of this schema that included the `actual_arrivals` materialized view, drop it:

```sql
DROP MATERIALIZED VIEW IF EXISTS actual_arrivals;
```

---

## 6. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Fill in your values:

```env
DB_USER=your-db-username
DB_HOST=localhost          # or the DB host/IP
DB_NAME=your-db-name
DB_PASSWORD=your-password
DB_PORT=5432

GTFS_URL=https://api.data.gov.my/gtfs-realtime/vehicle-position/ktmb
POLL_INTERVAL_MS=30000     # 30 seconds recommended
```

---

## 7. Test the Collector Manually

Before installing as a service, run it once to verify connectivity:

```bash
node collector.js
```

Expected output:

```
KTMB ML Collector starting...
Poll interval: 30s
DB: localhost:5432/your-db-name
DB connection OK.
Loaded 6 route shapes.
[2026-...T...Z] +18 rows | 22 in feed, 18 updated, 4 at station
```

If `Loaded 0 route shapes`, the `route_shapes` table is empty — ingest the main app timetable data first.

Press `Ctrl+C` to stop, then proceed to install as a service.

---

## 8. Install as a systemd Service

Edit the service file to match your username and path:

```bash
nano ~/ml_data_collection/ktmb-collector.service
```

Update these two lines:

```ini
User=<YOUR_USERNAME>
WorkingDirectory=/home/<YOUR_USERNAME>/ml_data_collection
```

Install and enable the service:

```bash
sudo cp ~/ml_data_collection/ktmb-collector.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ktmb-collector
sudo systemctl start ktmb-collector
```

---

## 9. Verify the Service

Check status:

```bash
sudo systemctl status ktmb-collector
```

Tail live logs:

```bash
journalctl -u ktmb-collector -f
```

The service is configured to restart automatically after a 10-second delay if it crashes.

---

## Querying Collected Data

To get actual arrival times per trip (for model training):

```sql
SELECT
    trip_id,
    at_station_name,
    at_station_idx,
    MIN(recorded_at) AS first_seen_at_station,
    (MIN(recorded_at) AT TIME ZONE 'Asia/Kuala_Lumpur')::date AS service_date,
    AVG(speed_kmh) FILTER (WHERE speed_kmh IS NOT NULL) AS avg_speed_at_station
FROM vehicle_positions_log
WHERE at_station_name IS NOT NULL
  AND trip_id IS NOT NULL
GROUP BY trip_id, at_station_name, at_station_idx
ORDER BY trip_id, at_station_idx;
```

To compute delay, JOIN the result against `stop_times` in the main timetable database using `trip_id` (e.g. `weekday_2067` → train number `2067`, day type `Weekday`).