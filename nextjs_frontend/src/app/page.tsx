'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStations, searchTrips, Station, TripSearchResult } from '@/services/api';
import { MapPin, Calendar, ArrowRight, Clock, ArrowLeftRight } from 'lucide-react';
import { Header } from '@/components/Header';

export default function Home() {
  // Selection state
  const [stations, setStations] = useState<Station[]>([]);
  const [originId, setOriginId] = useState<string>('');
  const [destinationId, setDestinationId] = useState<string>('');
  // Default date to today yyyy-MM-dd in Malaysia time (simple approximation or ISO split)
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>('Komuter');

  // Results state
  const [trips, setTrips] = useState<TripSearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [stationLoading, setStationLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Initialize
  useEffect(() => {
    const init = async () => {
      // Set default date to today Malaysia time
      const now = new Date();
      // Adjust to UTC+8 manually for simple default string
      const myTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      const todayStr = myTime.toISOString().split('T')[0];
      const timeStr = myTime.toISOString().split('T')[1].substring(0, 5);

      setDate(todayStr); // Only set date on mount
      setTime(timeStr);
    };
    init();
  }, []);

  // Fetch stations whenever serviceType changes
  useEffect(() => {
    const fetchStations = async () => {
      setStationLoading(true);
      try {
        // Pass undefined for route_id, and the selected serviceType
        const stationData = await getStations(undefined, serviceType);
        setStations(stationData);

        // Reset selections when service type changes (stations might not exist in other service)
        setOriginId('');
        setDestinationId('');
      } catch (error) {
        console.error('Failed to fetch stations', error);
      } finally {
        setStationLoading(false);
      }
    };

    fetchStations();
  }, [serviceType]);

  const handleSearch = async () => {
    if (!originId || !destinationId || !date) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const results = await searchTrips(originId, destinationId, date, serviceType, time);
      setTrips(results);
    } catch (error) {
      console.error('Search failed', error);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setOriginId('');
    setDestinationId('');
    setTrips([]);
    setHasSearched(false);
  };

  const handleSwap = () => {
    if (stationLoading) return;
    setOriginId(destinationId);
    setDestinationId(originId);
  };

  // Helper to format arrival/departure HH:mm:ss to HH:mm
  const formatTime = (time: string) => time ? time.substring(0, 5) : '--:--';

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-950 dark:to-slate-900 font-[family-name:var(--font-geist-sans)] transition-colors">
      <Header onLogoClick={handleReset} showLiveMap={true} />

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">

        {/* Search Card */}
        <div className="bg-white dark:bg-white/5 dark:backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="text-blue-600 dark:text-blue-500" />
              Plan Your Journey
            </h2>

            {/* Service Type Tabs */}
            <div className="bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg flex self-start md:self-auto transition-colors">
              <button
                onClick={() => setServiceType('Komuter')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${serviceType === 'Komuter'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                KTM Komuter
              </button>
              <button
                onClick={() => setServiceType('ETS')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${serviceType === 'ETS'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                ETS
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              {/* Origin */}
              <div className="w-full md:flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Origin</label>
                <select
                  value={originId}
                  onChange={(e) => setOriginId(e.target.value)}
                  disabled={stationLoading}
                  className="w-full p-3 rounded-lg border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 dark:bg-white/10 focus:bg-white dark:focus:bg-white/20 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="" className="dark:bg-slate-900">{stationLoading ? 'Loading stations...' : 'Start from...'}</option>
                  {stations.map((station) => (
                    <option key={station.station_id} value={station.station_id} className="dark:bg-slate-900">
                      {station.station_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Swap Button (Hidden on mobile) */}
              <div className="hidden md:flex justify-center pb-1">
                <button
                  onClick={handleSwap}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Swap Origin and Destination"
                >
                  <ArrowLeftRight size={20} />
                </button>
              </div>

              {/* Destination */}
              <div className="w-full md:flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination</label>
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  disabled={stationLoading}
                  className="w-full p-3 rounded-lg border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 dark:bg-white/10 focus:bg-white dark:focus:bg-white/20 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="" className="dark:bg-slate-900">{stationLoading ? 'Loading stations...' : 'Go to...'}</option>
                  {stations.map((station) => (
                    <option key={station.station_id} value={station.station_id} className="dark:bg-slate-900">
                      {station.station_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Picker */}
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Travel Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setTime('');
                    }}
                    className="w-full min-w-0 box-border p-3 pl-10 rounded-lg border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 dark:bg-white/10 focus:bg-white dark:focus:bg-white/20 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                  />
                  <Calendar className="absolute left-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>

              {/* Time Picker */}
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Travel Time</label>
                <div className="relative">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full min-w-0 box-border p-3 pl-10 rounded-lg border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 dark:bg-white/10 focus:bg-white dark:focus:bg-white/20 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                  />
                  <Clock className="absolute left-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>

              {/* Search Button */}
              <div className="flex items-end md:col-span-2">
                <button
                  onClick={handleSearch}
                  disabled={!originId || !destinationId || !date || loading}
                  className="w-full p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    'Search Trains'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>



        {/* Results List */}
        {hasSearched && !loading && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 px-1">
              Available Trips ({trips.length})
            </h3>

            {trips.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl text-center border border-gray-100 dark:border-zinc-800 transition-colors">
                <p className="text-gray-500 dark:text-gray-400">No trains found for this route on the selected date.</p>
              </div>
            ) : (
              trips.map((trip, idx) => (
                <div key={`${trip.trip_id}-${idx}`} className="bg-white dark:bg-zinc-900 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 hover:shadow-md transition-all group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                    {/* Train Info */}
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 p-3 rounded-lg font-bold text-lg min-w-[3.5rem] text-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {trip.trip_id}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{trip.route_short_name}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className={`w-2 h-2 rounded-full ${trip.route_type === 1 ? 'bg-orange-400' : 'bg-blue-400'}`}></span>
                          {trip.route_long_name}
                        </div>
                      </div>
                    </div>

                    {/* Times */}
                    <div className="flex items-center gap-8 flex-1 md:justify-center">
                      <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatTime(trip.departure_time)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Departure</p>
                      </div>
                      <ArrowRight className="text-gray-300 dark:text-zinc-700" />
                      <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatTime(trip.arrival_time)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Arrival</p>
                      </div>
                    </div>

                    {/* Headsign / Direction */}
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Direction</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{trip.trip_headsign}</p>
                    </div>

                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </main >
  );
}
