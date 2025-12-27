require('dotenv').config();
const db = require('./src/config/db');

const mergeStations = async () => {
    try {
        console.log("Merging Station 85 (KL SENTRAL) into 12 (KL Sentral)...");

        // Update stop_times
        const resUpdate = await db.query("UPDATE stop_times SET station_id = 12 WHERE station_id = 85");
        console.log(`Updated ${resUpdate.rowCount} stop_times.`);

        // Delete station 85
        const resDelete = await db.query("DELETE FROM stations WHERE id = 85");
        console.log(`Deleted station 85.`);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
};

mergeStations();
