import 'package:flutter/material.dart';
import '../models/models.dart';
import '../utils/train_utils.dart';

class TripTimeline extends StatefulWidget {
  final TrainPosition trainPos;
  final VehiclePosition? vehicle;
  final ScrollController? scrollController;
  final bool isDark;

  const TripTimeline({
    super.key,
    required this.trainPos,
    this.vehicle,
    this.scrollController,
    required this.isDark,
  });

  @override
  State<TripTimeline> createState() => _TripTimelineState();
}

class _TripTimelineState extends State<TripTimeline> {
  late ScrollController _scrollController;
  bool _hasAutoScrolled = false;

  @override
  void initState() {
    super.initState();
    _scrollController = widget.scrollController ?? ScrollController();
    // Defer auto-scroll to post-frame to ensure layout is ready
    WidgetsBinding.instance.addPostFrameCallback((_) => _autoScroll());
  }

  @override
  void didUpdateWidget(TripTimeline oldWidget) {
    super.didUpdateWidget(oldWidget);
    // If route changes, reset auto-scroll
    if (widget.trainPos.route != oldWidget.trainPos.route) {
      _hasAutoScrolled = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _autoScroll());
    }
  }

  @override
  void dispose() {
    if (widget.scrollController == null) {
      _scrollController.dispose();
    }
    super.dispose();
  }

  void _autoScroll() {
    if (_hasAutoScrolled || !_scrollController.hasClients) return;

    final trainPos = widget.trainPos;
    // targetIndex is where the train is currently at (or closest to)
    int targetIndex = trainPos.atStation ?? trainPos.segmentIndex;

    // Add 1 to target index if it's between stations and passed the halfway point
    // This ensures we focus on the "next" station if we're close to it
    if (trainPos.atStation == null && trainPos.fraction > 0.5) {
      targetIndex = trainPos.segmentIndex + 1;
    }

    _hasAutoScrolled = true;

    // Calculate the position to center the item
    // 50.0 is approx height of each item (48px content + padding)
    // We add 16.0 for top padding of the list view
    const double itemHeight = 50.0;
    const double topPadding = 16.0;

    final double targetItemOffset = (targetIndex * itemHeight) + topPadding;
    final double viewportHeight = _scrollController.position.viewportDimension;

    // Calculate offset to center the item:
    // itemTop - (viewportHeight / 2) + (itemHeight / 2)
    final double centerOffset =
        targetItemOffset - (viewportHeight / 2) + (itemHeight / 2);

    _scrollController.animateTo(
      centerOffset.clamp(0.0, _scrollController.position.maxScrollExtent),
      duration: const Duration(milliseconds: 800),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final routeColor = TrainUtils.parseColor(widget.trainPos.route.color);

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: widget.trainPos.route.stations.length,
      itemBuilder: (context, index) {
        final station = widget.trainPos.route.stations[index];
        final isFirst = index == 0;
        final isLast = index == widget.trainPos.route.stations.length - 1;

        final isTrainAtThisStation = widget.trainPos.atStation == index;

        // Logic for passed/upcoming
        bool isPassed;
        if (widget.trainPos.atStation != null) {
          isPassed = index < widget.trainPos.atStation!;
        } else {
          isPassed =
              index < widget.trainPos.segmentIndex ||
              (index == widget.trainPos.segmentIndex &&
                  widget.trainPos.fraction > 0.9);
        }

        final isCurrent =
            isTrainAtThisStation ||
            (widget.trainPos.atStation == null &&
                index == widget.trainPos.segmentIndex &&
                widget.trainPos.fraction <= 0.9);

        // Calculate floating train position if between stations
        final showFloatingTrain =
            widget.trainPos.atStation == null &&
            index == widget.trainPos.segmentIndex &&
            !isLast;

        final double bottomPadding = showFloatingTrain ? 32.0 : 0.0;

        // Layout constants
        const double lineLeftOffset = 32.0; // Reduced from 100.0
        const double dotSize = 14.0;
        const double dotLeftOffset = lineLeftOffset - (dotSize / 2);

        return Center(
          child: Container(
            width: double.infinity,
            constraints: const BoxConstraints(maxWidth: 400),
            padding: EdgeInsets.only(bottom: bottomPadding),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // 1. Connection Line (Absolute)
                if (!isLast)
                  Positioned(
                    left: lineLeftOffset,
                    top: 24, // Start from center of dot (approx 24px down)
                    bottom: -(24 + bottomPadding),
                    width: 2,
                    child: Container(
                      color: isPassed || isTrainAtThisStation
                          ? routeColor
                          : widget.isDark
                          ? Colors.grey[800]
                          : Colors.grey[300],
                    ),
                  ),

                // 2. Station Row (Dot + Text)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Spacer to align with line
                      const SizedBox(width: dotLeftOffset),

                      // Dot / Train Icon (Stationary)
                      SizedBox(
                        width: dotSize,
                        height: dotSize + 10,
                        child: Center(
                          child: isTrainAtThisStation
                              ? OverflowBox(
                                  minWidth: 28,
                                  maxWidth: 28,
                                  minHeight: 28,
                                  maxHeight: 28,
                                  child: _TrainIcon(
                                    color: routeColor,
                                    speed: widget.vehicle?.speed,
                                    isStopped:
                                        (widget.vehicle?.speed ?? 0) == 0,
                                  ),
                                )
                              : _buildStationDot(
                                  isPassed || isCurrent
                                      ? routeColor
                                      : (widget.isDark
                                            ? Colors.grey[800]!
                                            : Colors.grey[300]!),
                                  isFirst || isLast,
                                  isFilled: isPassed || isCurrent,
                                ),
                        ),
                      ),

                      const SizedBox(width: 16),

                      // Text + Status Label
                      Expanded(
                        child: Row(
                          children: [
                            Flexible(
                              child: Text(
                                station.name,
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
                                style: TextStyle(
                                  fontSize:
                                      (isFirst ||
                                          isLast ||
                                          isTrainAtThisStation)
                                      ? 16
                                      : 14,
                                  fontWeight:
                                      (isFirst ||
                                          isLast ||
                                          isTrainAtThisStation)
                                      ? FontWeight.bold
                                      : FontWeight.normal,
                                  color: isTrainAtThisStation
                                      ? (widget.isDark
                                            ? Colors.white
                                            : Colors.black)
                                      : (isCurrent
                                            ? (widget.isDark
                                                  ? Colors.white
                                                  : Colors.black)
                                            : (isPassed
                                                  ? (widget.isDark
                                                        ? Colors.grey[300]
                                                        : Colors.grey[800])
                                                  : Colors.grey[500])),
                                ),
                              ),
                            ),
                            if (isTrainAtThisStation &&
                                widget.vehicle != null) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: routeColor,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  (widget.vehicle!.speed == 0)
                                      ? 'STOPPED'
                                      : '${widget.vehicle!.speed.round()} km/h',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // 3. Floating Train (Absolute)
                if (showFloatingTrain)
                  Positioned(
                    left: lineLeftOffset - 14,
                    top: 24.0 + (widget.trainPos.fraction * 40.0),
                    child: _TrainIcon(
                      color: routeColor,
                      speed: widget.vehicle?.speed,
                      isFloating: true,
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStationDot(Color color, bool isMajor, {bool isFilled = false}) {
    return Center(
      child: Container(
        width: isMajor ? 14 : 10,
        height: isMajor ? 14 : 10,
        decoration: BoxDecoration(
          color: isFilled ? color : Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: color, width: 2),
        ),
      ),
    );
  }
}

class _TrainIcon extends StatefulWidget {
  final Color color;
  final double? speed;
  final bool isStopped;
  final bool isFloating;

  const _TrainIcon({
    required this.color,
    this.speed,
    this.isStopped = false,
    this.isFloating = false,
  });

  @override
  State<_TrainIcon> createState() => _TrainIconState();
}

class _TrainIconState extends State<_TrainIcon>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _opacityAnimation = Tween<double>(
      begin: 0.3,
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
    final speedText = (widget.isFloating && widget.speed != null)
        ? (widget.speed! > 0
              ? '${widget.speed!.round()} km/h'
              : (widget.isStopped ? 'STOPPED' : null))
        : null;

    final pill = speedText != null
        ? Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: widget.color,
              borderRadius: BorderRadius.circular(6),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Text(
              speedText,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
          )
        : null;

    return SizedBox(
      width: (widget.isFloating && pill != null)
          ? 100
          : 28, // Allow width for pill
      height: 28,
      child: Stack(
        alignment: Alignment.centerLeft, // Align icon to left to handle pill
        clipBehavior: Clip.none,
        children: [
          // Icon centered
          Positioned(
            left: 0,
            child: SizedBox(
              width: 28,
              height: 28,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  AnimatedBuilder(
                    animation: _opacityAnimation,
                    builder: (context, child) {
                      return Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: widget.color.withValues(
                            alpha: _opacityAnimation.value * 0.6,
                          ),
                        ),
                      );
                    },
                  ),
                  Icon(Icons.train_rounded, color: widget.color, size: 16),
                ],
              ),
            ),
          ),

          // Speed/Status Pill
          if (pill != null)
            Positioned(
              left: 36, // 28 width + 8px gap
              top: 4, // Vertically center approx
              child: pill,
            ),
        ],
      ),
    );
  }
}
