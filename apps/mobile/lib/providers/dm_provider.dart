import 'package:flutter/foundation.dart';
import '../core/network/user_websocket_service.dart';
import '../models/models.dart';

class DmProvider extends ChangeNotifier {
  final UserWebSocketService userWsService;

  List<DmThread> _threads = [];
  DmThread? _activeThread;
  final Map<String, List<DmMessage>> _messages = {}; // peerId -> messages

  List<DmThread> get threads => _threads;
  DmThread? get activeThread => _activeThread;
  Map<String, List<DmMessage>> get messages => _messages;

  int get totalUnreadCount => _threads.fold(0, (acc, t) => acc + t.unreadCount);

  DmProvider({required this.userWsService}) {
    userWsService.addListener(_handleUserWsEvent);
  }

  List<DmMessage> getMessagesForPeer(String peerId) {
    return _messages[peerId] ?? [];
  }

  void setActiveThread(DmThread? thread) {
    _activeThread = thread;
    if (thread != null) {
      userWsService.fetchDmHistory(peerId: thread.peerId);
      userWsService.markDmRead(thread.peerId);

      final idx = _threads.indexWhere((t) => t.peerId == thread.peerId);
      if (idx != -1) {
        _threads[idx] = DmThread(
          peerId: thread.peerId,
          peerName: thread.peerName,
          peerColor: thread.peerColor,
          lastMessageAt: thread.lastMessageAt,
          lastMessagePreview: thread.lastMessagePreview,
          unreadCount: 0,
        );
      }
    }
    notifyListeners();
  }

  void sendDm({
    required String toUserId,
    required String content,
    List<Attachment> attachments = const [],
  }) {
    userWsService.sendDm(
      toUserId: toUserId,
      content: content,
      attachments: attachments,
    );
  }

  void _handleUserWsEvent(String eventType, dynamic data) {
    if (data is! Map<String, dynamic>) return;

    switch (eventType) {
      case 'dm.snapshot':
        final threadsRaw = data['threads'] as List<dynamic>? ?? [];
        _threads = threadsRaw
            .map((t) => DmThread.fromJson(t as Map<String, dynamic>))
            .toList();
        notifyListeners();
        break;

      case 'dm.new':
        final msg = DmMessage.fromJson(data);
        final otherId = msg.fromUserId == _activeThread?.peerId ? msg.fromUserId : msg.toUserId;
        final list = _messages.putIfAbsent(otherId, () => []);
        if (!list.any((m) => m.id == msg.id)) {
          list.insert(0, msg);
        }

        // Update thread
        final tIdx = _threads.indexWhere((t) => t.peerId == otherId);
        if (tIdx != -1) {
          final existing = _threads[tIdx];
          _threads[tIdx] = DmThread(
            peerId: existing.peerId,
            peerName: existing.peerName,
            peerColor: existing.peerColor,
            lastMessageAt: msg.createdAt,
            lastMessagePreview: msg.content,
            unreadCount: _activeThread?.peerId == otherId ? 0 : existing.unreadCount + 1,
          );
        }
        notifyListeners();
        break;

      case 'dm.history':
        final peerId = data['peerId'] as String? ?? '';
        final messagesRaw = data['messages'] as List<dynamic>? ?? [];
        final parsed = messagesRaw
            .map((m) => DmMessage.fromJson(m as Map<String, dynamic>))
            .toList();

        final currentList = _messages.putIfAbsent(peerId, () => []);
        for (final m in parsed) {
          if (!currentList.any((x) => x.id == m.id)) {
            currentList.add(m);
          }
        }
        currentList.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        notifyListeners();
        break;
    }
  }

  @override
  void dispose() {
    userWsService.removeListener(_handleUserWsEvent);
    super.dispose();
  }
}
