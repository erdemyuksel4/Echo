import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../providers/dm_provider.dart';
import 'dm_chat_screen.dart';

class DmListScreen extends StatelessWidget {
  const DmListScreen({super.key});

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
    final dmProvider = context.watch<DmProvider>();
    final threads = dmProvider.threads;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Direkt Mesajlar'),
      ),
      body: threads.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: const BoxDecoration(
                      color: EchoColors.card,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.people_outline, size: 48, color: EchoColors.textMuted),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Henüz bir DM konuşman yok',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: EchoColors.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Bir sunucudaki üyelere dokunarak mesaj başlatabilirsin.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: EchoColors.textMuted, fontSize: 13),
                  ),
                ],
              ),
            )
          : ListView.builder(
              itemCount: threads.length,
              itemBuilder: (context, index) {
                final thread = threads[index];
                final timeStr = thread.lastMessageAt > 0
                    ? DateFormat('HH:mm').format(DateTime.fromMillisecondsSinceEpoch(thread.lastMessageAt))
                    : '';

                return ListTile(
                  leading: CircleAvatar(
                    radius: 22,
                    backgroundColor: _parseColor(thread.peerColor),
                    child: Text(
                      thread.peerName.isNotEmpty ? thread.peerName[0].toUpperCase() : '?',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ),
                  title: Text(
                    thread.peerName,
                    style: const TextStyle(fontWeight: FontWeight.bold, color: EchoColors.textPrimary),
                  ),
                  subtitle: Text(
                    thread.lastMessagePreview,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: thread.unreadCount > 0 ? EchoColors.textPrimary : EchoColors.textMuted,
                      fontWeight: thread.unreadCount > 0 ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(timeStr, style: const TextStyle(fontSize: 11, color: EchoColors.textMuted)),
                      if (thread.unreadCount > 0) ...[
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: const BoxDecoration(
                            color: EchoColors.red,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            '${thread.unreadCount}',
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ],
                  ),
                  onTap: () {
                    dmProvider.setActiveThread(thread);
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => DmChatScreen(thread: thread)),
                    );
                  },
                );
              },
            ),
    );
  }
}
