import 'dart:convert';
import 'package:cryptography/cryptography.dart';

class E2eeService {
  static const String prefix = 'e2ee:v1:';
  static final _algorithm = AesGcm.with256bits();

  static bool isE2eeMessage(String content) => content.startsWith(prefix);

  static Future<SecretKey> deriveKeyFromSecret(String secret, {String salt = 'Echo-E2EE-Salt-2026'}) async {
    final pbkdf2 = Pbkdf2(
      macAlgorithm: Hmac.sha256(),
      iterations: 100000,
      bits: 256,
    );

    return pbkdf2.deriveKey(
      secretKey: SecretKey(utf8.encode(secret)),
      nonce: utf8.encode(salt),
    );
  }

  static Future<String> encrypt(String plainText, SecretKey key) async {
    final secretBox = await _algorithm.encrypt(
      utf8.encode(plainText),
      secretKey: key,
    );

    final ivHex = secretBox.nonce.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    final cipherWithMac = [...secretBox.cipherText, ...secretBox.mac.bytes];
    final cipherHex = cipherWithMac.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

    return '$prefix$ivHex:$cipherHex';
  }

  static Future<String?> decrypt(String cipherPayload, SecretKey key) async {
    if (!isE2eeMessage(cipherPayload)) return cipherPayload;

    try {
      final body = cipherPayload.substring(prefix.length);
      final parts = body.split(':');
      if (parts.length < 2) return null;

      final ivHex = parts[0];
      final cipherHex = parts[1];

      final ivBytes = _hexToBytes(ivHex);
      final rawCipherBytes = _hexToBytes(cipherHex);

      // Last 16 bytes is MAC
      final cipherText = rawCipherBytes.sublist(0, rawCipherBytes.length - 16);
      final mac = Mac(rawCipherBytes.sublist(rawCipherBytes.length - 16));

      final secretBox = SecretBox(
        cipherText,
        nonce: ivBytes,
        mac: mac,
      );

      final clearBytes = await _algorithm.decrypt(secretBox, secretKey: key);
      return utf8.decode(clearBytes);
    } catch (_) {
      return null;
    }
  }

  static List<int> _hexToBytes(String hex) {
    final result = <int>[];
    for (int i = 0; i < hex.length; i += 2) {
      result.add(int.parse(hex.substring(i, i + 2), radix: 16));
    }
    return result;
  }
}
