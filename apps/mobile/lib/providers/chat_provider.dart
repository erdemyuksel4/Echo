import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/network/websocket_service.dart';
import '../core/network/api_service.dart';
import '../models/models.dart';

class ChatProvider extends ChangeNotifier {
  final WebSocketService wsService;

  final Map<String, List<Message>> _channelMessages = {};
  final Map<String, Set<String>> _typingUsers = {}; // channelId -> set of userNames
  Timer? _typingCleanupTimer;

  Map<String, List<Message>> get channelMessages => _channelMessages;
  Map<String, Set<String>> get typingUsers => _typingUsers;

  ChatProvider({required this.wsService}) {
    wsService.addListener(_handleWebSocketEvent);
    _startTypingCleanupLoop();
  }

  List<Message> getMessagesForChannel(String channelId) {
    return _channelMessages[channelId] ?? [];
  }

  Set<String> getTypingForChannel(String channelId) {
    return _typingUsers[channelId] ?? {};
  }

  void _startTypingCleanupLoop() {
    _typingCleanupTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (_typingUsers.isNotEmpty) {
        _typingUsers.clear();
        notifyListeners();
      }
    });
  }

  void fetchChannelHistory(String channelId) {
    wsService.fetchHistory(channelId: channelId);
  }

  void sendMessage({
    required String channelId,
    required String content,
    List<Attachment> attachments = const [],
    String? replyTo,
  }) {
    wsService.sendMessage(
      channelId: channelId,
      content: content,
      attachments: attachments,
      replyTo: replyTo,
    );
  }

  void editMessage({
    required String messageId,
    required String channelId,
    required String content,
  }) {
    wsService.editMessage(
      messageId: messageId,
      channelId: channelId,
      content: content,
    );
  }

  void deleteMessage({
    required String messageId,
    required String channelId,
  }) {
    wsService.deleteMessage(
      messageId: messageId,
      channelId: channelId,
    );
  }

  void toggleReaction({
    required String messageId,
    required String channelId,
    required String emoji,
    required String myUserId,
  }) {
    final msgs = _channelMessages[channelId] ?? [];
    final msg = msgs.firstWhere((m) => m.id == messageId, orElse: () => msgs.first);
    final users = msg.reactions[emoji] ?? [];
    final alreadyReacted = users.contains(myUserId);

    wsService.toggleReaction(
      messageId: messageId,
      channelId: channelId,
      emoji: emoji,
      add: !alreadyReacted,
    );
  }

  void sendTyping(String channelId) {
    wsService.sendTyping(channelId);
  }

  Future<Attachment> uploadImage({
    required String groupId,
    required Uint8List bytes,
    required String fileName,
  }) async {
    return ApiService.uploadAttachment(
      groupId: groupId,
      fileBytes: bytes,
      fileName: fileName,
      mimeType: 'image/webp',
    );
  }

  void _handleWebSocketEvent(String eventType, dynamic data) {
    if (data is! Map<String, dynamic>) return;

    switch (eventType) {
      case 'msg.new':
        final msg = Message.fromJson(data);
        final list = _channelMessages.putIfAbsent(msg.channelId, () => []);
        if (!list.any((m) => m.id == msg.id)) {
          list.insert(0, msg);
          notifyListeners();
        }
        break;

      case 'msg.updated':
        final messageId = data['id'] as String;
        final channelId = data['channelId'] as String;
        final content = data['content'] as String;
        final editedAt = data['editedAt'] as int?;

        final list = _channelMessages[channelId];
        if (list != null) {
          final idx = list.indexWhere((m) => m.id == messageId);
          if (idx != -1) {
            list[idx] = list[idx].copyWith(content: content, editedAt: editedAt);
            notifyListeners();
          }
        }
        break;

      case 'msg.deleted':
        final messageId = data['id'] as String;
        final channelId = data['channelId'] as String;
        final list = _channelMessages[channelId];
        if (list != null) {
          final idx = list.indexWhere((m) => m.id == messageId);
          if (idx != -1) {
            list[idx] = list[idx].copyWith(deleted: true, content: 'Bu mesaj silindi.');
            notifyListeners();
          }
        }
        break;

      case 'react.updated':
        final messageId = data['messageId'] as String;
        final channelId = data['channelId'] as String;
        final reactionsRaw = data['reactions'] as Map<String, dynamic>? ?? {};
        final parsed = <String, List<String>>{};
        reactionsRaw.forEach((k, v) {
          if (v is List) parsed[k] = v.map((e) => e.toString()).toList();
        });

        final list = _channelMessages[channelId];
        if (list != null) {
          final idx = list.indexWhere((m) => m.id == messageId);
          if (idx != -1) {
            list[idx] = list[idx].copyWith(reactions: parsed);
            notifyListeners();
          }
        }
        break;

      case 'history.data':
        final channelId = data['channelId'] as String? ?? '';
        final messagesRaw = data['messages'] as List<dynamic>? ?? [];
        final parsedMessages = messagesRaw
            .map((m) => Message.fromJson(m as Map<String, dynamic>))
            .toList();

        final currentList = _channelMessages.putIfAbsent(channelId, () => []);
        for (final msg in parsedMessages) {
          if (!currentList.any((m) => m.id == msg.id)) {
            currentList.add(msg);
          }
        }
        currentList.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        notifyListeners();
        break;

      case 'typing.user':
        final channelId = data['channelId'] as String? ?? '';
        final userName = data['userName'] as String? ?? 'Biri';
        _typingUsers.putIfAbsent(channelId, () => {}).add(userName);
        notifyListeners();
        break;
    }
  }

  @override
  void dispose() {
    _typingCleanupTimer?.cancel();
    wsService.removeListener(_handleWebSocketEvent);
    super.dispose();
  }
}
