import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../providers/group_provider.dart';
import '../../providers/chat_provider.dart';
import 'widgets/message_bubble.dart';
import 'widgets/giphy_sheet.dart';
import '../whiteboard/whiteboard_screen.dart';

class ChatScreen extends StatefulWidget {
  final VoidCallback onOpenDrawer;

  const ChatScreen({super.key, required this.onOpenDrawer});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  final _imagePicker = ImagePicker();

  Message? _replyingTo;
  Message? _editingMessage;
  final List<Attachment> _stagedAttachments = [];
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchCurrentChannelHistory();
    });
  }

  void _fetchCurrentChannelHistory() {
    final groupProvider = context.read<GroupProvider>();
    final channel = groupProvider.activeChannel;
    if (channel != null && channel.type == 'text') {
      context.read<ChatProvider>().fetchChannelHistory(channel.id);
    }
  }

  void _sendMessage() {
    final text = _inputController.text.trim();
    if (text.isEmpty && _stagedAttachments.isEmpty) return;

    final groupProvider = context.read<GroupProvider>();
    final chatProvider = context.read<ChatProvider>();
    final channel = groupProvider.activeChannel;
    if (channel == null) return;

    if (_editingMessage != null) {
      chatProvider.editMessage(
        messageId: _editingMessage!.id,
        channelId: channel.id,
        content: text,
      );
      setState(() => _editingMessage = null);
    } else {
      chatProvider.sendMessage(
        channelId: channel.id,
        content: text,
        attachments: List.of(_stagedAttachments),
        replyTo: _replyingTo?.id,
      );
      setState(() {
        _replyingTo = null;
        _stagedAttachments.clear();
      });
    }

    _inputController.clear();
  }

  void _pickAndUploadImage(ImageSource source) async {
    final groupProvider = context.read<GroupProvider>();
    final chatProvider = context.read<ChatProvider>();
    final messenger = ScaffoldMessenger.of(context);

    try {
      final picked = await _imagePicker.pickImage(source: source);
      if (picked == null) return;

      setState(() => _isUploading = true);

      final group = groupProvider.activeGroup;
      if (group == null) return;

      final rawBytes = await picked.readAsBytes();
      // Compress to WebP / resized image on mobile
      final decoded = img.decodeImage(rawBytes);
      if (decoded == null) return;

      final resized = img.copyResize(
        decoded,
        width: decoded.width > 1920 ? 1920 : decoded.width,
      );
      final compressedBytes = Uint8List.fromList(img.encodeJpg(resized, quality: 80));

      final attachment = await chatProvider.uploadImage(
            groupId: group.id,
            bytes: compressedBytes,
            fileName: picked.name,
          );

      if (mounted) {
        setState(() {
          _stagedAttachments.add(attachment);
        });
      }
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('Fotoğraf yüklenemedi: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _isUploading = false);
      }
    }
  }

  void _openGiphyPicker() async {
    final selectedAttachment = await showModalBottomSheet<Attachment>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const GiphySheet(),
    );

    if (selectedAttachment != null) {
      setState(() {
        _stagedAttachments.add(selectedAttachment);
      });
    }
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final groupProvider = context.watch<GroupProvider>();
    final chatProvider = context.watch<ChatProvider>();
    final authProvider = context.watch<AuthProvider>();

    final channel = groupProvider.activeChannel;
    final group = groupProvider.activeGroup;
    final myUserId = authProvider.identity?.userId ?? '';

    if (group == null || channel == null) {
      return Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.menu),
            onPressed: widget.onOpenDrawer,
          ),
          title: const Text('Echo'),
        ),
        body: const Center(
          child: Text(
            'Bir sunucu veya kanal seçin',
            style: TextStyle(color: EchoColors.textMuted),
          ),
        ),
      );
    }

    final messages = chatProvider.getMessagesForChannel(channel.id);
    final typingUsers = chatProvider.getTypingForChannel(channel.id);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu),
          onPressed: widget.onOpenDrawer,
        ),
        title: Row(
          children: [
            const Text('# ', style: TextStyle(color: EchoColors.textMuted, fontSize: 18, fontWeight: FontWeight.bold)),
            Text(channel.name),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.brush, color: EchoColors.textPrimary),
            tooltip: 'Beyaz Tahta',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const WhiteboardScreen()),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Message List
          Expanded(
            child: messages.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: const BoxDecoration(
                            color: EchoColors.card,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.chat_bubble_outline, size: 40, color: EchoColors.textMuted),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '#${channel.name} kanalına hoş geldin!',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: EchoColors.textPrimary),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Bu kanalın başlangıcı. İlk mesajı sen yaz!',
                          style: TextStyle(color: EchoColors.textMuted, fontSize: 13),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    reverse: true,
                    itemCount: messages.length,
                    itemBuilder: (context, index) {
                      final msg = messages[index];
                      return MessageBubble(
                        message: msg,
                        myUserId: myUserId,
                        onReply: (m) => setState(() => _replyingTo = m),
                        onEdit: (m) {
                          setState(() {
                            _editingMessage = m;
                            _inputController.text = m.content;
                          });
                        },
                        onDelete: (m) => chatProvider.deleteMessage(
                          messageId: m.id,
                          channelId: channel.id,
                        ),
                        onReact: (m, emoji) => chatProvider.toggleReaction(
                          messageId: m.id,
                          channelId: channel.id,
                          emoji: emoji,
                          myUserId: myUserId,
                        ),
                      );
                    },
                  ),
          ),

          // Typing Indicator
          if (typingUsers.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              alignment: Alignment.centerLeft,
              child: Text(
                '${typingUsers.join(", ")} yazıyor...',
                style: const TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  color: EchoColors.textMuted,
                ),
              ),
            ),

          // Reply / Edit Banner
          if (_replyingTo != null || _editingMessage != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              color: EchoColors.card,
              child: Row(
                children: [
                  Icon(
                    _editingMessage != null ? Icons.edit : Icons.reply,
                    size: 16,
                    color: EchoColors.blurple,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _editingMessage != null
                          ? 'Mesajı düzenliyorsun'
                          : '${_replyingTo!.authorName} yanıtlanıyor',
                      style: const TextStyle(fontSize: 12, color: EchoColors.textPrimary),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 16, color: EchoColors.textMuted),
                    onPressed: () {
                      setState(() {
                        _replyingTo = null;
                        _editingMessage = null;
                        _inputController.clear();
                      });
                    },
                  ),
                ],
              ),
            ),

          // Staged Attachments Tray
          if (_stagedAttachments.isNotEmpty)
            Container(
              height: 70,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              color: EchoColors.card,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _stagedAttachments.length,
                itemBuilder: (context, idx) {
                  return Stack(
                    children: [
                      Container(
                        width: 60,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          color: EchoColors.inputBackground,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: EchoColors.divider),
                        ),
                        child: const Center(
                          child: Icon(Icons.image, color: EchoColors.blurple),
                        ),
                      ),
                      Positioned(
                        top: 2,
                        right: 10,
                        child: GestureDetector(
                          onTap: () => setState(() => _stagedAttachments.removeAt(idx)),
                          child: Container(
                            decoration: const BoxDecoration(
                              color: Colors.black87,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close, size: 14, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),

          // Input Area
          SafeArea(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              color: EchoColors.card,
              child: Row(
                children: [
                  // Attachment (+) button
                  IconButton(
                    icon: _isUploading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(color: EchoColors.blurple, strokeWidth: 2),
                          )
                        : const Icon(Icons.add_circle, color: EchoColors.textMuted),
                    onPressed: _isUploading
                        ? null
                        : () {
                            showModalBottomSheet(
                              context: context,
                              backgroundColor: EchoColors.card,
                              builder: (ctx) => SafeArea(
                                child: Wrap(
                                  children: [
                                    ListTile(
                                      leading: const Icon(Icons.camera_alt, color: EchoColors.blurple),
                                      title: const Text('Kameradan Çek', style: TextStyle(color: EchoColors.textPrimary)),
                                      onTap: () {
                                        Navigator.pop(ctx);
                                        _pickAndUploadImage(ImageSource.camera);
                                      },
                                    ),
                                    ListTile(
                                      leading: const Icon(Icons.photo_library, color: EchoColors.green),
                                      title: const Text('Galeriden Seç', style: TextStyle(color: EchoColors.textPrimary)),
                                      onTap: () {
                                        Navigator.pop(ctx);
                                        _pickAndUploadImage(ImageSource.gallery);
                                      },
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                  ),

                  // GIF Button
                  IconButton(
                    icon: const Icon(Icons.gif_box_outlined, color: EchoColors.textMuted),
                    onPressed: _openGiphyPicker,
                  ),

                  // Text Field
                  Expanded(
                    child: TextField(
                      controller: _inputController,
                      style: const TextStyle(color: EchoColors.textPrimary, fontSize: 15),
                      decoration: InputDecoration(
                        hintText: '#${channel.name} kanalına mesaj gönder...',
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      ),
                      onChanged: (val) {
                        if (val.trim().isNotEmpty) {
                          chatProvider.sendTyping(channel.id);
                        }
                      },
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),

                  const SizedBox(width: 6),

                  // Send Button
                  IconButton(
                    icon: const Icon(Icons.send_rounded, color: EchoColors.blurple),
                    onPressed: _sendMessage,
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
