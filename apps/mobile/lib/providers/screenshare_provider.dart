import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../core/webrtc/screenshare_service.dart';

class ScreenShareProvider extends ChangeNotifier {
  final ScreenShareService screenShareService;

  ScreenShareProvider({required this.screenShareService}) {
    screenShareService.addListener(_onServiceStateChanged);
  }

  bool get isSharing => screenShareService.isSharing;
  String? get activePresenterUserId => screenShareService.activePresenterUserId;
  RTCVideoRenderer? get remoteScreenRenderer => screenShareService.remoteScreenRenderer;

  void _onServiceStateChanged() {
    notifyListeners();
  }

  Future<void> startScreenShare(String channelId) async {
    await screenShareService.startScreenShare(channelId);
  }

  Future<void> stopScreenShare(String channelId) async {
    await screenShareService.stopScreenShare(channelId);
  }

  @override
  void dispose() {
    screenShareService.removeListener(_onServiceStateChanged);
    super.dispose();
  }
}
