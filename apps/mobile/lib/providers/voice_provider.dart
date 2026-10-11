import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../core/webrtc/webrtc_service.dart';
import '../models/models.dart';

class VoiceProvider extends ChangeNotifier {
  final WebRtcVoiceService voiceService;

  VoiceProvider({required this.voiceService}) {
    voiceService.addListener(_onVoiceServiceStateChanged);
  }

  bool get isInVoiceChannel => voiceService.isInVoiceChannel;
  String? get currentChannelId => voiceService.currentChannelId;
  bool get isMuted => voiceService.isMuted;
  bool get isDeafened => voiceService.isDeafened;
  bool get isCameraActive => voiceService.isCameraActive;
  bool get isSpeakerphoneOn => voiceService.isSpeakerphoneOn;

  Map<String, VoiceParticipant> get participants => voiceService.participants;
  Map<String, RTCVideoRenderer> get remoteCameraRenderers => voiceService.remoteCameraRenderers;
  RTCVideoRenderer? get localCameraRenderer => voiceService.localCameraRenderer;

  void _onVoiceServiceStateChanged() {
    notifyListeners();
  }

  Future<void> joinVoice({
    required String channelId,
    required String userId,
    required String displayName,
    required String avatarColor,
  }) async {
    await voiceService.joinVoiceChannel(channelId, userId, displayName, avatarColor);
  }

  Future<void> leaveVoice() async {
    await voiceService.leaveVoiceChannel();
  }

  Future<void> toggleMute() async {
    await voiceService.toggleMute();
  }

  Future<void> toggleDeafen() async {
    await voiceService.toggleDeafen();
  }

  Future<void> toggleSpeakerphone() async {
    await voiceService.toggleSpeakerphone();
  }

  Future<void> toggleCamera() async {
    await voiceService.toggleCamera();
  }

  Future<void> switchCamera() async {
    await voiceService.switchCamera();
  }

  @override
  void dispose() {
    voiceService.removeListener(_onVoiceServiceStateChanged);
    super.dispose();
  }
}
