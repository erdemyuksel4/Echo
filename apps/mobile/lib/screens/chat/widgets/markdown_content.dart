import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import '../../../core/theme.dart';

class MarkdownContent extends StatefulWidget {
  final String content;

  const MarkdownContent({super.key, required this.content});

  @override
  State<MarkdownContent> createState() => _MarkdownContentState();
}

class _MarkdownContentState extends State<MarkdownContent> {
  final Set<int> _revealedSpoilers = {};

  @override
  Widget build(BuildContext context) {
    // Process spoiler tags: ||text||
    final parts = _parseSpoilers(widget.content);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          children: parts.map((part) {
            if (part.isSpoiler) {
              final isRevealed = _revealedSpoilers.contains(part.id);
              return GestureDetector(
                onTap: () {
                  setState(() {
                    if (isRevealed) {
                      _revealedSpoilers.remove(part.id);
                    } else {
                      _revealedSpoilers.add(part.id);
                    }
                  });
                },
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isRevealed ? EchoColors.inputBackground : Colors.black,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    isRevealed ? part.text : 'SPOILER',
                    style: TextStyle(
                      fontSize: 14,
                      color: isRevealed ? EchoColors.textPrimary : EchoColors.textMuted,
                      fontWeight: isRevealed ? FontWeight.normal : FontWeight.bold,
                    ),
                  ),
                ),
              );
            }

            return MarkdownBody(
              data: part.text,
              selectable: true,
              styleSheet: MarkdownStyleSheet(
                p: const TextStyle(
                  color: EchoColors.textPrimary,
                  fontSize: 15,
                  height: 1.3,
                ),
                strong: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                em: const TextStyle(fontStyle: FontStyle.italic),
                code: TextStyle(
                  color: EchoColors.textPrimary,
                  backgroundColor: EchoColors.inputBackground,
                  fontFamily: 'monospace',
                  fontSize: 13,
                ),
                codeblockDecoration: BoxDecoration(
                  color: EchoColors.sidebar,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  List<_TextPart> _parseSpoilers(String text) {
    final List<_TextPart> result = [];
    final regex = RegExp(r'\|\|(.*?)\|\|');
    int lastIndex = 0;
    int spoilerCount = 0;

    for (final match in regex.allMatches(text)) {
      if (match.start > lastIndex) {
        result.add(_TextPart(
          id: -1,
          text: text.substring(lastIndex, match.start),
          isSpoiler: false,
        ));
      }

      final spoilerText = match.group(1) ?? '';
      result.add(_TextPart(
        id: spoilerCount++,
        text: spoilerText,
        isSpoiler: true,
      ));

      lastIndex = match.end;
    }

    if (lastIndex < text.length) {
      result.add(_TextPart(
        id: -1,
        text: text.substring(lastIndex),
        isSpoiler: false,
      ));
    }

    if (result.isEmpty) {
      result.add(_TextPart(id: -1, text: text, isSpoiler: false));
    }

    return result;
  }
}

class _TextPart {
  final int id;
  final String text;
  final bool isSpoiler;

  _TextPart({required this.id, required this.text, required this.isSpoiler});
}
