import 'package:flutter/material.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';

class TripCard extends StatelessWidget {
  final TripSearchResult trip;
  final bool isLive;
  final String duration;
  final String formattedDeparture;
  final String formattedArrival;
  final VoidCallback? onTap;

  const TripCard({
    super.key,
    required this.trip,
    required this.isLive,
    required this.duration,
    required this.formattedDeparture,
    required this.formattedArrival,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(0), // Padding moved to inner container
        decoration: BoxDecoration(
          color: isDark
              ? Colors.white.withValues(alpha: 0.05)
              : Colors.white.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(20),
          border: isLive
              ? null // Gradient border handles this
              : Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.1)
                      : const Color(0xFFE2E8F0),
                  width: 1,
                ),
          boxShadow: [
            BoxShadow(
              color: isLive
                  ? AppTheme.accentEmerald.withValues(alpha: 0.15)
                  : Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
              blurRadius: isLive ? 12 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Container(
          decoration: isLive
              ? BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  gradient: LinearGradient(
                    colors: [
                      AppTheme.accentEmerald.withValues(alpha: 0.2),
                      Colors.transparent,
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                )
              : null,
          child: Column(
            children: [
              // Top Section (Header)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: isLive
                            ? AppTheme.accentEmerald
                            : AppTheme.primaryBlue.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        trip.tripId,
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                          color: isLive ? Colors.white : AppTheme.primaryBlue,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'To ${trip.tripHeadsign}',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                          color: isDark ? Colors.white : Colors.grey.shade900,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (isLive) _buildLiveBadge(isDark),
                  ],
                ),
              ),

              // Route Info Row (New)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: trip.routeType == 1
                            ? Colors.orange.shade400
                            : Colors.blue.shade400,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        trip.routeLongName,
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark
                              ? Colors.grey.shade400
                              : Colors.grey.shade600,
                          fontWeight: FontWeight.w500,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (isLive) ...[
                      const SizedBox(width: 8),
                      Text(
                        '·',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark
                              ? Colors.grey.shade600
                              : Colors.grey.shade400,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Tap to track',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isDark
                              ? AppTheme.accentEmeraldLight
                              : AppTheme.accentEmerald,
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              // Divider with ticket notches
              Stack(
                children: [
                  Divider(
                    height: 1,
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.1)
                        : Colors.grey.withValues(alpha: 0.1),
                  ),
                ],
              ),

              // Bottom Section (Times)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildTimeColumn(
                      formattedDeparture,
                      'Depart',
                      CrossAxisAlignment.start,
                      isDark,
                    ),
                    Column(
                      children: [
                        Icon(
                          Icons.train_rounded,
                          color: isLive
                              ? AppTheme.accentEmerald
                              : Colors.grey.shade400,
                          size: 20,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          duration,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isLive
                                ? AppTheme.accentEmerald
                                : Colors.grey.shade500,
                          ),
                        ),
                        if (isLive) ...[
                          const SizedBox(height: 2),
                          const Icon(
                            Icons.circle,
                            size: 4,
                            color: AppTheme.accentEmerald,
                          ),
                        ] else ...[
                          const SizedBox(height: 2),
                          Row(
                            children: List.generate(
                              5,
                              (index) => Container(
                                width: 3,
                                height: 3,
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 1.5,
                                ),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.grey.shade300,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    _buildTimeColumn(
                      formattedArrival,
                      'Arrive',
                      CrossAxisAlignment.end,
                      isDark,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTimeColumn(
    String time,
    String label,
    CrossAxisAlignment align,
    bool isDark,
  ) {
    return Column(
      crossAxisAlignment: align,
      children: [
        Text(
          time,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            color: isDark ? Colors.white : Colors.grey.shade900,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            color: Colors.grey.shade500,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildLiveBadge(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isDark
            ? AppTheme.accentEmerald.withValues(alpha: 0.15)
            : AppTheme.accentEmerald.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? AppTheme.accentEmerald.withValues(alpha: 0.3)
              : AppTheme.accentEmerald.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _PulsingDot(color: AppTheme.accentEmerald, size: 8),
          const SizedBox(width: 5),
          Text(
            'LIVE',
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
              color: isDark
                  ? AppTheme.accentEmeraldLight
                  : AppTheme.accentEmerald,
            ),
          ),
        ],
      ),
    );
  }
}

class _PulsingDot extends StatefulWidget {
  final Color color;
  final double size;

  const _PulsingDot({required this.color, this.size = 8});

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat();
    _animation = Tween<double>(
      begin: 0.4,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        children: [
          AnimatedBuilder(
            animation: _animation,
            builder: (_, __) => Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.color.withValues(alpha: _animation.value * 0.4),
              ),
            ),
          ),
          Center(
            child: Container(
              width: widget.size * 0.6,
              height: widget.size * 0.6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
