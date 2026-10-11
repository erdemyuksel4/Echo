import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../providers/dm_provider.dart';
import '../chat/widgets/markdown_content.dart';

class DmChatScreen extends StatefulWidget {
  final DmThread thread;

  const DmChatScreen({super.key, required this.thread});

  @override
  State<DmChatScreen> createState() => _DmChatScreenState();
}

class _DmChatScreenState extends State<DmChatScreen> {
  final _inputController = TextEditingController();

  void _send() {
    final text = _inputController.text.trim();
    if (text.isEmpty) return;

    context.read<DmProvider>().sendDm(
      toUserId: widget.thread.peerId,
      content: text,
    );

    _inputController.clear();
  }

  Color _parseColor(String hex) {
    try {
      final clean = hex.replaceAll('#', '');
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return EchoColors.blurple;
    }
  }

  @override
  void dispose() {
    _inputController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dmProvider = context.watch<DmProvider>();
    final authProvider = context.watch<AuthProvider>();
    final myUserId = authProvider.identity?.userId ?? '';

    final messages = dmProvider.getMessagesForPeer(widget.thread.peerId);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: _parseColor(widget.thread.peerColor),
              child: Text(
                widget.thread.peerName.isNotEmpty ? widget.thread.peerName[0].toUpperCase() : '?',
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 10),
            Text(widget.thread.peerName, style: const TextStyle(fontSize: 16)),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: messages.isEmpty
                ? Center(
                    child: Text(
                      '${widget.thread.peerName} ile henüz mesaj yok',
                      style: const TextStyle(color: EchoColors.textMuted),
                    ),
                  )
                : ListView.builder(
                    reverse: true,
                    itemCount: messages.length,
                    itemBuilder: (context, index) {
                      final msg = messages[index];
                      final isMe = msg.fromUserId == myUserId;
                      final timeStr = DateFormat('HH:mm').format(
                        DateTime.fromMillisecondsSinceEpoch(msg.createdAt),
                      );

                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        child: Row(
                          mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            if (!isMe)
                              CircleAvatar(
                                radius: 14,
                                backgroundColor: _parseColor(msg.fromColor),
                                child: Text(
                                  msg.fromName.isNotEmpty ? msg.fromName[0].toUpperCase() : '?',
                                  style: const TextStyle(fontSize: 12, color: Colors.white),
                                ),
                              ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: isMe ? EchoColors.blurple : EchoColors.card,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Column(
                                  crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                  children: [
                                    MarkdownContent(content: msg.content),
                                    const SizedBox(height: 4),
                                    Text(
                                      timeStr,
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: isMe ? Colors.white70 : EchoColors.textMuted,
                                      ),
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
          SafeArea(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              color: EchoColors.card,
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _inputController,
                      style: const TextStyle(color: EchoColors.textPrimary),
                      decoration: InputDecoration(
                        hintText: '${widget.thread.peerName}\'e mesaj gönder...',
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.send_rounded, color: EchoColors.blurple),
                    onPressed: _send,
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
