import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../providers/auth_provider.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _nameController = TextEditingController();
  String _selectedColor = '#5865F2';

  final List<String> _avatarColors = [
    '#5865F2', // Discord Blurple
    '#57F287', // Green
    '#FEE75C', // Yellow
    '#EB459E', // Pink
    '#ED4245', // Red
    '#00B0F4', // Cyan
    '#9B59B6', // Purple
  ];

  Color _parseColor(String hex) {
    final clean = hex.replaceAll('#', '');
    return Color(int.parse('FF$clean', radix: 16));
  }

  void _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lütfen bir görünen ad girin')),
      );
      return;
    }

    final authProvider = context.read<AuthProvider>();
    await authProvider.setupProfile(
      displayName: name,
      avatarColor: _selectedColor,
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo Icon
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: _parseColor(_selectedColor),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: _parseColor(_selectedColor).withValues(alpha: 0.4),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.graphic_eq_rounded,
                    size: 44,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Echo\'ya Hoş Geldin',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    color: EchoColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Cihazında kriptografik Ed25519 kimliği üretilerek şifresiz, anında bağlanırsın.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: EchoColors.textMuted,
                  ),
                ),
                const SizedBox(height: 32),

                // Name Input
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'GÖRÜNEN AD',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                      color: EchoColors.textMuted,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _nameController,
                  style: const TextStyle(color: EchoColors.textPrimary),
                  decoration: const InputDecoration(
                    hintText: 'Nasıl anılmak istersin?',
                    prefixIcon: Icon(Icons.person_outline, color: EchoColors.textMuted),
                  ),
                ),
                const SizedBox(height: 24),

                // Color Picker
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'AVATAR RENGİ',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                      color: EchoColors.textMuted,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: _avatarColors.map((colorHex) {
                    final isSelected = _selectedColor == colorHex;
                    final color = _parseColor(colorHex);
                    return GestureDetector(
                      onTap: () => setState(() => _selectedColor = colorHex),
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                          border: isSelected
                              ? Border.all(color: Colors.white, width: 3)
                              : null,
                        ),
                        child: isSelected
                            ? const Icon(Icons.check, size: 20, color: Colors.white)
                            : null,
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 32),

                // Privacy Notice Box
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: EchoColors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: EchoColors.divider),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.shield_outlined, size: 20, color: EchoColors.yellow),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Ses, kamera ve ekran akışları doğrudan P2P WebRTC ile şifrelidir. Yazılı sohbetler Cloudflare Durable Object üzerinde tutulur.',
                          style: TextStyle(
                            fontSize: 11,
                            color: EchoColors.textMuted,
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),

                // Submit Button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: auth.isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: EchoColors.blurple,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: auth.isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Text(
                            'Başla ve Katıl',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
