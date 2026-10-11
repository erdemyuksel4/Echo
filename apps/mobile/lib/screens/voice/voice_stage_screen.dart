import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../providers/voice_provider.dart';
import '../../providers/screenshare_provider.dart';
import '../../providers/group_provider.dart';
import '../../providers/auth_provider.dart';

class VoiceStageScreen extends StatelessWidget {
  const VoiceStageScreen({super.key});

  Color _parseColor(String hex) {
    try {
      final clean = hex.replaceAll('#', '');
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return EchoColors.blurple;
    }
  }

  @override
  Widget build(BuildContext context) {
    final voiceProvider = context.watch<VoiceProvider>();
    final screenShareProvider = context.watch<ScreenShareProvider>();
    final groupProvider = context.watch<GroupProvider>();
    final authProvider = context.watch<AuthProvider>();

    final myUserId = authProvider.identity?.userId ?? '';
    final channel = groupProvider.activeChannel;
    final participants = voiceProvider.participants.values.toList();

    return Scaffold(
      backgroundColor: EchoColors.sidebar,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(channel?.name ?? 'Sesli Kanal', style: const TextStyle(fontSize: 16)),
            Text(
              '${participants.length} Katılımcı',
              style: const TextStyle(fontSize: 12, color: EchoColors.green),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Screen Share Viewer if someone is sharing
          if (screenShareProvider.activePresenterUserId != null &&
              screenShareProvider.remoteScreenRenderer != null)
            Container(
              height: 220,
              margin: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: EchoColors.blurple, width: 2),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: RTCVideoView(
                  screenShareProvider.remoteScreenRenderer!,
                  objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain,
                ),
              ),
            ),

          // Participants Video / Avatar Grid
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: GridView.builder(
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: participants.length <= 2 ? 1 : 2,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: participants.length <= 2 ? 1.4 : 1.0,
                ),
                itemCount: participants.length,
                itemBuilder: (context, index) {
                  final p = participants[index];
                  final isMe = p.userId == myUserId;

                  RTCVideoRenderer? renderer;
                  if (p.isCameraActive) {
                    renderer = isMe
                        ? voiceProvider.localCameraRenderer
                        : voiceProvider.remoteCameraRenderers[p.userId];
                  }

                  return Container(
                    decoration: BoxDecoration(
                      color: EchoColors.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: p.isSpeaking ? EchoColors.green : EchoColors.divider,
                        width: p.isSpeaking ? 3 : 1,
                      ),
                    ),
                    child: Stack(
                      children: [
                        // Camera video or avatar
                        if (p.isCameraActive && renderer != null && renderer.textureId != null)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: RTCVideoView(
                              renderer,
                              objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                              mirror: isMe,
                            ),
                          )
                        else
                          Center(
                            child: Container(
                              width: 70,
                              height: 70,
                              decoration: BoxDecoration(
                                color: _parseColor(p.avatarColor),
                                shape: BoxShape.circle,
                                boxShadow: p.isSpeaking
                                    ? [
                                        BoxShadow(
                                          color: EchoColors.green.withValues(alpha: 0.6),
                                          blurRadius: 18,
                                          spreadRadius: 4,
                                        ),
                                      ]
                                    : null,
                              ),
                              child: Center(
                                child: Text(
                                  p.displayName.isNotEmpty ? p.displayName[0].toUpperCase() : '?',
                                  style: const TextStyle(
                                    fontSize: 30,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ),

                        // Name label & status badge
                        Positioned(
                          bottom: 8,
                          left: 8,
                          right: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    isMe ? '${p.displayName} (Sen)' : p.displayName,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                                if (p.isMuted)
                                  const Padding(
                                    padding: EdgeInsets.only(left: 4),
                                    child: Icon(Icons.mic_off, size: 14, color: EchoColors.red),
                                  ),
                                if (p.isDeafened)
                                  const Padding(
                                    padding: EdgeInsets.only(left: 4),
                                    child: Icon(Icons.headset_off, size: 14, color: EchoColors.red),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),

          // Bottom Action Toolbar (Mute, Deafen, Speaker, Camera, Screen, Leave)
          SafeArea(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              color: EchoColors.channelList,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  // Mute Button
                  IconButton(
                    icon: Icon(
                      voiceProvider.isMuted ? Icons.mic_off : Icons.mic,
                      color: voiceProvider.isMuted ? EchoColors.red : EchoColors.textPrimary,
                    ),
                    onPressed: () => voiceProvider.toggleMute(),
                  ),

                  // Deafen Button
                  IconButton(
                    icon: Icon(
                      voiceProvider.isDeafened ? Icons.headset_off : Icons.headset,
                      color: voiceProvider.isDeafened ? EchoColors.red : EchoColors.textPrimary,
                    ),
                    onPressed: () => voiceProvider.toggleDeafen(),
                  ),

                  // Speakerphone Button
                  IconButton(
                    icon: Icon(
                      voiceProvider.isSpeakerphoneOn ? Icons.volume_up : Icons.phone_in_talk,
                      color: voiceProvider.isSpeakerphoneOn ? EchoColors.green : EchoColors.textMuted,
                    ),
                    onPressed: () => voiceProvider.toggleSpeakerphone(),
                  ),

                  // Camera Toggle Button
                  IconButton(
                    icon: Icon(
                      voiceProvider.isCameraActive ? Icons.videocam : Icons.videocam_off,
                      color: voiceProvider.isCameraActive ? EchoColors.green : EchoColors.textPrimary,
                    ),
                    onPressed: () => voiceProvider.toggleCamera(),
                  ),

                  // Switch Front/Back Camera
                  if (voiceProvider.isCameraActive)
                    IconButton(
                      icon: const Icon(Icons.flip_camera_ios, color: EchoColors.textPrimary),
                      onPressed: () => voiceProvider.switchCamera(),
                    ),

                  // Leave Channel Button (Red)
                  GestureDetector(
                    onTap: () {
                      voiceProvider.leaveVoice();
                      Navigator.of(context).pop();
                    },
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: const BoxDecoration(
                        color: EchoColors.red,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.call_end, color: Colors.white, size: 24),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
