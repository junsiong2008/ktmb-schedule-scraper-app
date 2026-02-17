import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/schedule_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/service_type_tabs.dart';
import '../widgets/station_picker.dart';
import '../widgets/trip_card.dart';
import '../widgets/recent_searches.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  bool _isSearchCollapsed = false;
  late final AnimationController _animController;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _fadeAnim = CurvedAnimation(
      parent: _animController,
      curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
    );

    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.1), end: Offset.zero)
        .animate(
          CurvedAnimation(
            parent: _animController,
            curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
          ),
        );

    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ScheduleProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // App bar
          _buildAppBar(context, provider, isDark),

          // Content
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // Search card
                FadeTransition(
                  opacity: _fadeAnim,
                  child: SlideTransition(
                    position: _slideAnim,
                    child: _buildSearchCard(context, provider, isDark),
                  ),
                ),

                const SizedBox(height: 20),

                // Results
                if (provider.hasSearched)
                  _buildResults(context, provider, isDark),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppBar(
    BuildContext context,
    ScheduleProvider provider,
    bool isDark,
  ) {
    return SliverAppBar(
      expandedHeight: 80,
      floating: true,
      pinned: true,
      backgroundColor: isDark
          ? AppTheme.darkSurface.withValues(alpha: 0.95)
          : Colors.transparent,
      surfaceTintColor: Colors.transparent,
      flexibleSpace: Container(
        decoration: isDark
            ? null
            : const BoxDecoration(gradient: AppTheme.primaryGradient),
        child: FlexibleSpaceBar(
          expandedTitleScale: 1.25,
          titlePadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 12,
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.1),
                    width: 1,
                  ),
                ),
                child: const Icon(
                  Icons.train_rounded,
                  size: 18,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Next Stop',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 20,
                  color: Colors.white,
                  letterSpacing: -0.5,
                ),
              ),
              const Spacer(),
              // Live map button
              GestureDetector(
                onTap: () => Navigator.pushNamed(context, '/live'),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.map_rounded,
                        size: 14,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'Live',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.amber.shade400,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'BETA',
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0D47A1),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSearchCard(
    BuildContext context,
    ScheduleProvider provider,
    bool isDark,
  ) {
    return GestureDetector(
      onTap: () {
        if (_isSearchCollapsed) {
          setState(() => _isSearchCollapsed = false);
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isDark
                ? Colors.white.withValues(alpha: 0.1)
                : const Color(0xFFE2E8F0),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.04),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Icon(
                  Icons.location_on_rounded,
                  color: AppTheme.primaryBlueLight,
                  size: 24,
                ),
                const SizedBox(width: 8),
                Text(
                  'Plan Your Journey',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : Colors.grey.shade900,
                  ),
                ),
                const Spacer(),
                if (provider.hasSearched)
                  IconButton(
                    onPressed: () {
                      setState(() => _isSearchCollapsed = !_isSearchCollapsed);
                    },
                    icon: AnimatedRotation(
                      turns: _isSearchCollapsed ? 0.5 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: Icon(
                        Icons.keyboard_arrow_up_rounded,
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ),
              ],
            ),

            // Collapsed summary
            if (_isSearchCollapsed && provider.hasSearched) ...[
              const SizedBox(height: 8),
              _buildCollapsedSummary(provider, isDark),
            ],

            // Full search form
            if (!_isSearchCollapsed) ...[
              const SizedBox(height: 16),

              // Service type tabs
              ServiceTypeTabs(
                selected: provider.serviceType,
                onChanged: provider.setServiceType,
              ),

              const SizedBox(height: 16),

              // Route selector
              if (provider.availableRoutes.isNotEmpty)
                _buildRouteSelector(provider, isDark),

              if (provider.availableRoutes.isNotEmpty)
                const SizedBox(height: 16),

              // Origin station
              StationPicker(
                label: 'Origin',
                hint: 'Start from...',
                selectedId: provider.originId,
                stations: provider.stations,
                isLoading: provider.stationLoading,
                onChanged: (val) => provider.setOrigin(val ?? ''),
                icon: Icons.trip_origin_rounded,
              ),

              const SizedBox(height: 8),

              // Swap button
              Center(
                child: IconButton(
                  onPressed: provider.swapStations,
                  icon: Icon(
                    Icons.swap_vert_rounded,
                    color: isDark
                        ? Colors.grey.shade400
                        : AppTheme.primaryBlueLight,
                  ),
                  style: IconButton.styleFrom(
                    backgroundColor: isDark
                        ? Colors.white.withValues(alpha: 0.08)
                        : AppTheme.primaryBlue.withValues(alpha: 0.08),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 8),

              // Destination station
              StationPicker(
                label: 'Destination',
                hint: 'Go to...',
                selectedId: provider.destinationId,
                stations: provider.stations,
                isLoading: provider.stationLoading,
                onChanged: (val) => provider.setDestination(val ?? ''),
                icon: Icons.place_rounded,
              ),

              const SizedBox(height: 16),

              // Date & time
              Row(
                children: [
                  Expanded(child: _buildDatePicker(context, provider, isDark)),
                  const SizedBox(width: 12),
                  Expanded(child: _buildTimePicker(context, provider, isDark)),
                ],
              ),

              const SizedBox(height: 20),

              // Search button
              // Search button
              Builder(
                builder: (context) {
                  final isEnabled =
                      provider.originId.isNotEmpty &&
                      provider.destinationId.isNotEmpty &&
                      provider.date.isNotEmpty &&
                      !provider.loading;

                  return Container(
                    width: double.infinity,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: isEnabled
                          ? const LinearGradient(
                              colors: [AppTheme.accentAmber, Color(0xFFFF8F00)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                      color: isEnabled
                          ? null
                          : (isDark
                                ? Colors.grey.shade800
                                : Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: isEnabled
                          ? [
                              BoxShadow(
                                color: AppTheme.accentAmber.withValues(
                                  alpha: 0.4,
                                ),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ]
                          : null,
                    ),
                    child: ElevatedButton(
                      onPressed: isEnabled
                          ? () async {
                              await provider.search();
                              setState(() => _isSearchCollapsed = true);
                            }
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        disabledBackgroundColor: Colors.transparent,
                        disabledForegroundColor: isDark
                            ? Colors.grey.shade500
                            : Colors.grey.shade400,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: provider.loading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Search Trains',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  );
                },
              ),

              // Recent searches
              if (provider.filteredRecentSearches.isNotEmpty) ...[
                const SizedBox(height: 16),
                RecentSearchesWidget(
                  searches: provider.filteredRecentSearches,
                  onSelect: (item) async {
                    await provider.executeRecentSearch(item);
                    setState(() => _isSearchCollapsed = true);
                  },
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCollapsedSummary(ScheduleProvider provider, bool isDark) {
    final originName =
        provider.stations
            .where((s) => s.stationId == provider.originId)
            .firstOrNull
            ?.stationName ??
        provider.originId;
    final destName =
        provider.stations
            .where((s) => s.stationId == provider.destinationId)
            .firstOrNull
            ?.stationName ??
        provider.destinationId;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Flexible(
              child: Text(
                originName,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.grey.shade900,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Icon(
                Icons.arrow_forward_rounded,
                size: 16,
                color: Colors.grey.shade500,
              ),
            ),
            Flexible(
              child: Text(
                destName,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.grey.shade900,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Icon(
              Icons.calendar_today_rounded,
              size: 12,
              color: Colors.grey.shade500,
            ),
            const SizedBox(width: 4),
            Text(
              provider.date,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
            ),
            Container(
              width: 4,
              height: 4,
              margin: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.grey.shade400,
              ),
            ),
            Text(
              provider.serviceType,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: provider.serviceType == 'ETS'
                    ? Colors.amber.shade600
                    : AppTheme.primaryBlueLight,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildRouteSelector(ScheduleProvider provider, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Route / Line',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.grey.shade300 : Colors.grey.shade700,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withValues(alpha: 0.07)
                : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.1)
                  : const Color(0xFFE2E8F0),
            ),
          ),
          child: DropdownButtonHideUnderline(
            child: ButtonTheme(
              alignedDropdown: true,
              child: DropdownButton<String>(
                value: provider.selectedRouteId.isNotEmpty
                    ? provider.selectedRouteId
                    : null,
                isExpanded: true,
                icon: Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: Colors.grey.shade500,
                ),
                dropdownColor: isDark ? const Color(0xFF1E293B) : Colors.white,
                borderRadius: BorderRadius.circular(12),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                items: provider.availableRoutes.map((route) {
                  return DropdownMenuItem<String>(
                    value: route.routeId,
                    child: Text(
                      route.routeLongName,
                      style: TextStyle(
                        fontSize: 15,
                        color: isDark ? Colors.white : Colors.grey.shade900,
                      ),
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) provider.setSelectedRoute(val);
                },
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDatePicker(
    BuildContext context,
    ScheduleProvider provider,
    bool isDark,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Travel Date',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.grey.shade300 : Colors.grey.shade700,
          ),
        ),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: provider.date.isNotEmpty
                  ? DateTime.parse(provider.date)
                  : DateTime.now(),
              firstDate: DateTime.now().subtract(const Duration(days: 30)),
              lastDate: DateTime.now().add(const Duration(days: 365)),
              builder: (context, child) {
                return Theme(
                  data: Theme.of(context).copyWith(
                    colorScheme: Theme.of(
                      context,
                    ).colorScheme.copyWith(primary: AppTheme.primaryBlue),
                  ),
                  child: child!,
                );
              },
            );
            if (picked != null) {
              provider.setDate(DateFormat('yyyy-MM-dd').format(picked));
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.07)
                  : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.1)
                    : const Color(0xFFE2E8F0),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.calendar_today_rounded,
                  size: 16,
                  color: Colors.grey.shade500,
                ),
                const SizedBox(width: 8),
                Text(
                  provider.date.isNotEmpty ? provider.date : 'Select date',
                  style: TextStyle(
                    fontSize: 15,
                    color: provider.date.isNotEmpty
                        ? (isDark ? Colors.white : Colors.grey.shade900)
                        : Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTimePicker(
    BuildContext context,
    ScheduleProvider provider,
    bool isDark,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Travel Time',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.grey.shade300 : Colors.grey.shade700,
          ),
        ),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: () async {
            final initTime = provider.time.isNotEmpty
                ? TimeOfDay(
                    hour: int.parse(provider.time.split(':')[0]),
                    minute: int.parse(provider.time.split(':')[1]),
                  )
                : TimeOfDay.now();
            final picked = await showTimePicker(
              context: context,
              initialTime: initTime,
              builder: (context, child) {
                return Theme(
                  data: Theme.of(context).copyWith(
                    colorScheme: Theme.of(
                      context,
                    ).colorScheme.copyWith(primary: AppTheme.primaryBlue),
                  ),
                  child: child!,
                );
              },
            );
            if (picked != null) {
              provider.setTime(
                '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}',
              );
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.07)
                  : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.1)
                    : const Color(0xFFE2E8F0),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.access_time_rounded,
                  size: 16,
                  color: Colors.grey.shade500,
                ),
                const SizedBox(width: 8),
                Text(
                  provider.time.isNotEmpty ? provider.time : 'Any time',
                  style: TextStyle(
                    fontSize: 15,
                    color: provider.time.isNotEmpty
                        ? (isDark ? Colors.white : Colors.grey.shade900)
                        : Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildResults(
    BuildContext context,
    ScheduleProvider provider,
    bool isDark,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Available Trips',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.grey.shade200 : Colors.grey.shade800,
              ),
            ),
            if (!provider.loading) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.08)
                      : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${provider.trips.length}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey.shade500,
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),

        if (provider.loading)
          _buildLoadingState(isDark)
        else if (provider.errorMessage != null)
          _buildErrorState(provider.errorMessage!, isDark)
        else if (provider.trips.isEmpty)
          _buildEmptyState(isDark)
        else
          ...provider.trips.asMap().entries.map((entry) {
            final trip = entry.value;
            final liveTripId = provider.getLiveTripId(trip.tripId);
            final isLive = liveTripId != null;

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TripCard(
                trip: trip,
                isLive: isLive,
                duration: provider.calculateDuration(
                  trip.departureTime,
                  trip.arrivalTime,
                ),
                formattedDeparture: provider.formatTime(trip.departureTime),
                formattedArrival: provider.formatTime(trip.arrivalTime),
                onTap: isLive
                    ? () => Navigator.pushNamed(
                        context,
                        '/trip_tracker',
                        arguments: liveTripId,
                      )
                    : null,
              ),
            );
          }),
      ],
    );
  }

  Widget _buildLoadingState(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 60),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.03)
            : Colors.white.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.05)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Center(
        child: Column(
          children: [
            SizedBox(
              width: 32,
              height: 32,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: AppTheme.primaryBlueLight,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Searching for available trains...',
              style: TextStyle(color: Colors.grey.shade500, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.03)
            : Colors.white.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.05)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.train_rounded, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(
              'No trains found for this route\non the selected date.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade500, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(String message, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.red.withValues(alpha: isDark ? 0.1 : 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.withValues(alpha: 0.2)),
      ),
      child: Center(
        child: Column(
          children: [
            Icon(
              Icons.error_outline_rounded,
              size: 40,
              color: Colors.red.shade400,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.red.shade400, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}
