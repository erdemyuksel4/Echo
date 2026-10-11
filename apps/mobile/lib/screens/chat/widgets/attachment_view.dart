import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/constants.dart';
import '../../../core/theme.dart';
import '../../../models/models.dart';
import 'image_viewer_modal.dart';

class AttachmentView extends StatelessWidget {
  final Attachment attachment;

  const AttachmentView({super.key, required this.attachment});

  String get _resolveUrl {
    if (attachment.url != null && attachment.url!.isNotEmpty) {
      if (attachment.url!.startsWith('http')) return attachment.url!;
      return '${AppConstants.serverHttpUrl}${attachment.url}';
    }
    return '${AppConstants.serverHttpUrl}/internal/attachments/${attachment.id}';
  }

  @override
  Widget build(BuildContext context) {
    if (attachment.kind == 'image' || attachment.kind == 'gif' || attachment.kind == 'giphy') {
      final url = _resolveUrl;
      return Container(
        margin: const EdgeInsets.only(top: 6),
        constraints: const BoxConstraints(maxHeight: 240, maxWidth: 300),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ImageViewerModal(imageUrl: url, title: attachment.name),
                ),
              );
            },
            child: CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.cover,
              placeholder: (context, url) => Container(
                height: 150,
                width: 200,
                color: EchoColors.inputBackground,
                child: const Center(
                  child: CircularProgressIndicator(color: EchoColors.blurple, strokeWidth: 2),
                ),
              ),
              errorWidget: (context, url, err) => Container(
                padding: const EdgeInsets.all(12),
                color: EchoColors.inputBackground,
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.broken_image, color: EchoColors.red),
                    SizedBox(width: 8),
                    Text('Görsel yüklenemedi', style: TextStyle(color: EchoColors.textMuted)),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    // Generic file / P2P card
    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: EchoColors.inputBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EchoColors.divider),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.insert_drive_file, color: EchoColors.blurple, size: 28),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                attachment.name,
                style: const TextStyle(
                  color: EchoColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              Text(
                '${(attachment.size / 1024).toStringAsFixed(1)} KB',
                style: const TextStyle(color: EchoColors.textMuted, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(width: 12),
          IconButton(
            icon: const Icon(Icons.download, color: EchoColors.textPrimary, size: 20),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Dosya indirme başlatılıyor...')),
              );
            },
          ),
        ],
      ),
    );
  }
}
