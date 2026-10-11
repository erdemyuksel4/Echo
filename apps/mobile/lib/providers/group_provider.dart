import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/crypto/identity_service.dart';
import '../core/network/api_service.dart';
import '../core/network/websocket_service.dart';
import '../models/models.dart';

class GroupProvider extends ChangeNotifier {
  final WebSocketService wsService;

  List<Group> _groups = [];
  Group? _activeGroup;
  Channel? _activeChannel;
  bool _isLoading = false;
  String? _error;

  List<Group> get groups => _groups;
  Group? get activeGroup => _activeGroup;
  Channel? get activeChannel => _activeChannel;
  bool get isLoading => _isLoading;
  String? get error => _error;

  GroupProvider({required this.wsService}) {
    wsService.addListener(_handleWebSocketEvent);
    _loadSavedGroups();
  }

  Future<void> _loadSavedGroups() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = prefs.getString('saved_groups');
      if (str != null) {
        final list = jsonDecode(str) as List<dynamic>;
        _groups = list.map((g) => Group.fromJson(g as Map<String, dynamic>)).toList();
        if (_groups.isNotEmpty && _activeGroup == null) {
          _activeGroup = _groups.first;
          if (_activeGroup!.channels.isNotEmpty) {
            _activeChannel = _activeGroup!.channels.firstWhere(
              (c) => c.type == 'text',
              orElse: () => _activeGroup!.channels.first,
            );
          }
        }
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> _persistGroups() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = _groups.map((g) => {
        'id': g.id,
        'name': g.name,
        'ownerId': g.ownerId,
        'inviteCode': g.inviteCode,
        'channels': g.channels.map((c) => c.toJson()).toList(),
      }).toList();
      await prefs.setString('saved_groups', jsonEncode(list));
    } catch (_) {}
  }

  void setActiveGroup(Group group, UserIdentity? identity) {
    _activeGroup = group;
    if (group.channels.isNotEmpty) {
      _activeChannel = group.channels.firstWhere(
        (c) => c.type == 'text',
        orElse: () => group.channels.first,
      );
    } else {
      _activeChannel = null;
    }

    if (identity != null) {
      wsService.connect(group.id, identity);
    }
    notifyListeners();
  }

  void setActiveChannel(Channel channel) {
    _activeChannel = channel;
    notifyListeners();
  }

  Future<void> createGroup({
    required String name,
    required UserIdentity identity,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await ApiService.createGroup(name: name, identity: identity);
      final groupId = data['groupId'] as String;
      final inviteCode = data['inviteCode'] as String?;

      final newGroup = Group(
        id: groupId,
        name: name,
        ownerId: identity.userId,
        inviteCode: inviteCode,
        channels: [
          Channel(id: 'c_$groupId', name: 'genel', type: 'text'),
          Channel(id: 'v_$groupId', name: 'Genel Ses', type: 'voice'),
        ],
      );

      _groups.add(newGroup);
      await _persistGroups();
      setActiveGroup(newGroup, identity);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> joinGroup({
    required String inviteCode,
    required UserIdentity identity,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await ApiService.joinGroup(inviteCode: inviteCode, identity: identity);
      final snapshot = data['snapshot'] as Map<String, dynamic>;
      final grpJson = snapshot['group'] as Map<String, dynamic>;
      final channelsJson = snapshot['channels'] as List<dynamic>? ?? [];
      final membersJson = snapshot['members'] as List<dynamic>? ?? [];

      final joinedGroup = Group(
        id: grpJson['id'] as String,
        name: grpJson['name'] as String,
        ownerId: grpJson['ownerId'] as String? ?? '',
        inviteCode: inviteCode,
        channels: channelsJson.map((c) => Channel.fromJson(c as Map<String, dynamic>)).toList(),
        members: membersJson.map((m) => GroupMember.fromJson(m as Map<String, dynamic>)).toList(),
      );

      _groups.removeWhere((g) => g.id == joinedGroup.id);
      _groups.add(joinedGroup);
      await _persistGroups();
      setActiveGroup(joinedGroup, identity);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void _handleWebSocketEvent(String eventType, dynamic data) {
    if (data is! Map<String, dynamic>) return;

    if (eventType == 'snapshot') {
      final grpJson = data['group'] as Map<String, dynamic>?;
      if (grpJson == null) return;

      final groupId = grpJson['id'] as String;
      final channelsJson = data['channels'] as List<dynamic>? ?? [];
      final membersJson = data['members'] as List<dynamic>? ?? [];
      final inviteCode = data['inviteCode'] as String?;

      final channels = channelsJson.map((c) => Channel.fromJson(c as Map<String, dynamic>)).toList();
      final members = membersJson.map((m) => GroupMember.fromJson(m as Map<String, dynamic>)).toList();

      final updatedGroup = Group(
        id: groupId,
        name: grpJson['name'] as String,
        ownerId: grpJson['ownerId'] as String? ?? '',
        inviteCode: inviteCode,
        channels: channels,
        members: members,
      );

      final idx = _groups.indexWhere((g) => g.id == groupId);
      if (idx != -1) {
        _groups[idx] = updatedGroup;
      } else {
        _groups.add(updatedGroup);
      }

      if (_activeGroup?.id == groupId) {
        _activeGroup = updatedGroup;
        if (_activeChannel == null && channels.isNotEmpty) {
          _activeChannel = channels.firstWhere((c) => c.type == 'text', orElse: () => channels.first);
        }
      }

      _persistGroups();
      notifyListeners();
    }
  }

  @override
  void dispose() {
    wsService.removeListener(_handleWebSocketEvent);
    super.dispose();
  }
}
