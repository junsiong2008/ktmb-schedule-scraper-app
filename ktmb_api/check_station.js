require('dotenv').config();
const db = require('./src/config/db');

const checkStationUsage = async () => {
    try {
        console.log("Checking station usage for ID 85 (KL SENTRAL)...");
        const res = await db.query("SELECT COUNT(*) FROM stop_times WHERE station_id = 85");
        console.log(`Stop times count for ID 85: ${res.rows[0].count}`);

        const res2 = await db.query("SELECT COUNT(*) FROM stop_times WHERE station_id = 12");
        console.log(`Stop times count for ID 12 (KL Sentral): ${res2.rows[0].count}`);

        if (parseInt(res.rows[0].count) === 0) {
            console.log("Station 85 is unused. Safe to delete.");
            // await db.query("DELETE FROM stations WHERE id = 85");
            // console.log("Deleted station 85.");
        } else {
            console.log("Station 85 is USED. Need to merge.");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
};

checkStationUsage();
