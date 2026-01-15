# KTMB Timetable API

The KTMB Timetable API is a backend service built with Node.js and Express that provides comprehensive access to KTMB train schedules, routes, stations, and real-time GTFS vehicle positions. It integrates with a PostgreSQL database for static schedule data and proxies real-time data from official KTMB sources.

## Features

- **Route Discovery**: Grouped train routes by service type (KTM Komuter, ETS, Intercity).
- **Station Information**: List stations with filtering by route or service type.
- **Smart Scheduling**: 
    - Search for trips between any two stations on a specific date.
    - Automated "Next Train" calculation based on current time.
    - Holiday-aware scheduling: Automatically adjusts between Weekday/Weekend schedules based on Malaysian public holidays.
- **Real-time Tracking**: Proxy for KTMB GTFS-realtime vehicle positions with intelligent caching.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Real-time Data**: GTFS-realtime (Protobuf)
- **Caching**: `node-cache` (for holiday and GTFS data)

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL database (with relevant KTMB schedule data)

### Installation

1. Navigate to the `ktmb_api` directory:
   ```bash
   cd ktmb_api
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the environment variables (see [Environment Variables](#environment-variables)).

### Running the Server

- **Development**:
  ```bash
  node src/index.js
  ```
- **Production (with start script)**:
  ```bash
  npm start
  ```

The server will be available at `http://localhost:3000` (or the port specified in `.env`).

## Environment Variables

Create a `.env` file in the `ktmb_api` directory with the following variables:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DB_USER` | PostgreSQL username | `postgres` |
| `DB_HOST` | PostgreSQL host address | `35.x.x.x` |
| `DB_NAME` | Database name | `ktmbdb` |
| `DB_PASSWORD` | PostgreSQL password | `********` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `PORT` | API server port | `3000` |
| `HOLIDAY_API_URL` | URL for the Cuti-Cuti API | `https://.../holidays/check` |

## API Reference

### Routes

#### `GET /api/routes`
Retrieve all available train routes grouped by service type.

- **Response**: `Array<ServiceGroup>`

#### `GET /api/stations`
Retrieve a list of train stations.

- **Query Parameters**:
    - `route_id` (optional): Filter stations by a specific Route ID.
    - `service_type` (optional): Filter stations by service type (`Komuter`, `ETS`, `Intercity`).
- **Response**: `Array<Station>`

### Schedules

#### `GET /api/schedule/next`
Get the next available train between two stations.

- **Query Parameters**:
    - `from` (required): Origin station ID.
    - `to` (required): Destination station ID.
    - `route_id` (optional): Filter by specific route.
- **Response**: `TripDetail` or `null`

#### `GET /api/schedule/search`
Search for all trips between two stations on a specific date.

- **Query Parameters**:
    - `from` (required): Origin station ID.
    - `to` (required): Destination station ID.
    - `date` (required): Date of travel (`YYYY-MM-DD`).
    - `time` (optional): Filter trips departing after this time (`HH:MM:SS`).
    - `service_type` (optional): Filter by service type.
- **Response**: `Array<TripDetail>`

#### `GET /api/schedule/list`
Get upcoming scheduled departures from a specific station.

- **Query Parameters**:
    - `from` (required): Station ID.
    - `direction` (optional): Filter by trip headsign.
    - `route_id` (optional): Filter by route ID.
- **Response**: `Array<ScheduleItem>`

### Real-time (GTFS)

#### `GET /api/gtfs/vehicle-positions`
Fetch real-time KTMB vehicle positions.

- **Response**: `GtfsFeed` object containing vehicle entities and timestamp.
- **Note**: Data is cached for 30 seconds to minimize load on the official KTMB GTFS endpoint.

## Project Structure

```bash
ktmb_api/
├── src/
│   ├── config/      # Database configuration
│   ├── controllers/ # Business logic for schedule and GTFS
│   ├── routes/      # Express route definitions
│   ├── utils/       # Shared utilities (time, holidays)
│   └── index.js     # Server entry point
├── openapi.yaml     # API Specification (OpenAPI 3.0)
└── .env             # Environment configuration (not committed)
```

## Holiday Sensitivity

The API is designed to be "holiday-aware". It uses an internal `holidayUtils` module that queries a Public Holiday API. If the searched date (or current date) is a public holiday, the API will treat it as a **Weekend** schedule for Komuter services to ensure accurate arrival/departure times.
