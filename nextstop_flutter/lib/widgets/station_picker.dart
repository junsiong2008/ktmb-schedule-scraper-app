import 'package:flutter/material.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';

class StationPicker extends StatelessWidget {
  final String label;
  final String hint;
  final String? selectedId;
  final List<Station> stations;
  final bool isLoading;
  final ValueChanged<String?> onChanged;
  final IconData icon;

  const StationPicker({
    super.key,
    required this.label,
    required this.hint,
    required this.selectedId,
    required this.stations,
    required this.isLoading,
    required this.onChanged,
    this.icon = Icons.train,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
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
            borderRadius: BorderRadius.circular(16),
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
                value: selectedId != null && selectedId!.isNotEmpty
                    ? selectedId
                    : null,
                icon: Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: Colors.grey.shade500,
                ),
                isExpanded: true,
                dropdownColor: isDark ? const Color(0xFF1E293B) : Colors.white,
                borderRadius: BorderRadius.circular(16),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                selectedItemBuilder: (BuildContext context) {
                  return stations.map<Widget>((Station station) {
                    return Row(
                      children: [
                        Icon(
                          icon,
                          size: 18,
                          color: isDark
                              ? AppTheme.accentEmerald
                              : AppTheme.primaryBlue,
                        ),
                        const SizedBox(width: 12),
                        Flexible(
                          child: Text(
                            station.stationName,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: isDark
                                  ? Colors.white
                                  : Colors.grey.shade900,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    );
                  }).toList();
                },
                hint: Row(
                  children: [
                    Icon(icon, size: 18, color: Colors.grey.shade500),
                    const SizedBox(width: 12),
                    Text(
                      isLoading ? 'Loading stations...' : hint,
                      style: TextStyle(
                        color: Colors.grey.shade500,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                items: stations.map((station) {
                  return DropdownMenuItem<String>(
                    value: station.stationId,
                    child: Text(
                      station.stationName,
                      style: TextStyle(
                        fontSize: 15,
                        color: isDark ? Colors.white : Colors.grey.shade900,
                      ),
                    ),
                  );
                }).toList(),
                onChanged: isLoading ? null : onChanged,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
