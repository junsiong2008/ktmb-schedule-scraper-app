const { getNextTrain, getScheduleList } = require('./src/controllers/scheduleController');
const db = require('./src/config/db');

// Mock Request and Response
const mockReq = (query) => ({ query });
const mockRes = (label) => ({
    json: (data) => {
        console.log(`\n--- ${label} ---`);
        if (Array.isArray(data)) {
            console.log(`Result Count: ${data.length}`);
            if (data.length > 0) {
                console.log('First Item:', JSON.stringify(data[0], null, 2));
                // Check if trip_headsign is present and not null
                if (data[0].trip_headsign) {
                    console.log(`SUCCESS: trip_headsign is populated: "${data[0].trip_headsign}"`);
                } else {
                    console.error('FAILURE: trip_headsign is missing or null');
                }
            } else {
                console.log('No results found.');
            }
        } else {
            console.log('Result:', JSON.stringify(data, null, 2));
            if (data && data.trip_headsign) {
                console.log(`SUCCESS: trip_headsign is populated: "${data.trip_headsign}"`);
            } else if (data) {
                console.error('FAILURE: trip_headsign is missing or null');
            }
        }
    },
    status: (code) => ({
        json: (error) => console.error(`Error ${code}:`, error)
    })
});

const runVerification = async () => {
    try {
        console.log('Verifying getNextTrain...');
        // KL Sentral (19100) to Kajang (20400)
        await getNextTrain(mockReq({ from: '19100', to: '20400' }), mockRes('getNextTrain'));

        console.log('\nVerifying getScheduleList...');
        // KL Sentral (19100), no direction filter initially to see what we get
        await getScheduleList(mockReq({ from: '19100' }), mockRes('getScheduleList (No Direction)'));

        // Test with direction filter if we found a headsign
        // We can't easily know a valid direction string without running the first query, 
        // but let's try a common one like "PULAU SEBANG" or "BATU CAVES" if we see it in output.
        // For now, just seeing the headsign populated in the first call is enough to verify the fix.

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        // We need to close the pool to exit the script
        // But db module doesn't export close/end. 
        // We can just exit process.
        process.exit(0);
    }
};

runVerification();
