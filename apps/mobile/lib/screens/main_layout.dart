import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/dm_provider.dart';
import '../providers/group_provider.dart';
import '../providers/auth_provider.dart';
import 'chat/chat_screen.dart';
import 'dm/dm_list_screen.dart';
import 'settings/settings_screen.dart';
import 'groups/group_drawer.dart';
import 'voice/widgets/voice_mini_bar.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      final group = context.read<GroupProvider>();
      if (auth.identity != null && group.activeGroup != null) {
        group.setActiveGroup(group.activeGroup!, auth.identity);
      }
    });
  }

  void _openDrawer() {
    _scaffoldKey.currentState?.openDrawer();
  }

  @override
  Widget build(BuildContext context) {
    final dmProvider = context.watch<DmProvider>();
    final unreadDmCount = dmProvider.totalUnreadCount;

    final pages = [
      ChatScreen(onOpenDrawer: _openDrawer),
      const DmListScreen(),
      const SettingsScreen(),
    ];

    return Scaffold(
      key: _scaffoldKey,
      drawer: const GroupDrawer(),
      body: Column(
        children: [
          Expanded(
            child: IndexedStack(
              index: _currentIndex,
              children: pages,
            ),
          ),
          const VoiceMiniBar(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (idx) => setState(() => _currentIndex = idx),
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.chat_bubble_outline),
            activeIcon: Icon(Icons.chat_bubble),
            label: 'Sunucular',
          ),
          BottomNavigationBarItem(
            icon: Badge(
              isLabelVisible: unreadDmCount > 0,
              label: Text('$unreadDmCount'),
              child: const Icon(Icons.mail_outline),
            ),
            activeIcon: Badge(
              isLabelVisible: unreadDmCount > 0,
              label: Text('$unreadDmCount'),
              child: const Icon(Icons.mail),
            ),
            label: 'Mesajlar',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.settings_outlined),
            activeIcon: Icon(Icons.settings),
            label: 'Ayarlar',
          ),
        ],
      ),
    );
  }
}
