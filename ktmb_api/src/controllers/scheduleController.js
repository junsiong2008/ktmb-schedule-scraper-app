const db = require('../config/db');
const { getCurrentTimeHHMMSS, getCurrentDate, getCurrentDayName } = require('../utils/timeUtils');

const getDayType = (dayName) => {
    const lower = dayName.toLowerCase();
    if (lower === 'saturday' || lower === 'sunday') {
        return 'Weekend';
    }
    return 'Weekday';
};

const getRoutes = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM routes ORDER BY service_type, name');
        const routes = result.rows;

        const groupedRoutes = [
            { service_name: 'KTM Komuter', routes: [] },
            { service_name: 'ETS', routes: [] },
            { service_name: 'Intercity', routes: [] }
        ];

        routes.forEach(route => {
            // Map new schema fields to expected API structure if needed
            // The frontend likely uses route_id, route_long_name, route_short_name
            const formattedRoute = {
                route_id: route.id,
                route_long_name: route.name,
                route_short_name: route.name, // New schema only has one name
                service_type: route.service_type,
                // Add legacy route_type for compatibility if needed, though strictly not required if frontend checks service_name
                route_type: route.service_type === 'Komuter' ? 0 : (route.service_type === 'ETS' ? 2 : 1)
            };

            if (route.service_type === 'Komuter') {
                groupedRoutes[0].routes.push(formattedRoute);
            } else if (route.service_type === 'ETS') {
                groupedRoutes[1].routes.push(formattedRoute);
            } else {
                groupedRoutes[2].routes.push(formattedRoute);
            }
        });

        // Remove empty groups if any
        const finalRoutes = groupedRoutes.filter(group => group.routes.length > 0);

        res.json(finalRoutes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getStations = async (req, res) => {
    const { route_id } = req.query;

    try {
        let query = 'SELECT id as stop_id, name as stop_name, code as stop_code FROM stations';
        let params = [];

        if (route_id) {
            query = `
                SELECT DISTINCT s.id as stop_id, s.name as stop_name, s.code as stop_code
                FROM stations s
                JOIN stop_times st ON s.id = st.station_id
                JOIN trips t ON st.trip_id = t.id
                JOIN schedules sch ON t.schedule_id = sch.id
                WHERE sch.route_id = $1
            `;
            params.push(route_id);
        }

        query += ' ORDER BY stop_name';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getNextTrain = async (req, res) => {
    const { from, to, route_id } = req.query;

    if (!from || !to) {
        return res.status(400).json({ error: 'Missing "from" or "to" station ID' });
    }

    const currentTime = getCurrentTimeHHMMSS();
    const currentDate = getCurrentDate();
    const currentDayName = getCurrentDayName();
    const dayType = getDayType(currentDayName);

    let params = [from, to, currentTime, dayType, currentDate];

    let query = `
    SELECT
        t.train_number as trip_id,
        st_a.departure_time as departure_time,
        st_b.arrival_time as arrival_time,
        r.name as route_long_name,
        r.name as route_short_name,
        r.service_type as route_type,
        t.direction,
        (
            SELECT s_last.name 
            FROM stop_times st_last
            JOIN stations s_last ON st_last.station_id = s_last.id
            WHERE st_last.trip_id = t.id
            ORDER BY st_last.stop_sequence DESC
            LIMIT 1
        ) as trip_headsign
    FROM trips t
    JOIN stop_times st_a ON t.id = st_a.trip_id
    JOIN stop_times st_b ON t.id = st_b.trip_id
    JOIN schedules sc ON t.schedule_id = sc.id
    JOIN routes r ON sc.route_id = r.id
    WHERE st_a.station_id = $1
      AND st_b.station_id = $2
      AND st_a.stop_sequence < st_b.stop_sequence
      AND st_a.departure_time >= $3
      AND sc.day_type = $4
      AND sc.valid_from <= $5
      AND (sc.valid_to IS NULL OR sc.valid_to >= $5)
  `;

    if (route_id) {
        query += ` AND sc.route_id = $6`;
        params.push(route_id);
    }

    query += `
    ORDER BY st_a.departure_time ASC
    LIMIT 1;
  `;

    try {
        const result = await db.query(query, params);
        if (result.rows.length === 0) {
            return res.json(null);
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getScheduleList = async (req, res) => {
    const { from, direction, route_id } = req.query;

    if (!from) {
        return res.status(400).json({ error: 'Missing "from" station ID' });
    }

    const currentTime = getCurrentTimeHHMMSS();
    const currentDate = getCurrentDate();
    const currentDayName = getCurrentDayName();
    const dayType = getDayType(currentDayName);

    let params = [from, currentTime, dayType, currentDate];

    // Inner query to fetch schedules and calculate headsign for relevant trips only
    let innerQuery = `
        SELECT
            t.train_number as trip_id,
            st.arrival_time,
            st.departure_time,
            st.stop_sequence,
            s.name as station_name,
            (
                SELECT s_last.name 
                FROM stop_times st_last
                JOIN stations s_last ON st_last.station_id = s_last.id
                WHERE st_last.trip_id = t.id
                ORDER BY st_last.stop_sequence DESC
                LIMIT 1
            ) as trip_headsign,
            r.name as route_long_name,
            r.name as route_short_name,
            r.service_type as route_type
        FROM stop_times st
        JOIN trips t ON st.trip_id = t.id
        JOIN schedules sc ON t.schedule_id = sc.id
        JOIN routes r ON sc.route_id = r.id
        JOIN stations s ON st.station_id = s.id
        WHERE st.station_id = $1
          AND st.departure_time >= $2
          AND sc.day_type = $3
          AND sc.valid_from <= $4
          AND (sc.valid_to IS NULL OR sc.valid_to >= $4)
    `;

    if (route_id) {
        innerQuery += ` AND sc.route_id = $${params.length + 1}`;
        params.push(route_id);
    }

    // Wrap in CTE to allow filtering by the calculated trip_headsign
    query = `
        WITH BaseSchedule AS (
            ${innerQuery}
        )
        SELECT * FROM BaseSchedule
        WHERE 1=1
    `;

    if (direction) {
        query += ` AND trip_headsign ILIKE $${params.length + 1}`;
        params.push(`%${direction}%`);
    }

    query += ` ORDER BY departure_time ASC LIMIT 20`;

    try {
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const searchTrips = async (req, res) => {
    const { from, to, date } = req.query;

    if (!from || !to || !date) {
        return res.status(400).json({ error: 'Missing "from", "to", or "date" parameter' });
    }

    // Determine day type (Weekday/Weekend)
    const dayName = require('../utils/timeUtils').getDayName(date);
    const dayType = getDayType(dayName);

    // Get current time to filter past trips if searching for today
    const currentDate = getCurrentDate();
    let filterTime = '00:00:00';
    if (date === currentDate) {
        filterTime = getCurrentTimeHHMMSS();
    }

    const query = `
        SELECT
            t.train_number as trip_id,
            st_a.departure_time as departure_time,
            st_b.arrival_time as arrival_time,
            r.name as route_long_name,
            r.name as route_short_name,
            r.service_type as route_type,
            (
                SELECT s_last.name 
                FROM stop_times st_last
                JOIN stations s_last ON st_last.station_id = s_last.id
                WHERE st_last.trip_id = t.id
                ORDER BY st_last.stop_sequence DESC
                LIMIT 1
            ) as trip_headsign
        FROM trips t
        JOIN stop_times st_a ON t.id = st_a.trip_id
        JOIN stop_times st_b ON t.id = st_b.trip_id
        JOIN schedules sc ON t.schedule_id = sc.id
        JOIN routes r ON sc.route_id = r.id
        WHERE st_a.station_id = $1
          AND st_b.station_id = $2
          AND st_a.stop_sequence < st_b.stop_sequence
          AND sc.day_type = $3
          AND sc.valid_from <= $4
          AND (sc.valid_to IS NULL OR sc.valid_to >= $4)
          AND st_a.departure_time >= $5
        ORDER BY st_a.departure_time ASC;
    `;

    const params = [from, to, dayType, date, filterTime];

    try {
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getRoutes,
    getStations,
    getNextTrain,
    getScheduleList,
    searchTrips
};
