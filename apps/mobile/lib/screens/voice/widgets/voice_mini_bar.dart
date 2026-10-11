import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme.dart';
import '../../../providers/voice_provider.dart';
import '../../../providers/group_provider.dart';
import '../voice_stage_screen.dart';

class VoiceMiniBar extends StatelessWidget {
  const VoiceMiniBar({super.key});

  @override
  Widget build(BuildContext context) {
    final voiceProvider = context.watch<VoiceProvider>();
    final groupProvider = context.watch<GroupProvider>();

    if (!voiceProvider.isInVoiceChannel) return const SizedBox.shrink();

    final channel = groupProvider.activeGroup?.channels.firstWhere(
      (c) => c.id == voiceProvider.currentChannelId,
      orElse: () => groupProvider.activeChannel!,
    );

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const VoiceStageScreen()),
        );
      },
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: EchoColors.channelList,
          border: Border(
            top: BorderSide(color: EchoColors.green.withValues(alpha: 0.6), width: 2),
          ),
        ),
        child: Row(
          children: [
            const Icon(Icons.volume_up, color: EchoColors.green, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    channel?.name ?? 'Sesli Sohbet',
                    style: const TextStyle(
                      color: EchoColors.textPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const Text(
                    'RTC Bağlandı • Dokun ve sahneyi aç',
                    style: TextStyle(color: EchoColors.green, fontSize: 11),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: Icon(
                voiceProvider.isMuted ? Icons.mic_off : Icons.mic,
                color: voiceProvider.isMuted ? EchoColors.red : EchoColors.textPrimary,
                size: 20,
              ),
              onPressed: () => voiceProvider.toggleMute(),
            ),
            IconButton(
              icon: Icon(
                voiceProvider.isDeafened ? Icons.headset_off : Icons.headset,
                color: voiceProvider.isDeafened ? EchoColors.red : EchoColors.textPrimary,
                size: 20,
              ),
              onPressed: () => voiceProvider.toggleDeafen(),
            ),
            IconButton(
              icon: const Icon(Icons.call_end, color: EchoColors.red, size: 20),
              onPressed: () => voiceProvider.leaveVoice(),
            ),
          ],
        ),
      ),
    );
  }
}
