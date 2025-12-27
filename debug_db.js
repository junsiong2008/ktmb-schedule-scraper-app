require('dotenv').config({ path: '/Users/tengjunsiong/Projects/ktmb0t/Stack/ktmb_timetable/ktmb_api/.env' });
const db = require('./ktmb_api/src/config/db');

const checkDB = async () => {
    try {
        console.log("Checking DB...");

        console.log("\n--- Service Types ---");
        const res1 = await db.query("SELECT DISTINCT service_type FROM routes");
        console.log(res1.rows);

        console.log("\n--- ETS Routes ---");
        const res2 = await db.query("SELECT id, name, service_type FROM routes WHERE service_type = 'ETS'");
        console.log(res2.rows);

        if (res2.rows.length > 0) {
            console.log("\n--- Schedules for ETS ---");
            const res3 = await db.query(`
                SELECT s.id, s.valid_from, s.valid_to, s.day_type, r.name 
                FROM schedules s 
                JOIN routes r ON s.route_id = r.id 
                WHERE r.service_type = 'ETS'
            `);
            console.log(res3.rows);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        // We can't easily close the pool if not exposed, but script will end.
        // Actually db module is usually a Pool object.
        process.exit();
    }
};

checkDB();
