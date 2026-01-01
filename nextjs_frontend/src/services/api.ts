import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface Station {
    station_id: string;
    station_name: string;
}

export interface Route {
    route_id: string;
    route_long_name: string;
    route_short_name: string;
}

export interface RouteGroup {
    service_name: string;
    routes: Route[];
}

export interface NextTrain {
    trip_id: string;
    arrival_time: string;
    departure_time: string;
    stop_sequence: number;
    pickup_type: number;
    drop_off_type: number;
    route_long_name: string;
    trip_headsign: string;
}

export interface ScheduleItem {
    trip_id: string;
    arrival_time: string;
    departure_time: string;
    stop_sequence: number;
    station_name: string;
    trip_headsign?: string;
}

export const getStations = async (route_id?: string, serviceType?: string): Promise<Station[]> => {
    const response = await api.get('/stations', {
        params: { route_id, service_type: serviceType }
    });
    // Map backend GTFS format (stop_id, stop_name) to frontend interface (station_id, station_name)
    return response.data.map((stop: any) => ({
        station_id: stop.stop_id,
        station_name: stop.stop_name
    }));
};

export const getRoutes = async (): Promise<RouteGroup[]> => {
    const response = await api.get('/routes');
    return response.data;
};

export const getNextTrain = async (from: string, to: string, route_id?: string): Promise<NextTrain | null> => {
    try {
        const response = await api.get('/schedule/next', {
            params: { from, to, route_id },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching next train:', error);
        return null;
    }
};

export const getScheduleList = async (from: string, direction?: string, route_id?: string): Promise<ScheduleItem[]> => {
    try {
        const response = await api.get('/schedule/list', {
            params: { from, direction, route_id },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching schedule list:', error);
        return [];
    }

};

export interface TripSearchResult {
    trip_id: string;
    departure_time: string;
    arrival_time: string;
    route_long_name: string;
    route_short_name: string;
    route_type: number;
    trip_headsign: string;
}

export const searchTrips = async (from: string, to: string, date: string, serviceType?: string): Promise<TripSearchResult[]> => {
    try {
        const response = await api.get('/schedule/search', {
            params: { from, to, date, service_type: serviceType },
        });
        return response.data;
    } catch (error) {
        console.error('Error searching trips:', error);
        return [];
    }
};

export default api;
