import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../constants.dart';
import '../crypto/identity_service.dart';
import '../../models/models.dart';

class ApiService {
  static Future<Map<String, dynamic>> createGroup({
    required String name,
    required UserIdentity identity,
  }) async {
    final ts = DateTime.now().millisecondsSinceEpoch;
    final payload = 'echo-create-group|${name.trim()}|$ts';
    final sig = await IdentityService.signPayload(
      identity: identity,
      payload: payload,
    );

    final url = Uri.parse('${AppConstants.serverHttpUrl}/api/groups');
    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'name': name.trim(),
        'displayName': identity.displayName,
        'pubkey': identity.publicKeyHex,
        'ownerDisplayName': identity.displayName,
        'ownerPubkey': identity.publicKeyHex,
        'ts': ts,
        'sig': sig,
      }),
    );

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw Exception(data['error'] ?? 'Grup oluşturulamadı');
    }
    return data;
  }

  static Future<Map<String, dynamic>> joinGroup({
    required String inviteCode,
    required UserIdentity identity,
  }) async {
    final cleanCode = inviteCode.trim();
    final ts = DateTime.now().millisecondsSinceEpoch;
    final payload = 'echo-join-group|$cleanCode|$ts';
    final sig = await IdentityService.signPayload(
      identity: identity,
      payload: payload,
    );

    final url = Uri.parse('${AppConstants.serverHttpUrl}/api/groups/join');
    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'inviteCode': cleanCode,
        'displayName': identity.displayName,
        'pubkey': identity.publicKeyHex,
        'ts': ts,
        'sig': sig,
      }),
    );

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw Exception(data['error'] ?? 'Gruba katılınamadı');
    }
    return data;
  }

  static Future<List<Map<String, dynamic>>> fetchUserGroups(String userId) async {
    try {
      final url = Uri.parse('${AppConstants.serverHttpUrl}/api/users/$userId/groups');
      final response = await http.get(url);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final list = data['groups'] as List<dynamic>? ?? [];
        return list.map((e) => e as Map<String, dynamic>).toList();
      }
    } catch (_) {}
    return [];
  }

  static Future<List<Map<String, dynamic>>> fetchIceServers() async {
    try {
      final url = Uri.parse('${AppConstants.serverHttpUrl}/api/turn');
      final response = await http.get(url);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final servers = data['iceServers'] as List<dynamic>?;
        if (servers != null && servers.isNotEmpty) {
          return servers.map((e) => e as Map<String, dynamic>).toList();
        }
      }
    } catch (_) {}
    return AppConstants.defaultIceServers;
  }

  static Future<List<Map<String, dynamic>>> searchGiphy(String query) async {
    try {
      final url = Uri.parse('${AppConstants.serverHttpUrl}/api/giphy/search?q=${Uri.encodeComponent(query)}');
      final response = await http.get(url);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final list = data['data'] as List<dynamic>? ?? [];
        return list.map((e) => e as Map<String, dynamic>).toList();
      }
    } catch (_) {}
    return [];
  }

  static Future<Attachment> uploadAttachment({
    required String groupId,
    required Uint8List fileBytes,
    required String fileName,
    required String mimeType,
    int? width,
    int? height,
  }) async {
    final url = Uri.parse('${AppConstants.serverHttpUrl}/api/groups/$groupId/attachments');
    final request = http.MultipartRequest('POST', url);
    request.fields['name'] = fileName;
    request.fields['mime'] = mimeType;
    if (width != null) request.fields['w'] = width.toString();
    if (height != null) request.fields['h'] = height.toString();

    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        fileBytes,
        filename: fileName,
      ),
    );

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode >= 400) {
      throw Exception(data['error'] ?? 'Ek yüklenemedi');
    }

    return Attachment.fromJson(data);
  }
}
