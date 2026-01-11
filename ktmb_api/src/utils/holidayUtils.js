const NodeCache = require('node-cache');
const axios = require('axios');
const { format } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');

// Initialize cache with 12 hour TTL
const holidayCache = new NodeCache({ stdTTL: 43200 });
const TIMEZONE = 'Asia/Kuala_Lumpur';
const HOLIDAY_API_URL = process.env.HOLIDAY_API_URL || 'https://my-cuti-api-769756648802.us-central1.run.app/holidays/check';

// State to check for holidays. Defaulting to 'KUL' as a safe general default for KTM logic.
// Ideally this could be dynamic, but KTM generally follows national/major state holidays.
const DEFAULT_STATE = 'KUL';

/**
 * Check if a specific date is a public holiday
 * @param {string} date - Date string in YYYY-MM-DD
 * @returns {Promise<boolean>}
 */
const checkIsHoliday = async (date) => {
    try {
        // Check cache first
        const cacheKey = `holiday_${date}`;
        const cachedResult = holidayCache.get(cacheKey);

        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Call API
        const response = await axios.get(HOLIDAY_API_URL, {
            params: {
                date: date,
                state: DEFAULT_STATE
            },
            timeout: 5000 // 5s timeout to avoid blocking too long
        });

        if (response.data && response.data.success && response.data.data) {
            const isHoliday = response.data.data.is_holiday;

            // Cache the result
            holidayCache.set(cacheKey, isHoliday);

            return isHoliday;
        }

        return false;
    } catch (error) {
        console.error(`Error checking holiday for date ${date}:`, error.message);
        // On error, fail safe to false (treat as normal day) so we don't break the app
        return false;
    }
};

module.exports = {
    checkIsHoliday
};
