const http = require('http');

const makeRequest = (path) => {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3000${path}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
};

const runTests = async () => {
    try {
        console.log('Testing /api/stations...');
        const stations = await makeRequest('/api/stations');
        console.log('Response:', stations);
        if (Array.isArray(stations)) {
            console.log(`Found ${stations.length} stations.`);
        } else {
            console.log('Expected array but got:', stations);
            return;
        }
        if (stations.length > 0) {
            console.log('Sample station:', stations[0]);

            // Use KL SENTRAL (19100) if available, otherwise first station
            const klSentral = stations.find(s => s.stop_id === '19100');
            const from = klSentral ? klSentral.stop_id : stations[0].stop_id;

            // Find a station that is likely connected, e.g., KUALA LUMPUR (19000)
            const kualaLumpur = stations.find(s => s.stop_id === '19000');
            const to = kualaLumpur ? kualaLumpur.stop_id : (stations.length > 1 ? stations[1].stop_id : from);

            console.log(`\nTesting /api/schedule/next?from=${from}&to=${to}...`);
            const nextTrain = await makeRequest(`/api/schedule/next?from=${from}&to=${to}`);
            console.log('Next train:', nextTrain);

            console.log(`\nTesting /api/schedule/list?from=${from}...`);
            // Get list for tomorrow if it's late
            const scheduleList = await makeRequest(`/api/schedule/list?from=${from}`);
            console.log(`Found ${scheduleList.length} upcoming trains.`);
            if (scheduleList.length > 0) {
                console.log('Sample schedule:', scheduleList[0]);
            }
        }
    } catch (err) {
        console.error('Test failed:', err);
    }
};

// Wait for server to start
setTimeout(runTests, 2000);
