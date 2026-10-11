import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../../models/models.dart';
import 'markdown_content.dart';
import 'attachment_view.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final String myUserId;
  final void Function(Message) onReply;
  final void Function(Message) onEdit;
  final void Function(Message) onDelete;
  final void Function(Message, String emoji) onReact;

  const MessageBubble({
    super.key,
    required this.message,
    required this.myUserId,
    required this.onReply,
    required this.onEdit,
    required this.onDelete,
    required this.onReact,
  });

  Color _parseColor(String hex) {
    try {
      final clean = hex.replaceAll('#', '');
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return EchoColors.blurple;
    }
  }

  void _showContextMenu(BuildContext context) {
    final isMe = message.authorId == myUserId;

    showModalBottomSheet(
      context: context,
      backgroundColor: EchoColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Fast reaction bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: ['❤️', '👍', '😂', '🔥', '🎉', '👀'].map((emoji) {
                    return GestureDetector(
                      onTap: () {
                        Navigator.pop(ctx);
                        onReact(message, emoji);
                      },
                      child: Text(emoji, style: const TextStyle(fontSize: 26)),
                    );
                  }).toList(),
                ),
              ),
              const Divider(color: EchoColors.divider),
              ListTile(
                leading: const Icon(Icons.reply, color: EchoColors.textPrimary),
                title: const Text('Yanıtla', style: TextStyle(color: EchoColors.textPrimary)),
                onTap: () {
                  Navigator.pop(ctx);
                  onReply(message);
                },
              ),
              ListTile(
                leading: const Icon(Icons.copy, color: EchoColors.textPrimary),
                title: const Text('Metni Kopyala', style: TextStyle(color: EchoColors.textPrimary)),
                onTap: () {
                  Navigator.pop(ctx);
                  Clipboard.setData(ClipboardData(text: message.content));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Metin panoya kopyalandı')),
                  );
                },
              ),
              if (isMe) ...[
                ListTile(
                  leading: const Icon(Icons.edit, color: EchoColors.textPrimary),
                  title: const Text('Düzenle', style: TextStyle(color: EchoColors.textPrimary)),
                  onTap: () {
                    Navigator.pop(ctx);
                    onEdit(message);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.delete, color: EchoColors.red),
                  title: const Text('Sil', style: TextStyle(color: EchoColors.red)),
                  onTap: () {
                    Navigator.pop(ctx);
                    onDelete(message);
                  },
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (message.deleted) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Text(
          'Bu mesaj silindi.',
          style: TextStyle(fontStyle: FontStyle.italic, color: EchoColors.textMuted.withValues(alpha: 0.6), fontSize: 13),
        ),
      );
    }

    final timeStr = DateFormat('HH:mm').format(
      DateTime.fromMillisecondsSinceEpoch(message.createdAt),
    );

    return InkWell(
      onLongPress: () => _showContextMenu(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Reply Preview if any
            if (message.replyTo != null && message.replyToAuthorName != null)
              Container(
                margin: const EdgeInsets.only(bottom: 4, left: 36),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  border: Border(left: BorderSide(color: EchoColors.textMuted.withValues(alpha: 0.4), width: 2)),
                ),
                child: Row(
                  children: [
                    Text(
                      '@${message.replyToAuthorName}: ',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: EchoColors.blurple,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        message.replyToContent ?? '...',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: EchoColors.textMuted),
                      ),
                    ),
                  ],
                ),
              ),

            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar
                CircleAvatar(
                  radius: 18,
                  backgroundColor: _parseColor(message.authorColor),
                  child: Text(
                    message.authorName.isNotEmpty ? message.authorName[0].toUpperCase() : '?',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
                const SizedBox(width: 12),

                // Header & Body
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Author name + Time + Edited
                      Row(
                        children: [
                          Text(
                            message.authorName,
                            style: const TextStyle(
                              color: EchoColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            timeStr,
                            style: const TextStyle(color: EchoColors.textMuted, fontSize: 11),
                          ),
                          if (message.editedAt != null) ...[
                            const SizedBox(width: 4),
                            const Text(
                              '(düzenlendi)',
                              style: TextStyle(color: EchoColors.textMuted, fontSize: 10),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),

                      // Content
                      if (message.content.isNotEmpty)
                        MarkdownContent(content: message.content),

                      // Attachments
                      ...message.attachments.map((att) => AttachmentView(attachment: att)),

                      // Reactions
                      if (message.reactions.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: message.reactions.entries.map((entry) {
                            final emoji = entry.key;
                            final userIds = entry.value;
                            final hasReacted = userIds.contains(myUserId);

                            return GestureDetector(
                              onTap: () => onReact(message, emoji),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: hasReacted
                                      ? EchoColors.blurple.withValues(alpha: 0.25)
                                      : EchoColors.inputBackground,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: hasReacted ? EchoColors.blurple : Colors.transparent,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(emoji, style: const TextStyle(fontSize: 14)),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${userIds.length}',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: hasReacted ? EchoColors.blurple : EchoColors.textMuted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
