# KTMB0t Frontend (Next.js)

This is the frontend application for the KTMB0t project, built with [Next.js](https://nextjs.org) and [TypeScript](https://www.typescriptlang.org/). It provides a user-friendly interface for browsing train schedules and tracking trains in real-time.

## 🚀 Features

- **Schedule Search**: Quickly find train schedules for KTM Komuter and ETS services.
- **Next Train Highlights**: See the most relevant upcoming trains for your selected stations.
- **Live Train Tracking**: Interactive map view (using Leaflet) to see real-time train positions.
- **PWA Support**: Installable on mobile and desktop for a native-like experience.
- **Dark Mode**: Supports system-wide dark mode preferences.
- **Recent Searches**: Remembers your recent searches for quick access.

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Maps**: Leaflet & React-Leaflet
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **State/Theme**: Next-Themes
- **PWA**: `@ducanh2912/next-pwa`

## 📁 Project Structure

- `src/app`: Next.js App Router pages and layouts.
- `src/components`: Reusable UI components (Map, Search, Clock, etc.).
- `src/services`: API service clients.
- `src/lib`: Utility functions and helper libraries.
- `public`: Static assets, icons, and PWA manifest.

## 🛠 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- `npm` or `yarn`

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd nextjs_frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Local Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🚢 Deployment

The application is configured for deployment on **Google Cloud Run** via **Google Cloud Build**.
