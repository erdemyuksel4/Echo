import 'package:flutter/foundation.dart';
import '../network/websocket_service.dart';

class P2PFileTransferProgress {
  final String offerId;
  final String fileName;
  final int totalBytes;
  final int transferredBytes;
  final bool isCompleted;
  final bool isFailed;

  double get progress => totalBytes > 0 ? transferredBytes / totalBytes : 0.0;

  P2PFileTransferProgress({
    required this.offerId,
    required this.fileName,
    required this.totalBytes,
    required this.transferredBytes,
    this.isCompleted = false,
    this.isFailed = false,
  });
}

class P2PFileService {
  final WebSocketService wsService;
  final Map<String, P2PFileTransferProgress> _transfers = {};
  final List<VoidCallback> _listeners = [];

  Map<String, P2PFileTransferProgress> get transfers => Map.unmodifiable(_transfers);

  P2PFileService({required this.wsService}) {
    wsService.addListener(_handleFileSignal);
  }

  void addListener(VoidCallback listener) {
    _listeners.add(listener);
  }

  void removeListener(VoidCallback listener) {
    _listeners.remove(listener);
  }

  void _handleFileSignal(String eventType, dynamic data) {
    if (eventType != 'file.signal' || data is! Map<String, dynamic>) return;
    for (final l in List.of(_listeners)) {
      try {
        l();
      } catch (_) {}
    }
  }

  void dispose() {
    wsService.removeListener(_handleFileSignal);
  }
}
