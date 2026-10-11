import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:echo_mobile/core/crypto/identity_service.dart';
import 'package:echo_mobile/core/crypto/e2ee_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  FlutterSecureStorage.setMockInitialValues({});

  test('Ed25519 identity generation and userId derivation', () async {
    final identity = await IdentityService.createIdentity(
      displayName: 'TestUser',
      avatarColor: '#5865F2',
    );

    expect(identity.userId.length, equals(26)); // RFC4648 Base32 encoded 16 bytes
    expect(identity.displayName, equals('TestUser'));
    expect(identity.publicKeyHex.length, equals(64)); // 32 bytes hex
    expect(identity.privateKeyHex.length, equals(64));

    final ts = DateTime.now().millisecondsSinceEpoch;
    final sig = await IdentityService.signAuth(
      identity: identity,
      targetId: 'test_group',
      timestamp: ts,
    );

    expect(sig.length, equals(128)); // 64 bytes hex signature
  });

  test('E2EE AES-GCM encryption and decryption', () async {
    final key = await E2eeService.deriveKeyFromSecret('super-secret-password');
    const plainText = 'Merhaba gizli Echo mesajı!';

    final cipher = await E2eeService.encrypt(plainText, key);
    expect(E2eeService.isE2eeMessage(cipher), isTrue);

    final decrypted = await E2eeService.decrypt(cipher, key);
    expect(decrypted, equals(plainText));
  });
}
