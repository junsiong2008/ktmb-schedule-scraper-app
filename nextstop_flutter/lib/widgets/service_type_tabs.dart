import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class ServiceTypeTabs extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;

  const ServiceTypeTabs({
    super.key,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.08)
            : const Color(0xFFE2E8F0),
        borderRadius: BorderRadius.circular(16),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final tabWidth = (width - 8) / 2;

          return Stack(
            children: [
              AnimatedAlign(
                alignment: selected == 'Komuter'
                    ? Alignment.centerLeft
                    : Alignment.centerRight,
                duration: const Duration(milliseconds: 300),
                curve: Curves.elasticOut,
                child: Container(
                  width: tabWidth,
                  height: 40,
                  decoration: BoxDecoration(
                    color: isDark ? AppTheme.darkSurfaceVariant : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                ),
              ),
              Row(
                children: [
                  _buildTab('Komuter', 'KTM Komuter', isDark, tabWidth),
                  _buildTab('ETS', 'ETS', isDark, tabWidth),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildTab(String value, String label, bool isDark, double width) {
    final isActive = selected == value;

    return GestureDetector(
      onTap: () => onChanged(value),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: width,
        height: 40,
        child: Center(
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 200),
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: isActive
                  ? (isDark ? Colors.white : AppTheme.primaryBlue)
                  : (isDark ? Colors.grey.shade400 : Colors.grey.shade600),
              fontFamily: 'Inter',
            ),
            child: Text(label),
          ),
        ),
      ),
    );
  }
}
