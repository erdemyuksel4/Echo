import 'package:flutter/foundation.dart';
import '../core/crypto/identity_service.dart';

class AuthProvider extends ChangeNotifier {
  UserIdentity? _identity;
  bool _isLoading = true;

  UserIdentity? get identity => _identity;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _identity != null;

  AuthProvider() {
    loadIdentity();
  }

  Future<void> loadIdentity() async {
    _isLoading = true;
    notifyListeners();

    try {
      _identity = await IdentityService.loadIdentity();
    } catch (e) {
      debugPrint('Error loading identity: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> setupProfile({
    required String displayName,
    String avatarColor = '#5865F2',
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      _identity = await IdentityService.createIdentity(
        displayName: displayName,
        avatarColor: avatarColor,
      );
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await IdentityService.clearIdentity();
    _identity = null;
    notifyListeners();
  }
}
