import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../network/websocket_service.dart';
import '../network/api_service.dart';
import '../../models/models.dart';

class WebRtcVoiceService {
  final WebSocketService wsService;

  MediaStream? _localStream;
  MediaStream? _cameraStream;
  bool _isMuted = false;
  bool _isDeafened = false;
  bool _isCameraActive = false;
  bool _useFrontCamera = true;
  bool _isSpeakerphoneOn = true;

  String? _currentChannelId;
  String? _myUserId;

  final Map<String, RTCPeerConnection> _peerConnections = {};
  final Map<String, MediaStream> _remoteAudioStreams = {};
  final Map<String, RTCVideoRenderer> _remoteCameraRenderers = {};
  RTCVideoRenderer? _localCameraRenderer;

  final Map<String, VoiceParticipant> _participants = {};
  final List<VoidCallback> _stateListeners = [];

  bool get isMuted => _isMuted;
  bool get isDeafened => _isDeafened;
  bool get isCameraActive => _isCameraActive;
  bool get isSpeakerphoneOn => _isSpeakerphoneOn;
  String? get currentChannelId => _currentChannelId;
  bool get isInVoiceChannel => _currentChannelId != null;

  Map<String, VoiceParticipant> get participants => Map.unmodifiable(_participants);
  Map<String, RTCVideoRenderer> get remoteCameraRenderers => Map.unmodifiable(_remoteCameraRenderers);
  RTCVideoRenderer? get localCameraRenderer => _localCameraRenderer;

  WebRtcVoiceService({required this.wsService}) {
    wsService.addListener(_handleWebSocketEvent);
  }

  void addListener(VoidCallback listener) {
    _stateListeners.add(listener);
  }

  void removeListener(VoidCallback listener) {
    _stateListeners.remove(listener);
  }

  void _notifyListeners() {
    for (final l in List.of(_stateListeners)) {
      try {
        l();
      } catch (_) {}
    }
  }

  Future<void> initRenderers() async {
    if (_localCameraRenderer == null) {
      _localCameraRenderer = RTCVideoRenderer();
      await _localCameraRenderer!.initialize();
    }
  }

  Future<void> joinVoiceChannel(String channelId, String userId, String displayName, String avatarColor) async {
    if (_currentChannelId == channelId) return;

    await leaveVoiceChannel();

    _currentChannelId = channelId;
    _myUserId = userId;

    _participants[userId] = VoiceParticipant(
      userId: userId,
      displayName: displayName,
      avatarColor: avatarColor,
      isMuted: _isMuted,
      isDeafened: _isDeafened,
      isCameraActive: _isCameraActive,
    );

    await _acquireLocalAudio();
    wsService.joinVoice(channelId);
    _notifyListeners();
  }

  Future<void> _acquireLocalAudio() async {
    try {
      final mediaConstraints = <String, dynamic>{
        'audio': {
          'echoCancellation': true,
          'noiseSuppression': true,
          'autoGainControl': true,
        },
        'video': false,
      };

      _localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      _updateAudioTrackState();
    } catch (e) {
      debugPrint('Error acquiring local audio: $e');
    }
  }

  void _updateAudioTrackState() {
    if (_localStream != null) {
      for (final track in _localStream!.getAudioTracks()) {
        track.enabled = !_isMuted && !_isDeafened;
      }
    }
  }

  Future<void> toggleMute() async {
    _isMuted = !_isMuted;
    _updateAudioTrackState();
    wsService.sendVoiceState(isMuted: _isMuted);

    if (_myUserId != null && _participants.containsKey(_myUserId)) {
      _participants[_myUserId!] = _participants[_myUserId!]!.copyWith(isMuted: _isMuted);
    }
    _notifyListeners();
  }

  Future<void> toggleDeafen() async {
    _isDeafened = !_isDeafened;
    _updateAudioTrackState();

    // Mute/unmute remote audio playback
    for (final stream in _remoteAudioStreams.values) {
      for (final track in stream.getAudioTracks()) {
        track.enabled = !_isDeafened;
      }
    }

    wsService.sendVoiceState(isDeafened: _isDeafened);
    if (_myUserId != null && _participants.containsKey(_myUserId)) {
      _participants[_myUserId!] = _participants[_myUserId!]!.copyWith(isDeafened: _isDeafened);
    }
    _notifyListeners();
  }

  Future<void> toggleSpeakerphone() async {
    _isSpeakerphoneOn = !_isSpeakerphoneOn;
    try {
      Helper.selectAudioOutput(_isSpeakerphoneOn ? 'speaker' : 'earpiece');
    } catch (_) {}
    _notifyListeners();
  }

  Future<void> toggleCamera({bool? enable}) async {
    final target = enable ?? !_isCameraActive;
    if (_isCameraActive == target) return;

    _isCameraActive = target;
    await initRenderers();

    if (_isCameraActive) {
      try {
        final videoConstraints = <String, dynamic>{
          'audio': false,
          'video': {
            'facingMode': _useFrontCamera ? 'user' : 'environment',
            'width': {'ideal': 640},
            'height': {'ideal': 480},
            'frameRate': {'max': 24},
          },
        };

        _cameraStream = await navigator.mediaDevices.getUserMedia(videoConstraints);
        _localCameraRenderer?.srcObject = _cameraStream;

        final videoTrack = _cameraStream!.getVideoTracks().first;
        for (final pc in _peerConnections.values) {
          pc.addTrack(videoTrack, _cameraStream!);
        }
      } catch (e) {
        debugPrint('Failed to open mobile camera: $e');
        _isCameraActive = false;
      }
    } else {
      if (_cameraStream != null) {
        for (final track in _cameraStream!.getVideoTracks()) {
          track.stop();
        }
        _localCameraRenderer?.srcObject = null;
        _cameraStream = null;
      }
    }

    wsService.sendVoiceState(camera: _isCameraActive);
    if (_myUserId != null && _participants.containsKey(_myUserId)) {
      _participants[_myUserId!] = _participants[_myUserId!]!.copyWith(isCameraActive: _isCameraActive);
    }
    _notifyListeners();
  }

  Future<void> switchCamera() async {
    if (!_isCameraActive || _cameraStream == null) return;
    _useFrontCamera = !_useFrontCamera;
    final videoTrack = _cameraStream!.getVideoTracks().first;
    await Helper.switchCamera(videoTrack);
    _notifyListeners();
  }

  Future<RTCPeerConnection> _createPeerConnectionFor(String targetUserId, bool isOfferer) async {
    final iceServers = await ApiService.fetchIceServers();
    final configuration = <String, dynamic>{
      'iceServers': iceServers,
      'sdpSemantics': 'unified-plan',
    };

    final pc = await createPeerConnection(configuration);

    if (_localStream != null) {
      for (final track in _localStream!.getAudioTracks()) {
        pc.addTrack(track, _localStream!);
      }
    }

    if (_cameraStream != null && _isCameraActive) {
      for (final track in _cameraStream!.getVideoTracks()) {
        pc.addTrack(track, _cameraStream!);
      }
    }

    pc.onIceCandidate = (candidate) {
      if (candidate.candidate != null) {
        wsService.sendVoiceSignal(
          targetUserId: targetUserId,
          signal: {
            'type': 'candidate',
            'candidate': candidate.toMap(),
          },
        );
      }
    };

    pc.onTrack = (event) async {
      final track = event.track;
      final stream = event.streams.isNotEmpty ? event.streams.first : null;

      if (track.kind == 'audio' && stream != null) {
        _remoteAudioStreams[targetUserId] = stream;
        track.enabled = !_isDeafened;
      } else if (track.kind == 'video') {
        final renderer = RTCVideoRenderer();
        await renderer.initialize();
        if (stream != null) {
          renderer.srcObject = stream;
        } else {
          final newStream = await createLocalMediaStream('remote_video_$targetUserId');
          newStream.addTrack(track);
          renderer.srcObject = newStream;
        }
        _remoteCameraRenderers[targetUserId] = renderer;
        _notifyListeners();
      }
    };

    pc.onConnectionState = (state) {
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
          state == RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
        _closePeer(targetUserId);
      }
    };

    _peerConnections[targetUserId] = pc;

    if (isOfferer) {
      final offer = await pc.createOffer({'offerToReceiveAudio': 1, 'offerToReceiveVideo': 1});
      await pc.setLocalDescription(offer);
      wsService.sendVoiceSignal(
        targetUserId: targetUserId,
        signal: {
          'type': 'offer',
          'sdp': offer.sdp,
        },
      );
    }

    return pc;
  }

  void _closePeer(String userId) {
    final pc = _peerConnections.remove(userId);
    pc?.close();
    _remoteAudioStreams.remove(userId);
    final renderer = _remoteCameraRenderers.remove(userId);
    renderer?.dispose();
    _notifyListeners();
  }

  void _handleWebSocketEvent(String eventType, dynamic data) {
    if (data is! Map<String, dynamic>) return;

    switch (eventType) {
      case 'voice.participants':
        final list = data['participants'] as List<dynamic>? ?? [];
        _participants.clear();
        for (final item in list) {
          final p = VoiceParticipant.fromJson(item as Map<String, dynamic>);
          _participants[p.userId] = p;
        }
        _notifyListeners();
        break;

      case 'voice.user_joined':
        final p = VoiceParticipant.fromJson(data);
        _participants[p.userId] = p;
        if (p.userId != _myUserId) {
          // When a new user joins, we send them an offer
          _createPeerConnectionFor(p.userId, true);
        }
        _notifyListeners();
        break;

      case 'voice.user_left':
        final userId = data['userId'] as String? ?? '';
        _participants.remove(userId);
        _closePeer(userId);
        _notifyListeners();
        break;

      case 'voice.state':
        final userId = data['userId'] as String? ?? '';
        if (_participants.containsKey(userId)) {
          final current = _participants[userId]!;
          _participants[userId] = current.copyWith(
            isMuted: data['isMuted'] as bool?,
            isDeafened: data['isDeafened'] as bool?,
            isSpeaking: data['isSpeaking'] as bool?,
            isCameraActive: data['camera'] as bool?,
          );
          _notifyListeners();
        }
        break;

      case 'voice.signal':
        final fromUserId = data['fromUserId'] as String? ?? '';
        final signal = data['signal'] as Map<String, dynamic>? ?? {};
        _handleSignal(fromUserId, signal);
        break;
    }
  }

  Future<void> _handleSignal(String fromUserId, Map<String, dynamic> signal) async {
    final type = signal['type'] as String?;

    if (type == 'offer') {
      final pc = await _createPeerConnectionFor(fromUserId, false);
      final sdp = signal['sdp'] as String;
      await pc.setRemoteDescription(RTCSessionDescription(sdp, 'offer'));
      final answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      wsService.sendVoiceSignal(
        targetUserId: fromUserId,
        signal: {
          'type': 'answer',
          'sdp': answer.sdp,
        },
      );
    } else if (type == 'answer') {
      final pc = _peerConnections[fromUserId];
      if (pc != null) {
        final sdp = signal['sdp'] as String;
        await pc.setRemoteDescription(RTCSessionDescription(sdp, 'answer'));
      }
    } else if (type == 'candidate') {
      final pc = _peerConnections[fromUserId];
      if (pc != null) {
        final c = signal['candidate'] as Map<String, dynamic>;
        await pc.addCandidate(
          RTCIceCandidate(
            c['candidate'] as String?,
            c['sdpMid'] as String?,
            c['sdpMLineIndex'] as int?,
          ),
        );
      }
    }
  }

  Future<void> leaveVoiceChannel() async {
    if (_currentChannelId == null) return;

    wsService.leaveVoice();

    for (final pc in _peerConnections.values) {
      pc.close();
    }
    _peerConnections.clear();
    _remoteAudioStreams.clear();

    for (final renderer in _remoteCameraRenderers.values) {
      renderer.dispose();
    }
    _remoteCameraRenderers.clear();

    if (_cameraStream != null) {
      for (final t in _cameraStream!.getVideoTracks()) {
        t.stop();
      }
      _cameraStream = null;
    }
    _localCameraRenderer?.srcObject = null;
    _isCameraActive = false;

    if (_localStream != null) {
      for (final t in _localStream!.getAudioTracks()) {
        t.stop();
      }
      _localStream = null;
    }

    _currentChannelId = null;
    _participants.clear();
    _notifyListeners();
  }

  void dispose() {
    leaveVoiceChannel();
    _localCameraRenderer?.dispose();
    wsService.removeListener(_handleWebSocketEvent);
  }
}
