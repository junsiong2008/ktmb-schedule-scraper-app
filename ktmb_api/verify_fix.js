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
        console.log('Verifying fix for weekday/weekend schedule...');

        // Use KL SENTRAL (19100) and KUALA LUMPUR (19000)
        const from = '19100';
        const to = '19000';

        console.log(`\nFetching next train from ${from} to ${to}...`);
        const nextTrain = await makeRequest(`/api/schedule/next?from=${from}&to=${to}`);
        console.log('Next train result:', nextTrain);

        if (nextTrain) {
            console.log('Trip ID:', nextTrain.trip_id);
            console.log('Service info should be checked against DB for validity on current day.');
        } else {
            console.log('No next train found for today (which might be correct if no service runs now).');
        }

        console.log(`\nFetching schedule list from ${from}...`);
        const scheduleList = await makeRequest(`/api/schedule/list?from=${from}`);
        console.log(`Found ${scheduleList.length} upcoming trains.`);
        if (scheduleList.length > 0) {
            console.log('First schedule item:', scheduleList[0]);
        }

    } catch (err) {
        console.error('Test failed:', err);
    }
};

// Wait for server to start
setTimeout(runTests, 3000);
