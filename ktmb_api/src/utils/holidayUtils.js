const NodeCache = require('node-cache');
const db = require('../config/db');

// Holidays change at most a few times a year, so cache lookups for 12 hours.
const holidayCache = new NodeCache({ stdTTL: 43200 });

// KTM generally follows national and Kuala Lumpur holidays.
// The public_holidays table is filled by ingestion_automation_function/ingest_holidays.py.
const DEFAULT_STATE = 'KUL';

/**
 * Check if a specific date is a public holiday
 * @param {string} date - Date string in YYYY-MM-DD
 * @returns {Promise<boolean>}
 */
const checkIsHoliday = async (date) => {
    const cacheKey = `holiday_${date}`;
    const cachedResult = holidayCache.get(cacheKey);
    if (cachedResult !== undefined) {
        return cachedResult;
    }

    try {
        const { rowCount } = await db.query(
            'SELECT 1 FROM public_holidays WHERE holiday_date = $1 AND state = $2 LIMIT 1',
            [date, DEFAULT_STATE]
        );
        const isHoliday = rowCount > 0;
        holidayCache.set(cacheKey, isHoliday);
        return isHoliday;
    } catch (error) {
        console.error(`Error checking holiday for date ${date}:`, error.message);
        // On error, fail safe to false (treat as normal day) so we don't break the app
        return false;
    }
};

module.exports = {
    checkIsHoliday
};
