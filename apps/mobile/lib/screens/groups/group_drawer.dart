import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/group_provider.dart';
import '../../providers/voice_provider.dart';
import '../voice/voice_stage_screen.dart';

class GroupDrawer extends StatelessWidget {
  const GroupDrawer({super.key});

  void _showCreateOrJoinDialog(BuildContext context) {
    final nameController = TextEditingController();
    final inviteController = TextEditingController();
    int tabIndex = 0;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final groupProvider = context.watch<GroupProvider>();
          final authProvider = context.read<AuthProvider>();

          return AlertDialog(
            backgroundColor: EchoColors.card,
            title: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setDialogState(() => tabIndex = 0),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: tabIndex == 0 ? EchoColors.blurple : Colors.transparent,
                            width: 2,
                          ),
                        ),
                      ),
                      child: Text(
                        'Grup Kur',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: tabIndex == 0 ? EchoColors.textPrimary : EchoColors.textMuted,
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setDialogState(() => tabIndex = 1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: tabIndex == 1 ? EchoColors.blurple : Colors.transparent,
                            width: 2,
                          ),
                        ),
                      ),
                      child: Text(
                        'Davetle Katıl',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: tabIndex == 1 ? EchoColors.textPrimary : EchoColors.textMuted,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            content: tabIndex == 0
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Arkadaşlarınla konuşmak için yeni bir sunucu oluştur.',
                        style: TextStyle(fontSize: 13, color: EchoColors.textMuted),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: nameController,
                        style: const TextStyle(color: EchoColors.textPrimary),
                        decoration: const InputDecoration(hintText: 'Sunucu Adı'),
                      ),
                    ],
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Bir davet kodu gir (örn: ECHO-K7F2-9QXM)',
                        style: TextStyle(fontSize: 13, color: EchoColors.textMuted),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: inviteController,
                        style: const TextStyle(color: EchoColors.textPrimary),
                        decoration: const InputDecoration(hintText: 'Davet Kodu'),
                      ),
                    ],
                  ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('İptal', style: TextStyle(color: EchoColors.textMuted)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: EchoColors.blurple),
                onPressed: groupProvider.isLoading
                    ? null
                    : () async {
                        final identity = authProvider.identity;
                        if (identity == null) return;

                        if (tabIndex == 0) {
                          final name = nameController.text.trim();
                          if (name.isNotEmpty) {
                            await groupProvider.createGroup(name: name, identity: identity);
                            if (ctx.mounted) Navigator.pop(ctx);
                          }
                        } else {
                          final code = inviteController.text.trim();
                          if (code.isNotEmpty) {
                            await groupProvider.joinGroup(inviteCode: code, identity: identity);
                            if (ctx.mounted) Navigator.pop(ctx);
                          }
                        }
                      },
                child: groupProvider.isLoading
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(tabIndex == 0 ? 'Oluştur' : 'Katıl', style: const TextStyle(color: Colors.white)),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final groupProvider = context.watch<GroupProvider>();
    final authProvider = context.watch<AuthProvider>();
    final voiceProvider = context.watch<VoiceProvider>();

    final groups = groupProvider.groups;
    final activeGroup = groupProvider.activeGroup;
    final identity = authProvider.identity;

    return Drawer(
      backgroundColor: EchoColors.channelList,
      child: Row(
        children: [
          // Left Narrow Server Bar (Discord style)
          Container(
            width: 72,
            color: EchoColors.sidebar,
            child: SafeArea(
              child: Column(
                children: [
                  const SizedBox(height: 12),
                  // Echo Home Icon
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: EchoColors.blurple,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.graphic_eq_rounded, color: Colors.white, size: 28),
                  ),
                  const SizedBox(height: 8),
                  const Divider(color: EchoColors.divider, indent: 16, endIndent: 16),
                  const SizedBox(height: 8),

                  // Server Icons
                  Expanded(
                    child: ListView.builder(
                      itemCount: groups.length,
                      itemBuilder: (context, index) {
                        final g = groups[index];
                        final isSelected = activeGroup?.id == g.id;

                        return GestureDetector(
                          onTap: () {
                            groupProvider.setActiveGroup(g, identity);
                          },
                          child: Container(
                            margin: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              children: [
                                // Left indicator pill
                                Container(
                                  width: 4,
                                  height: isSelected ? 36 : 10,
                                  decoration: BoxDecoration(
                                    color: isSelected ? Colors.white : Colors.transparent,
                                    borderRadius: const BorderRadius.horizontal(right: Radius.circular(4)),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: isSelected ? EchoColors.blurple : EchoColors.inputBackground,
                                    borderRadius: BorderRadius.circular(isSelected ? 16 : 24),
                                  ),
                                  child: Center(
                                    child: Text(
                                      g.name.isNotEmpty ? g.name[0].toUpperCase() : 'G',
                                      style: TextStyle(
                                        color: isSelected ? Colors.white : EchoColors.textPrimary,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),

                  // Add Server (+) Button
                  IconButton(
                    icon: Container(
                      width: 48,
                      height: 48,
                      decoration: const BoxDecoration(
                        color: EchoColors.inputBackground,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.add, color: EchoColors.green),
                    ),
                    onPressed: () => _showCreateOrJoinDialog(context),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),

          // Right Channel List
          Expanded(
            child: activeGroup == null
                ? const Center(child: Text('Sunucu Seçin', style: TextStyle(color: EchoColors.textMuted)))
                : SafeArea(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Server Header
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: const BoxDecoration(
                            border: Border(bottom: BorderSide(color: EchoColors.divider)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  activeGroup.name,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: EchoColors.textPrimary),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (activeGroup.inviteCode != null)
                                IconButton(
                                  icon: const Icon(Icons.person_add, size: 20, color: EchoColors.blurple),
                                  tooltip: 'Davet Kodunu Kopyala',
                                  onPressed: () {
                                    Clipboard.setData(ClipboardData(text: activeGroup.inviteCode!));
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Davet kodu kopyalandı: ${activeGroup.inviteCode}')),
                                    );
                                  },
                                ),
                            ],
                          ),
                        ),

                        // Channel Sections
                        Expanded(
                          child: ListView(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            children: [
                              // Text Channels Section
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                                child: Text(
                                  'METİN KANALLARI',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                    color: EchoColors.textMuted,
                                  ),
                                ),
                              ),
                              ...activeGroup.channels.where((c) => c.type == 'text').map((c) {
                                final isSelected = groupProvider.activeChannel?.id == c.id;
                                return ListTile(
                                  dense: true,
                                  leading: const Text('#', style: TextStyle(color: EchoColors.textMuted, fontSize: 18, fontWeight: FontWeight.bold)),
                                  title: Text(
                                    c.name,
                                    style: TextStyle(
                                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                      color: isSelected ? Colors.white : EchoColors.textMuted,
                                    ),
                                  ),
                                  selected: isSelected,
                                  selectedTileColor: EchoColors.inputBackground,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  onTap: () {
                                    groupProvider.setActiveChannel(c);
                                    Navigator.pop(context); // Close drawer
                                  },
                                );
                              }),

                              const SizedBox(height: 12),

                              // Voice Channels Section
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                                child: Text(
                                  'SES KANALLARI',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                    color: EchoColors.textMuted,
                                  ),
                                ),
                              ),
                              ...activeGroup.channels.where((c) => c.type == 'voice').map((c) {
                                final isConnected = voiceProvider.isInVoiceChannel && voiceProvider.currentChannelId == c.id;
                                return ListTile(
                                  dense: true,
                                  leading: Icon(
                                    Icons.volume_up,
                                    size: 18,
                                    color: isConnected ? EchoColors.green : EchoColors.textMuted,
                                  ),
                                  title: Text(
                                    c.name,
                                    style: TextStyle(
                                      fontWeight: isConnected ? FontWeight.bold : FontWeight.normal,
                                      color: isConnected ? EchoColors.green : EchoColors.textMuted,
                                    ),
                                  ),
                                  onTap: () {
                                    if (identity != null) {
                                      voiceProvider.joinVoice(
                                        channelId: c.id,
                                        userId: identity.userId,
                                        displayName: identity.displayName,
                                        avatarColor: identity.avatarColor,
                                      );
                                      Navigator.pop(context); // Close drawer
                                      Navigator.of(context).push(
                                        MaterialPageRoute(builder: (_) => const VoiceStageScreen()),
                                      );
                                    }
                                  },
                                );
                              }),
                            ],
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
