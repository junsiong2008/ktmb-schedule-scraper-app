const { format } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');

// In-memory cache with 12 hour TTL: date -> { value, expires }
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const holidayCache = new Map();
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
        const cached = holidayCache.get(cacheKey);

        if (cached) {
            if (cached.expires > Date.now()) {
                return cached.value;
            }
            holidayCache.delete(cacheKey);
        }

        // Call API
        const url = new URL(HOLIDAY_API_URL);
        url.searchParams.set('date', date);
        url.searchParams.set('state', DEFAULT_STATE);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(5000) // 5s timeout to avoid blocking too long
        });

        if (!response.ok) {
            throw new Error(`Holiday API responded with HTTP ${response.status}`);
        }

        const body = await response.json();

        if (body && body.success && body.data) {
            const isHoliday = body.data.is_holiday;

            // Cache the result
            holidayCache.set(cacheKey, { value: isHoliday, expires: Date.now() + CACHE_TTL_MS });

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
