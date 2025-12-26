const { format } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');

const TIMEZONE = 'Asia/Kuala_Lumpur';

/**
 * Helper to get current time in Malaysia timezone
 */
const getMalaysiaDate = () => {
    return toZonedTime(new Date(), TIMEZONE);
};

/**
 * GTFS times can be > 24:00:00 (e.g., 25:30:00 means 1:30 AM next day).
 * This function converts current time to HH:mm:ss format for comparison.
 */
const getCurrentTimeHHMMSS = () => {
    if (process.env.MOCK_TIME) return process.env.MOCK_TIME;
    return format(getMalaysiaDate(), 'HH:mm:ss');
};

/**
 * Parse GTFS time string (HH:mm:ss) to a comparable number of seconds from midnight.
 * @param {string} timeString 
 */
const timeToSeconds = (timeString) => {
    if (!timeString) return null;
    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
};

/**
 * Format seconds back to HH:mm:ss
 * @param {number} seconds 
 */
const secondsToTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

module.exports = {
    getCurrentTimeHHMMSS,
    timeToSeconds,
    secondsToTime,
    getCurrentDate: () => {
        if (process.env.MOCK_DATE) return process.env.MOCK_DATE;
        return format(getMalaysiaDate(), 'yyyy-MM-dd');
    },
    getCurrentDayName: () => {
        if (process.env.MOCK_DAY) return process.env.MOCK_DAY;
        return format(getMalaysiaDate(), 'EEEE').toLowerCase();
    },
    getDayName: (dateString) => {
        // dateString should be YYYY-MM-DD
        const date = toZonedTime(dateString, TIMEZONE);
        return format(date, 'EEEE').toLowerCase();
    }
};
