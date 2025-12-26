# KTMB0t Monorepo

This monorepo contains the full stack for the KTMB0t application, designed to provide enhanced train schedule information and automation.

### Context
This project was inspired by the need to build a personal KTM Komuter train schedule app. The official KTM Komuter timetable is provided as PDFs on the KTMB website, which are cumbersome to use on mobile devices due to excessive zooming and scrolling.

## Data Source & Quality Disclaimer

 This project now uses PDF timetable data scraped from the KTMB website, replacing the previous GTFS static data which had significant quality issues.

 Original repository: https://github.com/junsiong2008/ktmb-schedule-gtfs-app

## Project Structure

- **`ktmb_api`**: Node.js Backend API (Port 3000). Handles data serving and schedule logic.
- **`nextjs_frontend`**: Next.js Frontend Application (Port 3001). User interface for browsing schedules.
- **`ingestion_automation_function`**: Python scripts for data ingestion and automation.

## Getting Started

### Prerequisites

- Node.js installed
- PostgreSQL installed and running (for the backend)
- Python 3.x (for ingestion scripts)

### 1. Backend API (Port 3000)

The backend API is located in the `ktmb_api` directory.

1.  Navigate to the backend directory:
    ```bash
    cd ktmb_api
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the server:
    ```bash
    npm start
    ```
    You should see: `Server is running on port 3000`

### 2. Frontend Application (Port 3001)

The frontend application is located in the `nextjs_frontend` directory.

1.  Navigate to the frontend directory:
    ```bash
    cd nextjs_frontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server on port 3001:
    ```bash
    npm run dev -- -p 3001
    ```
    You should see the application starting up on `http://localhost:3001`.

## Summary of Ports

- **Backend**: `http://localhost:3000`
- **Frontend**: `http://localhost:3001`
