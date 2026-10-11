import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../providers/auth_provider.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  Color _parseColor(String hex) {
    try {
      final clean = hex.replaceAll('#', '');
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return EchoColors.blurple;
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final identity = authProvider.identity;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ayarlar'),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        children: [
          // Profile Card
          if (identity != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: EchoColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: EchoColors.divider),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: _parseColor(identity.avatarColor),
                    child: Text(
                      identity.displayName.isNotEmpty ? identity.displayName[0].toUpperCase() : '?',
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    identity.displayName,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: EchoColors.textPrimary),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'ID: ${identity.userId}',
                        style: const TextStyle(fontSize: 12, color: EchoColors.textMuted, fontFamily: 'monospace'),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy, size: 14, color: EchoColors.textMuted),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: identity.userId));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Kullanıcı ID panoya kopyalandı')),
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),

          const SizedBox(height: 24),

          // Security & Identity Section
          const Text(
            'GÜVENLİK & KİMLİK',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: EchoColors.textMuted, letterSpacing: 0.5),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: EchoColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: EchoColors.divider),
            ),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.key, color: EchoColors.blurple),
                  title: const Text('Ed25519 Açık Anahtar', style: TextStyle(color: EchoColors.textPrimary, fontSize: 14)),
                  subtitle: Text(
                    identity?.publicKeyHex.substring(0, 24) ?? '',
                    style: const TextStyle(color: EchoColors.textMuted, fontSize: 11, fontFamily: 'monospace'),
                  ),
                  trailing: const Icon(Icons.copy, size: 18, color: EchoColors.textMuted),
                  onTap: () {
                    if (identity != null) {
                      Clipboard.setData(ClipboardData(text: identity.publicKeyHex));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Açık anahtar kopyalandı')),
                      );
                    }
                  },
                ),
                const Divider(color: EchoColors.divider, height: 1),
                ListTile(
                  leading: const Icon(Icons.lock_outline, color: EchoColors.green),
                  title: const Text('Uçtan Uca Şifreleme (E2EE)', style: TextStyle(color: EchoColors.textPrimary, fontSize: 14)),
                  subtitle: const Text('Mesajlar AES-256-GCM ile şifrelenir', style: TextStyle(color: EchoColors.textMuted, fontSize: 11)),
                  trailing: const Icon(Icons.chevron_right, color: EchoColors.textMuted),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Network & Server Section
          const Text(
            'BAĞLANTI & SUNUCU',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: EchoColors.textMuted, letterSpacing: 0.5),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: EchoColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: EchoColors.divider),
            ),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.cloud_done, color: EchoColors.green),
                  title: const Text('Cloudflare Workers', style: TextStyle(color: EchoColors.textPrimary, fontSize: 14)),
                  subtitle: const Text(AppConstants.serverHttpUrl, style: TextStyle(color: EchoColors.textMuted, fontSize: 11)),
                ),
                const Divider(color: EchoColors.divider, height: 1),
                const ListTile(
                  leading: Icon(Icons.network_check, color: EchoColors.yellow),
                  title: Text('WebRTC Mesh & STUN/TURN', style: TextStyle(color: EchoColors.textPrimary, fontSize: 14)),
                  subtitle: Text('Cloudflare STUN + UDP/TCP/TLS TURN Aktif', style: TextStyle(color: EchoColors.textMuted, fontSize: 11)),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Logout Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: EchoColors.red),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.logout, color: EchoColors.red),
              label: const Text('Bu Cihazdan Çıkış Yap', style: TextStyle(color: EchoColors.red, fontWeight: FontWeight.bold)),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: EchoColors.card,
                    title: const Text('Çıkış Yapılsın mı?', style: TextStyle(color: EchoColors.textPrimary)),
                    content: const Text(
                      'Bu cihazdaki Ed25519 anahtarın silinir. Tekrar giriş yaptığında yeni bir kimlik oluşturulur.',
                      style: TextStyle(color: EchoColors.textMuted),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('İptal', style: TextStyle(color: EchoColors.textMuted)),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: EchoColors.red),
                        onPressed: () {
                          Navigator.pop(ctx);
                          authProvider.logout();
                        },
                        child: const Text('Çıkış Yap', style: TextStyle(color: Colors.white)),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 32),
          const Center(
            child: Text(
              'Echo Mobile v1.0.0 (Faz 11)\nWindows & Mobile Uyumlu',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: EchoColors.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}
