'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStations, searchTrips, Station, TripSearchResult } from '@/services/api';
import { MapPin, Calendar, ArrowRight, Clock, ArrowLeftRight, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [isSearchCollapsed, setIsSearchCollapsed] = useState<boolean>(false);

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
    setIsSearchCollapsed(true);
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
    setIsSearchCollapsed(false);
  };

  const handleSwap = () => {
    if (stationLoading) return;
    setOriginId(destinationId);
    setDestinationId(originId);
  };

  // Helper to format arrival/departure HH:mm:ss to HH:mm
  const formatTime = (time: string) => time ? time.substring(0, 5) : '--:--';

  // Helper to calculate duration
  const calculateDuration = (dep: string, arr: string) => {
    if (!dep || !arr) return '';
    const [depH, depM] = dep.split(':').map(Number);
    const [arrH, arrM] = arr.split(':').map(Number);
    const depMin = depH * 60 + depM;
    let arrMin = arrH * 60 + arrM;

    // Handle next day arrival (e.g. 23:00 to 01:00)
    if (arrMin < depMin) arrMin += 24 * 60;

    const diff = arrMin - depMin;
    const h = Math.floor(diff / 60);
    const m = diff % 60;

    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-950 dark:to-slate-900 font-[family-name:var(--font-geist-sans)] transition-colors">
      <Header onLogoClick={handleReset} showLiveMap={true} />

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">

        {/* Search Card */}
        <div
          className="bg-white dark:bg-white/5 dark:backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors cursor-pointer md:cursor-default"
          onClick={() => isSearchCollapsed && setIsSearchCollapsed(false)}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
            <div className="flex items-center justify-between w-full md:w-auto">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="text-blue-600 dark:text-blue-500" />
                Plan Your Journey
              </h2>

              {/* Mobile Collapse Toggle Indicator */}
              {hasSearched && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSearchCollapsed(!isSearchCollapsed);
                  }}
                  className="md:hidden p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400"
                >
                  {isSearchCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </button>
              )}
            </div>

            {/* Service Type Tabs - Hide on mobile if collapsed */}
            <div className={`bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg flex self-start md:self-auto transition-colors ${isSearchCollapsed ? 'hidden md:flex' : 'flex'}`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setServiceType('Komuter');
                }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${serviceType === 'Komuter'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                KTM Komuter
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setServiceType('ETS');
                }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${serviceType === 'ETS'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                ETS
              </button>
            </div>
          </div>

          <div className={`space-y-6 ${isSearchCollapsed ? 'hidden md:block' : 'block'}`}>
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

              {/* Swap Button (Visible on all sizes, rotated on mobile) */}
              <div className="flex justify-center pb-1 self-center md:self-auto">
                <button
                  onClick={handleSwap}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Swap Origin and Destination"
                >
                  <ArrowLeftRight size={20} className="transform rotate-90 md:rotate-0" />
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
        {hasSearched && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 px-1">
              Available Trips {loading ? '' : `(${trips.length})`}
            </h3>

            {loading ? (
              <div className="bg-white/80 dark:bg-white/5 backdrop-blur-md p-12 rounded-xl border border-gray-100 dark:border-white/10 flex flex-col items-center justify-center text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300 animate-pulse">Searching for available trains...</p>
              </div>
            ) : trips.length === 0 ? (
              <div className="bg-white/80 dark:bg-white/5 backdrop-blur-md p-8 rounded-xl text-center border border-gray-100 dark:border-white/10 transition-colors">
                <p className="text-gray-500 dark:text-gray-400">No trains found for this route on the selected date.</p>
              </div>
            ) : (
              trips.map((trip, idx) => (
                <div key={`${trip.trip_id}-${idx}`} className="bg-white/80 dark:bg-white/5 backdrop-blur-md p-5 rounded-xl shadow-sm border border-gray-100 dark:border-white/10 hover:shadow-md transition-all group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                    {/* Train Info */}
                    <div className="flex items-center gap-4 min-w-[30%]">
                      <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 p-3 rounded-lg font-bold text-lg min-w-[3.5rem] text-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {trip.trip_id}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-lg">To {trip.trip_headsign}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className={`w-2 h-2 rounded-full ${trip.route_type === 1 ? 'bg-orange-400' : 'bg-blue-400'}`}></span>
                          {trip.route_long_name}
                        </div>
                      </div>
                    </div>

                    {/* Times & Duration */}
                    <div className="flex items-center justify-between gap-4 flex-1">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatTime(trip.departure_time)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Departure</p>
                      </div>

                      <div className="flex flex-col items-center px-4">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                          {calculateDuration(trip.departure_time, trip.arrival_time)}
                        </div>
                        <ArrowRight className="text-gray-300 dark:text-zinc-600" />
                      </div>

                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatTime(trip.arrival_time)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Arrival</p>
                      </div>
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
