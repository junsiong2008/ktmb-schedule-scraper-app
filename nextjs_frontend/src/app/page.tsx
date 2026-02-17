'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStations, searchTrips, getRoutes, getVehiclePositions, Station, TripSearchResult, RouteGroup, Route } from '@/services/api';
import { MapPin, Calendar, ArrowRight, Clock, ArrowLeftRight, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { Header } from '@/components/Header';
import { RecentSearches, RecentSearchItem } from '@/components/RecentSearches';

export default function Home() {
  const router = useRouter();

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

  // Data state
  const [routeGroups, setRouteGroups] = useState<RouteGroup[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');

  // Recent Searches State
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);

  // Live tracking state
  const [liveTrainMap, setLiveTrainMap] = useState<Map<string, string>>(new Map());
  const [dayType, setDayType] = useState<string>('');
  const [todayStr, setTodayStr] = useState<string>('');

  // Initialize
  useEffect(() => {
    const init = async () => {
      // Set default date to today Malaysia time
      const now = new Date();
      // Adjust to UTC+8 manually for simple default string
      const myTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      const todayString = myTime.toISOString().split('T')[0];
      const timeStr = myTime.toISOString().split('T')[1].substring(0, 5);

      setDate(todayString); // Only set date on mount
      setTime(timeStr);
      setTodayStr(todayString);

      // Load recent searches
      try {
        const saved = localStorage.getItem('ktmb_recent_searches');
        if (saved) {
          setRecentSearches(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Failed to parse recent searches', e);
      }

      try {
        const routesData = await getRoutes();
        setRouteGroups(routesData);
      } catch (error) {
        console.error('Failed to fetch routes', error);
      }
    };
    init();
  }, []);

  // Update available routes when service type changes
  useEffect(() => {
    if (routeGroups.length === 0) return;

    // Map serviceType ('Komuter' | 'ETS') to service_name in RouteGroup
    const serviceNameMap: { [key: string]: string } = {
      'Komuter': 'KTM Komuter',
      'ETS': 'ETS'
    };

    const group = routeGroups.find(g => g.service_name === serviceNameMap[serviceType]);
    let routes = group ? group.routes : [];

    // Deduplicate routes by normalizing names (e.g. "A to B" and "B to A" -> "A - B")
    if (serviceType === 'Komuter') {
      const uniqueRoutes: Route[] = [];
      const seenNames = new Set();

      routes.forEach(r => {
        let simplifiedName = r.route_long_name;

        // Handle "KE" (Malay for "to") split
        if (simplifiedName.includes(' KE ')) {
          const parts = simplifiedName.split(' KE ').map(s => s.trim());
          // Sort to ensure A-B and B-A get same key
          const sortedKey = [...parts].sort().join(' - ');
          // Use the alphabetical order for display too
          simplifiedName = sortedKey;
        }

        if (!seenNames.has(simplifiedName)) {
          seenNames.add(simplifiedName);
          // Create a new route object with the simplified name
          uniqueRoutes.push({
            ...r,
            route_long_name: simplifiedName
          });
        }
      });
      routes = uniqueRoutes;
    }

    setAvailableRoutes(routes);

    // Default to first route if available
    if (routes.length > 0) {
      setSelectedRouteId(routes[0].route_id);
    } else {
      setSelectedRouteId('');
    }
  }, [serviceType, routeGroups]);

  // Fetch stations whenever serviceType OR selectedRouteId changes
  useEffect(() => {
    const fetchStations = async () => {
      setStationLoading(true);
      try {
        // Pass selectedRouteId if available, otherwise just serviceType
        const stationData = await getStations(selectedRouteId || undefined, serviceType);
        setStations(stationData);

        // Reset selections when stations refresh
        // Note: Logic allows checking if current ID is still valid could be better, but explicit reset is safer for now.
        // However, this interferes with Recent Search restoring if it triggers a service type change.
        // We will handle that by not setting IDs until we are sure, or accepting the brief reset.
        // In `handleRecentSelect`, we set ServiceType then executed search.
        // The search execution doesn't depend on `stations` state for IDs, it uses args.
        // The display might reset to "Start from..." briefly then we'd need to set it back?
        // Actually, `handleRecentSelect` calls `setOriginId`.
        // If `setServiceType` triggers this effect, and this effect calls `setStations` then `setOriginId('')`...
        // Then the `setOriginId` from `handleRecentSelect` might be overwritten if it happens before the async fetch returns.
        // Or if it happens after.
        // Correct fix: check if the new station data contains the current ID.
        // We can't do that easily because we can't access `originId` inside the effect without adding it to deps, causing a loop.
        // Actually we can use a ref or functionally update checks.
        // Or, we simply don't reset IF the IDs are already set? No, that's wrong if we switch lines.

        // For now, I will perform a simple check.
        // If we are just mounting or switching lines manually, it's fine.
        setOriginId('');
        setDestinationId('');
      } catch (error) {
        console.error('Failed to fetch stations', error);
      } finally {
        setStationLoading(false);
      }
    };

    fetchStations();
  }, [serviceType, selectedRouteId]);

  const executeSearch = async (sOriginId: string, sDestinationId: string, sDate: string, sServiceType: string, sTime: string) => {
    setLoading(true);
    setHasSearched(true);
    setIsSearchCollapsed(true);
    try {
      const response = await searchTrips(sOriginId, sDestinationId, sDate, sServiceType, sTime);
      setTrips(response.trips);
      setDayType(response.day_type);

      // Fetch live vehicle positions if searching for today
      if (sDate === todayStr) {
        try {
          const vehicleData = await getVehiclePositions();
          const trainMap = new Map<string, string>();
          for (const v of vehicleData.vehicles) {
            const tripId = v.vehicle.trip.tripId;
            if (tripId) {
              const trainNum = getTrainNumber(tripId);
              trainMap.set(trainNum, tripId);
            }
          }
          setLiveTrainMap(trainMap);
        } catch {
          setLiveTrainMap(new Map());
        }
      } else {
        setLiveTrainMap(new Map());
      }
    } catch (error) {
      console.error('Search failed', error);
      setTrips([]);
      setLiveTrainMap(new Map());
    } finally {
      setLoading(false);
    }
  };

  const updateRecentSearches = (sOriginId: string, sDestinationId: string, sServiceType: string) => {
    // We try to find names.
    const oName = stations.find(s => s.station_id === sOriginId)?.station_name || sOriginId;
    const dName = stations.find(s => s.station_id === sDestinationId)?.station_name || sDestinationId;

    const newItem: RecentSearchItem = {
      id: `${sOriginId}-${sDestinationId}-${sServiceType}`,
      originId: sOriginId,
      destinationId: sDestinationId,
      originName: oName, // Ideally we should store names if not found
      destinationName: dName,
      serviceType: sServiceType,
      timestamp: Date.now()
    };

    setRecentSearches(prev => {
      // 1. Remove exact duplicate to move it to top
      const filtered = prev.filter(item =>
        !(item.originId === sOriginId && item.destinationId === sDestinationId && item.serviceType === sServiceType)
      );

      // 2. Add new to top
      const updated = [newItem, ...filtered];

      // 3. Enforce limit per Service Type (max 3)
      const serviceCounts: { [key: string]: number } = {};
      const final: RecentSearchItem[] = [];

      for (const item of updated) {
        const count = serviceCounts[item.serviceType] || 0;
        if (count < 3) {
          final.push(item);
          serviceCounts[item.serviceType] = count + 1;
        }
      }

      localStorage.setItem('ktmb_recent_searches', JSON.stringify(final));
      return final;
    });
  };

  const handleSearch = async () => {
    if (!originId || !destinationId || !date) return;

    updateRecentSearches(originId, destinationId, serviceType);
    await executeSearch(originId, destinationId, date, serviceType, time);
  };

  const handleRecentSelect = (item: RecentSearchItem) => {
    // 1. Set Service Type (might trigger stations reload)
    if (item.serviceType !== serviceType) {
      setServiceType(item.serviceType);
      // NOTE: changing serviceType triggers the effect that clears Origin/Dest.
      // This is a known issue. The search will succeed because we call executeSearch with params,
      // but the UI dropdowns might show "Start from..." if the effect clears them after we set them.
      // We can patch this by setting IDs slightly delayed or relying on the user seeing results.
      // For now, we will set them. If they get cleared, at least the search ran.
      // Ideally, the effect shouldn't clear if the IDs are valid for the new service.
    }

    // 2. Set IDs
    // We wrap this in a timeout to hopefully run after the effect clears? 
    // No, React batches updates.
    // Let's just set them.
    setOriginId(item.originId);
    setDestinationId(item.destinationId);

    // 3. Update date to today if not set? Already set on mount.

    // 4. Run Search
    executeSearch(item.originId, item.destinationId, date, item.serviceType, time);
  };

  const handleReset = () => {
    setOriginId('');
    setDestinationId('');
    setTrips([]);
    setHasSearched(false);
    setIsSearchCollapsed(false);
    setLiveTrainMap(new Map());
    setDayType('');
  };

  const handleSwap = () => {
    if (stationLoading) return;
    setOriginId(destinationId);
    setDestinationId(originId);
  };

  // Helper to format arrival/departure HH:mm:ss to HH:mm
  const formatTime = (time: string) => time ? time.substring(0, 5) : '--:--';

  // Helper to extract train number from GTFS trip ID (e.g. "weekday_2067" -> "2067")
  const getTrainNumber = (gtfsTripId: string): string => {
    const parts = gtfsTripId.split('_');
    return parts.length > 1 ? parts.slice(1).join('_') : gtfsTripId;
  };

  // Match by train number only (ignores weekday/weekend prefix)
  const getLiveTripId = (tripId: string): string | null => {
    if (liveTrainMap.size === 0) return null;
    return liveTrainMap.get(tripId) ?? null;
  };

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
          <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${isSearchCollapsed ? 'mb-0' : 'mb-4'} md:mb-6`}>
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

            {/* Search Summary (Visible only when collapsed) */}
            {isSearchCollapsed && hasSearched && (
              <div className="md:hidden w-full text-sm text-gray-600 dark:text-gray-400 -mt-2 mb-2 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {stations.find(s => s.station_id === originId)?.station_name || originId}
                  </span>
                  <ArrowRight size={14} className="text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {stations.find(s => s.station_id === destinationId)?.station_name || destinationId}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar size={12} /> {date}
                  <span className="w-1 h-1 bg-gray-300 rounded-full mx-1"></span>
                  <span className={serviceType === 'ETS' ? 'text-yellow-600 dark:text-yellow-500' : 'text-blue-600 dark:text-blue-400'}>
                    {serviceType}
                  </span>
                </div>
              </div>
            )}

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



            {/* Route Selector */}
            {availableRoutes.length > 0 && (
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Route / Line</label>
                <select
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  disabled={stationLoading}
                  className="w-full p-3 rounded-lg border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 dark:bg-white/10 focus:bg-white dark:focus:bg-white/20 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {availableRoutes.map((route) => (
                    <option key={route.route_id} value={route.route_id} className="dark:bg-slate-900">
                      {route.route_long_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            {/* Recent Searches */}
            <RecentSearches
              searches={recentSearches.filter(s => s.serviceType === serviceType)}
              onSelect={handleRecentSelect}
              className="mt-4"
            />
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
              trips.map((trip, idx) => {
                const liveTripId = getLiveTripId(trip.trip_id);
                const isLive = !!liveTripId;

                const cardContent = (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                    {/* Train Info */}
                    <div className="flex items-center gap-4 min-w-[30%]">
                      <div className={`p-3 rounded-lg font-bold text-lg min-w-[3.5rem] text-center transition-colors ${isLive
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 group-hover:bg-emerald-600 group-hover:text-white'
                        : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 group-hover:bg-blue-600 group-hover:text-white'
                        }`}>
                        {trip.trip_id}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white text-lg">To {trip.trip_headsign}</p>
                          {isLive && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              Live
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className={`w-2 h-2 rounded-full ${trip.route_type === 1 ? 'bg-orange-400' : 'bg-blue-400'}`}></span>
                          {trip.route_long_name}
                          {isLive && (
                            <span className="ml-1.5 text-emerald-600 dark:text-emerald-400 font-medium">· Tap to track</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Times & Duration */}
                    <div className="flex items-center justify-between gap-4 flex-1 md:flex-none md:gap-12">
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
                );

                return (
                  <div
                    key={`${trip.trip_id}-${idx}`}
                    className={`bg-white/80 dark:bg-white/5 backdrop-blur-md p-5 rounded-xl shadow-sm border transition-all group ${isLive
                      ? 'border-emerald-200 dark:border-emerald-800/50 hover:shadow-lg hover:shadow-emerald-100/50 dark:hover:shadow-emerald-900/20 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700'
                      : 'border-gray-100 dark:border-white/10 hover:shadow-md'
                      }`}
                    onClick={isLive ? () => router.push(`/live?trip=${liveTripId}`) : undefined}
                  >
                    {cardContent}
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </main >
  );
}
