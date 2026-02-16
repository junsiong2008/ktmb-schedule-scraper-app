require('dotenv').config();
const { checkIsHoliday } = require('./src/utils/holidayUtils');

const testHoliday = async () => {
    console.log('--- Verification Start ---');

    // Test 1: Check a likely non-holiday (e.g., 2026-01-15)
    // Note: check calendar if 15 Jan 2026 is actually a holiday. It's a Thursday. Thaipusam might be around then?
    // Let's pick a random date. 2026-03-11.
    const nonHolidayDate = '2026-03-11';
    console.log(`Checking likely non-holiday (${nonHolidayDate})...`);
    const isHoliday1 = await checkIsHoliday(nonHolidayDate);
    console.log(`Result: ${isHoliday1} (Expected: false)`);

    // Test 2: Check a known holiday (New Year 2026 - 2026-01-01)
    const holidayDate = '2026-01-01';
    console.log(`Checking known holiday (${holidayDate})...`);
    const isHoliday2 = await checkIsHoliday(holidayDate);
    console.log(`Result: ${isHoliday2} (Expected: true)`);

    // Test 3: Check the reported issue date (2026-02-17 - CNY 2026)
    const issueDate = '2026-02-17';
    console.log(`Checking reported issue date (${issueDate})...`);
    const isHoliday3 = await checkIsHoliday(issueDate);
    console.log(`Result: ${isHoliday3} (Expected: true)`);

    console.log('--- Verification End ---');
};

testHoliday();
