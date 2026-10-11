import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../network/websocket_service.dart';
import '../network/api_service.dart';

class ScreenShareService {
  final WebSocketService wsService;

  bool _isSharing = false;
  MediaStream? _localDisplayStream;
  String? _activePresenterUserId;
  RTCVideoRenderer? _remoteScreenRenderer;
  RTCPeerConnection? _screenPeerConnection;

  final List<VoidCallback> _listeners = [];

  bool get isSharing => _isSharing;
  String? get activePresenterUserId => _activePresenterUserId;
  RTCVideoRenderer? get remoteScreenRenderer => _remoteScreenRenderer;

  ScreenShareService({required this.wsService}) {
    wsService.addListener(_handleWebSocketEvent);
  }

  void addListener(VoidCallback listener) {
    _listeners.add(listener);
  }

  void removeListener(VoidCallback listener) {
    _listeners.remove(listener);
  }

  void _notifyListeners() {
    for (final l in List.of(_listeners)) {
      try {
        l();
      } catch (_) {}
    }
  }

  Future<void> initRenderer() async {
    if (_remoteScreenRenderer == null) {
      _remoteScreenRenderer = RTCVideoRenderer();
      await _remoteScreenRenderer!.initialize();
    }
  }

  Future<void> startScreenShare(String channelId) async {
    if (_isSharing) return;

    try {
      _localDisplayStream = await navigator.mediaDevices.getDisplayMedia({
        'video': true,
        'audio': false,
      });

      _isSharing = true;
      wsService.startScreenShare(channelId, '720p30');
      _notifyListeners();
    } catch (e) {
      debugPrint('Failed to start mobile screen share: $e');
      _isSharing = false;
    }
  }

  Future<void> stopScreenShare(String channelId) async {
    if (!_isSharing) return;

    if (_localDisplayStream != null) {
      for (final track in _localDisplayStream!.getTracks()) {
        track.stop();
      }
      _localDisplayStream = null;
    }

    _isSharing = false;
    wsService.stopScreenShare(channelId);
    _notifyListeners();
  }

  void _handleWebSocketEvent(String eventType, dynamic data) {
    if (data is! Map<String, dynamic>) return;

    switch (eventType) {
      case 'share.started':
        _activePresenterUserId = data['userId'] as String?;
        _notifyListeners();
        break;

      case 'share.stopped':
        if (_activePresenterUserId == data['userId']) {
          _activePresenterUserId = null;
          _screenPeerConnection?.close();
          _screenPeerConnection = null;
          _remoteScreenRenderer?.srcObject = null;
          _notifyListeners();
        }
        break;

      case 'share.signal':
        final fromUserId = data['fromUserId'] as String? ?? '';
        final signal = data['signal'] as Map<String, dynamic>? ?? {};
        _handleScreenSignal(fromUserId, signal);
        break;
    }
  }

  Future<void> _handleScreenSignal(String fromUserId, Map<String, dynamic> signal) async {
    final type = signal['type'] as String?;

    if (type == 'offer') {
      await initRenderer();
      final iceServers = await ApiService.fetchIceServers();
      _screenPeerConnection = await createPeerConnection({
        'iceServers': iceServers,
        'sdpSemantics': 'unified-plan',
      });

      _screenPeerConnection!.onTrack = (event) {
        if (event.track.kind == 'video') {
          _remoteScreenRenderer?.srcObject = event.streams.first;
          _notifyListeners();
        }
      };

      _screenPeerConnection!.onIceCandidate = (candidate) {
        if (candidate.candidate != null) {
          wsService.sendShareSignal(
            targetUserId: fromUserId,
            signal: {
              'type': 'candidate',
              'candidate': candidate.toMap(),
            },
          );
        }
      };

      final sdp = signal['sdp'] as String;
      await _screenPeerConnection!.setRemoteDescription(RTCSessionDescription(sdp, 'offer'));
      final answer = await _screenPeerConnection!.createAnswer();
      await _screenPeerConnection!.setLocalDescription(answer);

      wsService.sendShareSignal(
        targetUserId: fromUserId,
        signal: {
          'type': 'answer',
          'sdp': answer.sdp,
        },
      );
    } else if (type == 'answer') {
      if (_screenPeerConnection != null) {
        final sdp = signal['sdp'] as String;
        await _screenPeerConnection!.setRemoteDescription(RTCSessionDescription(sdp, 'answer'));
      }
    } else if (type == 'candidate') {
      if (_screenPeerConnection != null) {
        final c = signal['candidate'] as Map<String, dynamic>;
        await _screenPeerConnection!.addCandidate(
          RTCIceCandidate(
            c['candidate'] as String?,
            c['sdpMid'] as String?,
            c['sdpMLineIndex'] as int?,
          ),
        );
      }
    }
  }

  void dispose() {
    _screenPeerConnection?.close();
    _remoteScreenRenderer?.dispose();
    wsService.removeListener(_handleWebSocketEvent);
  }
}
