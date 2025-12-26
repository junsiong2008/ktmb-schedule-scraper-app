const db = require('./src/config/db');
const { getCurrentTimeHHMMSS } = require('./src/utils/timeUtils');

const runDebug = async () => {
    try {
        const currentTime = getCurrentTimeHHMMSS();
        console.log('Current Time (API):', currentTime);

        // 1. Check Calendar for today (Sunday)
        // Note: We need to know which service_id is active.
        // Assuming today is Sunday.
        console.log('\nChecking calendar for Sunday service...');
        const calendarRes = await db.query('SELECT * FROM calendar WHERE sunday = true LIMIT 5');
        console.log('Active services on Sunday:', calendarRes.rows.map(r => r.service_id));

        // 2. Check ANY stop_times for KL SENTRAL (19100)
        console.log('\nChecking any stop_times for KL SENTRAL (19100)...');
        const stopTimesRes = await db.query('SELECT * FROM stop_times WHERE stop_id = \'19100\' LIMIT 5');
        console.log('Sample stop_times:', stopTimesRes.rows);

        // 3. Check trips for one of the active services
        if (calendarRes.rows.length > 0) {
            const serviceId = calendarRes.rows[0].service_id;
            console.log(`\nChecking trips for service_id: ${serviceId}...`);
            const tripsRes = await db.query('SELECT * FROM trips WHERE service_id = $1 LIMIT 5', [serviceId]);
            console.log('Sample trips:', tripsRes.rows);
        }

    } catch (err) {
        console.error('Debug failed:', err);
    } finally {
        process.exit();
    }
};

runDebug();
