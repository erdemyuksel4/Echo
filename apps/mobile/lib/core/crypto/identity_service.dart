import 'dart:convert';
import 'dart:typed_data';
import 'package:crypto/crypto.dart' as crypto;
import 'package:cryptography/cryptography.dart' as crypt;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const String _base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567';

String bytesToBase32(List<int> bytes) {
  int bits = 0;
  int value = 0;
  final StringBuffer output = StringBuffer();

  for (int i = 0; i < bytes.length; i++) {
    final byte = bytes[i];
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output.write(_base32Alphabet[(value >>> (bits - 5)) & 31]);
      bits -= 5;
    }
  }

  if (bits > 0) {
    output.write(_base32Alphabet[(value << (5 - bits)) & 31]);
  }

  return output.toString();
}

String bytesToHex(List<int> bytes) {
  return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}

Uint8List hexToBytes(String hex) {
  final length = hex.length;
  if (length % 2 != 0) {
    throw FormatException('Invalid hex string length');
  }
  final result = Uint8List(length ~/ 2);
  for (int i = 0; i < length; i += 2) {
    result[i ~/ 2] = int.parse(hex.substring(i, i + 2), radix: 16);
  }
  return result;
}

class UserIdentity {
  final String userId;
  final String displayName;
  final String avatarColor;
  final String publicKeyHex;
  final String privateKeyHex;

  UserIdentity({
    required this.userId,
    required this.displayName,
    required this.avatarColor,
    required this.publicKeyHex,
    required this.privateKeyHex,
  });

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'displayName': displayName,
        'avatarColor': avatarColor,
        'publicKeyHex': publicKeyHex,
        'privateKeyHex': privateKeyHex,
      };

  factory UserIdentity.fromJson(Map<String, dynamic> json) => UserIdentity(
        userId: json['userId'] as String,
        displayName: json['displayName'] as String,
        avatarColor: json['avatarColor'] as String? ?? '#5865F2',
        publicKeyHex: json['publicKeyHex'] as String,
        privateKeyHex: json['privateKeyHex'] as String,
      );
}

class IdentityService {
  static const _storage = FlutterSecureStorage();
  static const _keyIdentity = 'echo_user_identity';
  static final _algorithm = crypt.Ed25519();

  static String deriveUserId(List<int> publicKeyBytes) {
    final digest = crypto.sha256.convert(publicKeyBytes);
    final first16 = digest.bytes.sublist(0, 16);
    return bytesToBase32(first16);
  }

  static Future<UserIdentity> createIdentity({
    required String displayName,
    String avatarColor = '#5865F2',
  }) async {
    final keyPair = await _algorithm.newKeyPair();
    final privateKeyBytes = await keyPair.extractPrivateKeyBytes();
    final publicKey = await keyPair.extractPublicKey();
    final publicKeyBytes = publicKey.bytes;

    final userId = deriveUserId(publicKeyBytes);
    final pubHex = bytesToHex(publicKeyBytes);
    final privHex = bytesToHex(privateKeyBytes);

    final identity = UserIdentity(
      userId: userId,
      displayName: displayName,
      avatarColor: avatarColor,
      publicKeyHex: pubHex,
      privateKeyHex: privHex,
    );

    await saveIdentity(identity);
    return identity;
  }

  static Future<void> saveIdentity(UserIdentity identity) async {
    final jsonStr = jsonEncode(identity.toJson());
    await _storage.write(key: _keyIdentity, value: jsonStr);
  }

  static Future<UserIdentity?> loadIdentity() async {
    final jsonStr = await _storage.read(key: _keyIdentity);
    if (jsonStr == null || jsonStr.isEmpty) return null;
    try {
      final map = jsonDecode(jsonStr) as Map<String, dynamic>;
      return UserIdentity.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  static Future<void> clearIdentity() async {
    await _storage.delete(key: _keyIdentity);
  }

  static Future<String> signPayload({
    required UserIdentity identity,
    required String payload,
  }) async {
    final payloadBytes = utf8.encode(payload);
    final privBytes = hexToBytes(identity.privateKeyHex);
    final pubBytes = hexToBytes(identity.publicKeyHex);

    final keyPair = crypt.SimpleKeyPairData(
      privBytes,
      publicKey: crypt.SimplePublicKey(pubBytes, type: crypt.KeyPairType.ed25519),
      type: crypt.KeyPairType.ed25519,
    );

    final signature = await _algorithm.sign(payloadBytes, keyPair: keyPair);
    return bytesToHex(signature.bytes);
  }

  static Future<String> signAuth({
    required UserIdentity identity,
    required String targetId,
    required int timestamp,
  }) async {
    return signPayload(
      identity: identity,
      payload: 'echo-auth|$targetId|$timestamp',
    );
  }
}
