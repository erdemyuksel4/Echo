import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/theme.dart';

class ImageViewerModal extends StatelessWidget {
  final String imageUrl;
  final String title;

  const ImageViewerModal({
    super.key,
    required this.imageUrl,
    this.title = 'Görsel',
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black.withValues(alpha: 0.6),
        title: Text(title, style: const TextStyle(fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
      body: Center(
        child: InteractiveViewer(
          minScale: 0.5,
          maxScale: 4.0,
          child: CachedNetworkImage(
            imageUrl: imageUrl,
            fit: BoxFit.contain,
            placeholder: (context, url) => const CircularProgressIndicator(color: EchoColors.blurple),
            errorWidget: (context, url, error) => const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.broken_image, size: 48, color: EchoColors.red),
                SizedBox(height: 8),
                Text('Görsel yüklenemedi', style: TextStyle(color: EchoColors.textMuted)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
