const { getCurrentTimeHHMMSS, getCurrentDate, getCurrentDayName } = require('./src/utils/timeUtils');

console.log('Current Time (MYT):', getCurrentTimeHHMMSS());
console.log('Current Date (MYT):', getCurrentDate());
console.log('Current Day (MYT):', getCurrentDayName());
