class Channel {
  final String id;
  final String name;
  final String type; // 'text' | 'voice'
  final int position;

  Channel({
    required this.id,
    required this.name,
    required this.type,
    this.position = 0,
  });

  factory Channel.fromJson(Map<String, dynamic> json) => Channel(
        id: json['id'] as String,
        name: json['name'] as String,
        type: json['type'] as String? ?? 'text',
        position: json['position'] as int? ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'type': type,
        'position': position,
      };
}

class GroupMember {
  final String userId;
  final String displayName;
  final String avatarColor;
  final String role; // 'owner' | 'admin' | 'member'
  final bool online;

  GroupMember({
    required this.userId,
    required this.displayName,
    this.avatarColor = '#5865F2',
    this.role = 'member',
    this.online = false,
  });

  factory GroupMember.fromJson(Map<String, dynamic> json) => GroupMember(
        userId: json['userId'] as String,
        displayName: json['displayName'] as String,
        avatarColor: json['avatarColor'] as String? ?? '#5865F2',
        role: json['role'] as String? ?? 'member',
        online: json['online'] as bool? ?? false,
      );

  GroupMember copyWith({bool? online}) => GroupMember(
        userId: userId,
        displayName: displayName,
        avatarColor: avatarColor,
        role: role,
        online: online ?? this.online,
      );
}

class Attachment {
  final String id;
  final String kind; // 'image' | 'gif' | 'file' | 'giphy'
  final String name;
  final String mime;
  final int size;
  final String? url;
  final int? width;
  final int? height;

  Attachment({
    required this.id,
    required this.kind,
    required this.name,
    required this.mime,
    required this.size,
    this.url,
    this.width,
    this.height,
  });

  factory Attachment.fromJson(Map<String, dynamic> json) => Attachment(
        id: json['id'] as String,
        kind: json['kind'] as String? ?? 'image',
        name: json['name'] as String? ?? 'file',
        mime: json['mime'] as String? ?? 'application/octet-stream',
        size: json['size'] as int? ?? 0,
        url: json['url'] as String?,
        width: json['w'] as int? ?? json['width'] as int?,
        height: json['h'] as int? ?? json['height'] as int?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'kind': kind,
        'name': name,
        'mime': mime,
        'size': size,
        'url': url,
        if (width != null) 'w': width,
        if (height != null) 'h': height,
      };
}

class Message {
  final String id;
  final String channelId;
  final String authorId;
  final String authorName;
  final String authorColor;
  final String content;
  final String? replyTo;
  final String? replyToAuthorName;
  final String? replyToContent;
  final int createdAt;
  final int? editedAt;
  final bool deleted;
  final Map<String, List<String>> reactions; // emoji -> list of userIds
  final List<Attachment> attachments;

  Message({
    required this.id,
    required this.channelId,
    required this.authorId,
    required this.authorName,
    this.authorColor = '#5865F2',
    required this.content,
    this.replyTo,
    this.replyToAuthorName,
    this.replyToContent,
    required this.createdAt,
    this.editedAt,
    this.deleted = false,
    Map<String, List<String>>? reactions,
    List<Attachment>? attachments,
  })  : reactions = reactions ?? {},
        attachments = attachments ?? [];

  factory Message.fromJson(Map<String, dynamic> json) {
    final rawReactions = json['reactions'] as Map<String, dynamic>? ?? {};
    final parsedReactions = <String, List<String>>{};
    rawReactions.forEach((key, val) {
      if (val is List) {
        parsedReactions[key] = val.map((e) => e.toString()).toList();
      }
    });

    final rawAttachments = json['attachments'] as List<dynamic>? ?? [];
    final parsedAttachments = rawAttachments
        .map((e) => Attachment.fromJson(e as Map<String, dynamic>))
        .toList();

    return Message(
      id: json['id'] as String,
      channelId: json['channelId'] as String? ?? '',
      authorId: json['authorId'] as String,
      authorName: json['authorName'] as String? ?? 'Kullanıcı',
      authorColor: json['authorColor'] as String? ?? '#5865F2',
      content: json['content'] as String? ?? '',
      replyTo: json['replyTo'] as String?,
      replyToAuthorName: json['replyToAuthorName'] as String?,
      replyToContent: json['replyToContent'] as String?,
      createdAt: json['createdAt'] as int? ?? DateTime.now().millisecondsSinceEpoch,
      editedAt: json['editedAt'] as int?,
      deleted: json['deleted'] as bool? ?? false,
      reactions: parsedReactions,
      attachments: parsedAttachments,
    );
  }

  Message copyWith({
    String? content,
    int? editedAt,
    bool? deleted,
    Map<String, List<String>>? reactions,
  }) =>
      Message(
        id: id,
        channelId: channelId,
        authorId: authorId,
        authorName: authorName,
        authorColor: authorColor,
        content: content ?? this.content,
        replyTo: replyTo,
        replyToAuthorName: replyToAuthorName,
        replyToContent: replyToContent,
        createdAt: createdAt,
        editedAt: editedAt ?? this.editedAt,
        deleted: deleted ?? this.deleted,
        reactions: reactions ?? this.reactions,
        attachments: attachments,
      );
}

class Group {
  final String id;
  final String name;
  final String ownerId;
  final List<Channel> channels;
  final List<GroupMember> members;
  final String? inviteCode;

  Group({
    required this.id,
    required this.name,
    required this.ownerId,
    List<Channel>? channels,
    List<GroupMember>? members,
    this.inviteCode,
  })  : channels = channels ?? [],
        members = members ?? [];

  factory Group.fromJson(Map<String, dynamic> json) {
    final rawChannels = json['channels'] as List<dynamic>? ?? [];
    final rawMembers = json['members'] as List<dynamic>? ?? [];

    return Group(
      id: json['id'] as String,
      name: json['name'] as String,
      ownerId: json['ownerId'] as String? ?? '',
      inviteCode: json['inviteCode'] as String?,
      channels: rawChannels
          .map((c) => Channel.fromJson(c as Map<String, dynamic>))
          .toList(),
      members: rawMembers
          .map((m) => GroupMember.fromJson(m as Map<String, dynamic>))
          .toList(),
    );
  }
}

class VoiceParticipant {
  final String userId;
  final String displayName;
  final String avatarColor;
  final bool isMuted;
  final bool isDeafened;
  final bool isSpeaking;
  final bool isCameraActive;
  final bool isScreenSharing;

  VoiceParticipant({
    required this.userId,
    required this.displayName,
    this.avatarColor = '#5865F2',
    this.isMuted = false,
    this.isDeafened = false,
    this.isSpeaking = false,
    this.isCameraActive = false,
    this.isScreenSharing = false,
  });

  factory VoiceParticipant.fromJson(Map<String, dynamic> json) => VoiceParticipant(
        userId: json['userId'] as String,
        displayName: json['displayName'] as String? ?? 'Kullanıcı',
        avatarColor: json['avatarColor'] as String? ?? '#5865F2',
        isMuted: json['isMuted'] as bool? ?? false,
        isDeafened: json['isDeafened'] as bool? ?? false,
        isSpeaking: json['isSpeaking'] as bool? ?? false,
        isCameraActive: json['camera'] as bool? ?? false,
        isScreenSharing: json['isScreenSharing'] as bool? ?? false,
      );

  VoiceParticipant copyWith({
    bool? isMuted,
    bool? isDeafened,
    bool? isSpeaking,
    bool? isCameraActive,
    bool? isScreenSharing,
  }) =>
      VoiceParticipant(
        userId: userId,
        displayName: displayName,
        avatarColor: avatarColor,
        isMuted: isMuted ?? this.isMuted,
        isDeafened: isDeafened ?? this.isDeafened,
        isSpeaking: isSpeaking ?? this.isSpeaking,
        isCameraActive: isCameraActive ?? this.isCameraActive,
        isScreenSharing: isScreenSharing ?? this.isScreenSharing,
      );
}

class DmThread {
  final String peerId;
  final String peerName;
  final String peerColor;
  final int lastMessageAt;
  final String lastMessagePreview;
  final int unreadCount;

  DmThread({
    required this.peerId,
    required this.peerName,
    this.peerColor = '#5865F2',
    required this.lastMessageAt,
    required this.lastMessagePreview,
    this.unreadCount = 0,
  });

  factory DmThread.fromJson(Map<String, dynamic> json) => DmThread(
        peerId: json['peerId'] as String,
        peerName: json['peerName'] as String? ?? 'Kullanıcı',
        peerColor: json['peerColor'] as String? ?? '#5865F2',
        lastMessageAt: json['lastMessageAt'] as int? ?? 0,
        lastMessagePreview: json['lastMessagePreview'] as String? ?? '',
        unreadCount: json['unreadCount'] as int? ?? 0,
      );
}

class DmMessage {
  final String id;
  final String fromUserId;
  final String toUserId;
  final String fromName;
  final String fromColor;
  final String content;
  final int createdAt;
  final bool deleted;
  final List<Attachment> attachments;

  DmMessage({
    required this.id,
    required this.fromUserId,
    required this.toUserId,
    required this.fromName,
    this.fromColor = '#5865F2',
    required this.content,
    required this.createdAt,
    this.deleted = false,
    List<Attachment>? attachments,
  }) : attachments = attachments ?? [];

  factory DmMessage.fromJson(Map<String, dynamic> json) {
    final rawAttachments = json['attachments'] as List<dynamic>? ?? [];
    return DmMessage(
      id: json['id'] as String,
      fromUserId: json['fromUserId'] as String,
      toUserId: json['toUserId'] as String,
      fromName: json['fromName'] as String? ?? 'Kullanıcı',
      fromColor: json['fromColor'] as String? ?? '#5865F2',
      content: json['content'] as String? ?? '',
      createdAt: json['createdAt'] as int? ?? DateTime.now().millisecondsSinceEpoch,
      deleted: json['deleted'] as bool? ?? false,
      attachments: rawAttachments
          .map((e) => Attachment.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
