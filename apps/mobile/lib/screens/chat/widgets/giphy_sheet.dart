import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/network/api_service.dart';
import '../../../core/theme.dart';
import '../../../models/models.dart';

class GiphySheet extends StatefulWidget {
  const GiphySheet({super.key});

  @override
  State<GiphySheet> createState() => _GiphySheetState();
}

class _GiphySheetState extends State<GiphySheet> {
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _gifs = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _search('trending');
  }

  void _search(String query) async {
    setState(() => _isLoading = true);
    final results = await ApiService.searchGiphy(query);
    if (mounted) {
      setState(() {
        _gifs = results;
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.65,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: EchoColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: EchoColors.divider,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            style: const TextStyle(color: EchoColors.textPrimary),
            decoration: InputDecoration(
              hintText: 'GIPHY\'de ara...',
              prefixIcon: const Icon(Icons.search, color: EchoColors.textMuted),
              suffixIcon: IconButton(
                icon: const Icon(Icons.clear, size: 18, color: EchoColors.textMuted),
                onPressed: () {
                  _searchController.clear();
                  _search('trending');
                },
              ),
            ),
            onSubmitted: (val) {
              if (val.trim().isNotEmpty) {
                _search(val.trim());
              }
            },
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: EchoColors.blurple))
                : _gifs.isEmpty
                    ? const Center(
                        child: Text(
                          'GIF bulunamadı',
                          style: TextStyle(color: EchoColors.textMuted),
                        ),
                      )
                    : GridView.builder(
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                          childAspectRatio: 1.2,
                        ),
                        itemCount: _gifs.length,
                        itemBuilder: (context, index) {
                          final item = _gifs[index];
                          final url = item['url'] as String? ?? '';
                          final width = item['w'] as int? ?? 200;
                          final height = item['h'] as int? ?? 200;

                          return GestureDetector(
                            onTap: () {
                              final attachment = Attachment(
                                id: 'giphy_${DateTime.now().millisecondsSinceEpoch}',
                                kind: 'giphy',
                                name: 'giphy.gif',
                                mime: 'image/gif',
                                size: 0,
                                url: url,
                                width: width,
                                height: height,
                              );
                              Navigator.of(context).pop(attachment);
                            },
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: CachedNetworkImage(
                                imageUrl: url,
                                fit: BoxFit.cover,
                                placeholder: (context, url) => Container(
                                  color: EchoColors.inputBackground,
                                  child: const Center(
                                    child: CircularProgressIndicator(strokeWidth: 2, color: EchoColors.blurple),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
