import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../constants.dart';
import '../crypto/identity_service.dart';
import '../../models/models.dart';

typedef UserWsEventHandler = void Function(String eventType, dynamic data);

class UserWebSocketService {
  WebSocketChannel? _channel;
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  bool _isConnected = false;
  bool _isAuthenticated = false;
  bool _intentionalDisconnect = false;

  UserIdentity? _identity;
  final List<UserWsEventHandler> _listeners = [];
  final List<Map<String, dynamic>> _pendingQueue = [];

  bool get isConnected => _isConnected && _isAuthenticated;

  void addListener(UserWsEventHandler listener) {
    _listeners.add(listener);
  }

  void removeListener(UserWsEventHandler listener) {
    _listeners.remove(listener);
  }

  void _notifyListeners(String eventType, dynamic data) {
    for (final listener in List.of(_listeners)) {
      try {
        listener(eventType, data);
      } catch (e) {
        debugPrint('UserWS listener error for $eventType: $e');
      }
    }
  }

  Future<void> connect(UserIdentity identity) async {
    _identity = identity;
    _intentionalDisconnect = false;
    _disconnectSocket();
    await _establishConnection();
  }

  Future<void> _establishConnection() async {
    if (_identity == null) return;

    try {
      final wsUrl = Uri.parse('${AppConstants.serverWsUrl}/ws/user');
      _channel = WebSocketChannel.connect(wsUrl);
      _isConnected = true;

      _channel!.stream.listen(
        _onMessage,
        onDone: _onDisconnected,
        onError: (err) {
          debugPrint('UserWS error: $err');
          _onDisconnected();
        },
        cancelOnError: true,
      );

      await _authenticate();
      _startPingLoop();
    } catch (e) {
      debugPrint('UserWS connection failed: $e');
      _scheduleReconnect();
    }
  }

  Future<void> _authenticate() async {
    if (_identity == null) return;

    final ts = DateTime.now().millisecondsSinceEpoch;
    final sig = await IdentityService.signAuth(
      identity: _identity!,
      targetId: 'user',
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
      debugPrint('Failed to parse UserWS packet: $e');
    }
  }

  void _onDisconnected() {
    _isConnected = false;
    _isAuthenticated = false;
    _pingTimer?.cancel();

    if (!_intentionalDisconnect) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 4), () {
      if (!_intentionalDisconnect && _identity != null) {
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
        debugPrint('Failed to send raw UserWS packet: $e');
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
    _disconnectSocket();
  }

  // --- DM Actions ---

  void sendDm({
    required String toUserId,
    required String content,
    List<Attachment> attachments = const [],
  }) {
    send('dm.send', {
      'toUserId': toUserId,
      'content': content,
      'attachments': attachments.map((a) => a.toJson()).toList(),
    });
  }

  void fetchDmHistory({
    required String peerId,
    String? before,
    int limit = 50,
  }) {
    send('dm.history_fetch', {
      'peerId': peerId,
      'before': ?before,
      'limit': limit,
    });
  }

  void markDmRead(String peerId) {
    send('dm.read_mark', {'peerId': peerId});
  }
}
