import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/network/websocket_service.dart';

class DrawnLine {
  final List<Offset> path;
  final Color color;
  final double strokeWidth;

  DrawnLine({required this.path, required this.color, required this.strokeWidth});
}

class WhiteboardScreen extends StatefulWidget {
  const WhiteboardScreen({super.key});

  @override
  State<WhiteboardScreen> createState() => _WhiteboardScreenState();
}

class _WhiteboardScreenState extends State<WhiteboardScreen> {
  final List<DrawnLine> _lines = [];
  Color _selectedColor = EchoColors.blurple;
  double _strokeWidth = 3.0;

  final List<Color> _colors = [
    EchoColors.blurple,
    EchoColors.green,
    EchoColors.red,
    EchoColors.yellow,
    Colors.white,
    Colors.black,
  ];

  @override
  void initState() {
    super.initState();
    final wsService = context.read<WebSocketService>();
    wsService.addListener(_handleWsEvent);
  }

  void _handleWsEvent(String eventType, dynamic data) {
    if (eventType == 'share.annotation_clear') {
      if (mounted) setState(() => _lines.clear());
    } else if (eventType == 'share.annotation_draw' && data is Map<String, dynamic>) {
      // Handle remote draw events
    }
  }

  @override
  void dispose() {
    final wsService = context.read<WebSocketService>();
    wsService.removeListener(_handleWsEvent);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wsService = context.read<WebSocketService>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ortak Beyaz Tahta'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline),
            tooltip: 'Temizle',
            onPressed: () {
              setState(() => _lines.clear());
              wsService.sendWhiteboardClear();
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Canvas Area
          Expanded(
            child: Container(
              color: Colors.white,
              child: GestureDetector(
                onPanStart: (details) {
                  setState(() {
                    _lines.add(
                      DrawnLine(
                        path: [details.localPosition],
                        color: _selectedColor,
                        strokeWidth: _strokeWidth,
                      ),
                    );
                  });
                },
                onPanUpdate: (details) {
                  setState(() {
                    if (_lines.isNotEmpty) {
                      _lines.last.path.add(details.localPosition);
                    }
                  });
                },
                onPanEnd: (_) {
                  if (_lines.isNotEmpty) {
                    final lastLine = _lines.last;
                    wsService.sendWhiteboardDraw({
                      'points': lastLine.path.map((p) => [p.dx, p.dy]).toList(),
                      'color': lastLine.color.toARGB32().toRadixString(16),
                      'width': lastLine.strokeWidth,
                    });
                  }
                },
                child: CustomPaint(
                  painter: _WhiteboardPainter(lines: _lines),
                  size: Size.infinite,
                ),
              ),
            ),
          ),

          // Tools Toolbar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: EchoColors.card,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: _colors.map((color) {
                    final isSelected = _selectedColor == color;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedColor = color),
                      child: Container(
                        margin: const EdgeInsets.only(right: 8),
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                          border: isSelected ? Border.all(color: EchoColors.textPrimary, width: 3) : null,
                        ),
                      ),
                    );
                  }).toList(),
                ),
                Row(
                  children: [
                    IconButton(
                      icon: Icon(Icons.brush, size: 20, color: _strokeWidth == 3.0 ? EchoColors.blurple : EchoColors.textMuted),
                      onPressed: () => setState(() => _strokeWidth = 3.0),
                    ),
                    IconButton(
                      icon: Icon(Icons.brush, size: 28, color: _strokeWidth == 7.0 ? EchoColors.blurple : EchoColors.textMuted),
                      onPressed: () => setState(() => _strokeWidth = 7.0),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WhiteboardPainter extends CustomPainter {
  final List<DrawnLine> lines;

  _WhiteboardPainter({required this.lines});

  @override
  void paint(Canvas canvas, Size size) {
    for (final line in lines) {
      if (line.path.isEmpty) continue;
      final paint = Paint()
        ..color = line.color
        ..strokeCap = StrokeCap.round
        ..strokeWidth = line.strokeWidth
        ..isAntiAlias = true
        ..style = PaintingStyle.stroke;

      final path = Path()..moveTo(line.path.first.dx, line.path.first.dy);
      for (int i = 1; i < line.path.length; i++) {
        path.lineTo(line.path[i].dx, line.path[i].dy);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
