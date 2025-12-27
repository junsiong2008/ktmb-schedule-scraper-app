require('dotenv').config();
const db = require('./src/config/db');

const checkTrips = async () => {
    try {
        console.log("Checking Trips for ETS...");

        // Check one trip to see its stops and day type
        const res = await db.query(`
            SELECT t.id, t.train_number, s.day_type, r.service_type
            FROM trips t
            JOIN schedules s ON t.schedule_id = s.id
            JOIN routes r ON s.route_id = r.id
            WHERE r.service_type = 'ETS'
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log("No ETS trips found.");
            return;
        }

        const trip = res.rows[0];
        console.log("Sample Trip:", trip);

        // Check stops for this trip
        const resStops = await db.query(`
            SELECT st.stop_sequence, st.station_id, st.arrival_time, stn.name
            FROM stop_times st
            JOIN stations stn ON st.station_id = stn.id
            WHERE st.trip_id = $1
            ORDER BY st.stop_sequence
        `, [trip.id]);

        console.log("Stops for trip:", resStops.rows.map(r => `${r.name} (${r.station_id})`).join(' -> '));

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
};

checkTrips();
