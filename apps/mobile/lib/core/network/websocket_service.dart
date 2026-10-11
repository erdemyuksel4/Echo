import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../constants.dart';
import '../crypto/identity_service.dart';
import '../../models/models.dart';

typedef WebSocketEventHandler = void Function(String eventType, dynamic data);

class WebSocketService {
  WebSocketChannel? _channel;
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  bool _isConnected = false;
  bool _isAuthenticated = false;
  bool _intentionalDisconnect = false;

  String? _activeGroupId;
  UserIdentity? _identity;

  final List<Map<String, dynamic>> _pendingQueue = [];
  final List<WebSocketEventHandler> _listeners = [];

  bool get isConnected => _isConnected && _isAuthenticated;
  String? get activeGroupId => _activeGroupId;

  void addListener(WebSocketEventHandler listener) {
    _listeners.add(listener);
  }

  void removeListener(WebSocketEventHandler listener) {
    _listeners.remove(listener);
  }

  void _notifyListeners(String eventType, dynamic data) {
    for (final listener in List.of(_listeners)) {
      try {
        listener(eventType, data);
      } catch (e) {
        debugPrint('WebSocket listener error for $eventType: $e');
      }
    }
  }

  Future<void> connect(String groupId, UserIdentity identity) async {
    if (_activeGroupId == groupId && _isConnected) return;

    _activeGroupId = groupId;
    _identity = identity;
    _intentionalDisconnect = false;

    _disconnectSocket();
    await _establishConnection();
  }

  Future<void> _establishConnection() async {
    if (_activeGroupId == null || _identity == null) return;

    try {
      final wsUrl = Uri.parse('${AppConstants.serverWsUrl}/ws/group/$_activeGroupId');
      _channel = WebSocketChannel.connect(wsUrl);
      _isConnected = true;

      _channel!.stream.listen(
        _onMessage,
        onDone: _onDisconnected,
        onError: (err) {
          debugPrint('WebSocket error: $err');
          _onDisconnected();
        },
        cancelOnError: true,
      );

      await _authenticate();
      _startPingLoop();
    } catch (e) {
      debugPrint('WebSocket connection attempt failed: $e');
      _scheduleReconnect();
    }
  }

  Future<void> _authenticate() async {
    if (_identity == null || _activeGroupId == null) return;

    final ts = DateTime.now().millisecondsSinceEpoch;
    final sig = await IdentityService.signAuth(
      identity: _identity!,
      targetId: _activeGroupId!,
      timestamp: ts,
    );

    final authPacket = {
      'v': 1,
      't': 'auth',
      'd': {
        'userId': _identity!.userId,
        'pubkey': _identity!.publicKeyHex,
        'ts': ts,
        'sig': sig,
        'displayName': _identity!.displayName,
        'avatarColor': _identity!.avatarColor,
      },
    };

    _sendRaw(authPacket);
  }

  void _onMessage(dynamic raw) {
    if (raw == 'pong') return;

    try {
      final map = jsonDecode(raw.toString()) as Map<String, dynamic>;
      final eventType = map['t'] as String? ?? '';
      final data = map['d'];

      if (eventType == 'auth.ok') {
        _isAuthenticated = true;
        _flushPendingQueue();
      }

      _notifyListeners(eventType, data);
    } catch (e) {
      debugPrint('Failed to parse WebSocket packet: $e');
    }
  }

  void _onDisconnected() {
    _isConnected = false;
    _isAuthenticated = false;
    _pingTimer?.cancel();

    _notifyListeners('connection.state', {'status': 'disconnected'});

    if (!_intentionalDisconnect) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      if (!_intentionalDisconnect && _activeGroupId != null) {
        debugPrint('Attempting to reconnect WebSocket...');
        _establishConnection();
      }
    });
  }

  void _startPingLoop() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (_isConnected) {
        try {
          _channel?.sink.add('ping');
        } catch (_) {}
      }
    });
  }

  void _sendRaw(Map<String, dynamic> packet) {
    if (_channel != null && _isConnected) {
      try {
        _channel!.sink.add(jsonEncode(packet));
      } catch (e) {
        debugPrint('Failed to send raw WS packet: $e');
      }
    }
  }

  void send(String eventType, dynamic payload) {
    final packet = {
      'v': 1,
      't': eventType,
      'd': payload,
    };

    if (!_isAuthenticated) {
      _pendingQueue.add(packet);
      return;
    }

    _sendRaw(packet);
  }

  void _flushPendingQueue() {
    while (_pendingQueue.isNotEmpty) {
      final packet = _pendingQueue.removeAt(0);
      _sendRaw(packet);
    }
  }

  void _disconnectSocket() {
    _pingTimer?.cancel();
    _reconnectTimer?.cancel();
    _isConnected = false;
    _isAuthenticated = false;
    try {
      _channel?.sink.close();
    } catch (_) {}
    _channel = null;
  }

  void disconnect() {
    _intentionalDisconnect = true;
    _activeGroupId = null;
    _disconnectSocket();
  }

  // --- Chat Actions ---

  void sendMessage({
    required String channelId,
    required String content,
    List<Attachment> attachments = const [],
    String? replyTo,
  }) {
    send('msg.send', {
      'channelId': channelId,
      'content': content,
      'attachments': attachments.map((a) => a.toJson()).toList(),
      'replyTo': ?replyTo,
    });
  }

  void editMessage({
    required String messageId,
    required String channelId,
    required String content,
  }) {
    send('msg.edit', {
      'messageId': messageId,
      'channelId': channelId,
      'content': content,
    });
  }

  void deleteMessage({
    required String messageId,
    required String channelId,
  }) {
    send('msg.delete', {
      'messageId': messageId,
      'channelId': channelId,
    });
  }

  void toggleReaction({
    required String messageId,
    required String channelId,
    required String emoji,
    required bool add,
  }) {
    send(add ? 'react.add' : 'react.remove', {
      'messageId': messageId,
      'channelId': channelId,
      'emoji': emoji,
    });
  }

  void sendTyping(String channelId) {
    send('typing', {'channelId': channelId});
  }

  void fetchHistory({
    required String channelId,
    String? before,
    int limit = 50,
  }) {
    send('history.fetch', {
      'channelId': channelId,
      'before': ?before,
      'limit': limit,
    });
  }

  // --- Voice Actions ---

  void joinVoice(String channelId) {
    send('voice.join', {'channelId': channelId});
  }

  void leaveVoice() {
    send('voice.leave', {});
  }

  void sendVoiceSignal({
    required String targetUserId,
    required dynamic signal,
  }) {
    send('voice.signal', {
      'targetUserId': targetUserId,
      'signal': signal,
    });
  }

  void sendVoiceState({
    bool? isMuted,
    bool? isDeafened,
    bool? isSpeaking,
    bool? camera,
  }) {
    final map = <String, dynamic>{};
    if (isMuted != null) map['isMuted'] = isMuted;
    if (isDeafened != null) map['isDeafened'] = isDeafened;
    if (isSpeaking != null) map['isSpeaking'] = isSpeaking;
    if (camera != null) map['camera'] = camera;
    send('voice.state', map);
  }

  // --- Screenshare Actions ---

  void startScreenShare(String channelId, String preset) {
    send('share.start', {
      'channelId': channelId,
      'preset': preset,
    });
  }

  void stopScreenShare(String channelId) {
    send('share.stop', {'channelId': channelId});
  }

  void sendShareSignal({
    required String targetUserId,
    required dynamic signal,
  }) {
    send('share.signal', {
      'targetUserId': targetUserId,
      'signal': signal,
    });
  }

  // --- P2P File Actions ---

  void sendFileSignal({
    required String targetUserId,
    required dynamic signal,
  }) {
    send('file.signal', {
      'targetUserId': targetUserId,
      'signal': signal,
    });
  }

  // --- Whiteboard Actions ---

  void sendWhiteboardDraw(dynamic drawData) {
    send('share.annotation_draw', drawData);
  }

  void sendWhiteboardClear() {
    send('share.annotation_clear', {});
  }
}
