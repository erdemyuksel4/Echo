import 'package:flutter/material.dart';

class EchoColors {
  static const Color background = Color(0xFF313338);
  static const Color sidebar = Color(0xFF1E1F22);
  static const Color channelList = Color(0xFF2B2D31);
  static const Color inputBackground = Color(0xFF383A40);
  static const Color card = Color(0xFF2B2D31);

  static const Color blurple = Color(0xFF5865F2);
  static const Color green = Color(0xFF23A55A);
  static const Color red = Color(0xFFDA373C);
  static const Color yellow = Color(0xFFFEE75C);

  static const Color textPrimary = Color(0xFFF2F3F5);
  static const Color textMuted = Color(0xFF949BA4);
  static const Color divider = Color(0xFF3F4147);
}

class EchoTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: EchoColors.background,
      primaryColor: EchoColors.blurple,
      colorScheme: const ColorScheme.dark(
        primary: EchoColors.blurple,
        surface: EchoColors.card,
        error: EchoColors.red,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: EchoColors.channelList,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: EchoColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
        iconTheme: IconThemeData(color: EchoColors.textPrimary),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: EchoColors.sidebar,
        selectedItemColor: EchoColors.blurple,
        unselectedItemColor: EchoColors.textMuted,
        showUnselectedLabels: true,
      ),
      dividerColor: EchoColors.divider,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: EchoColors.inputBackground,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        hintStyle: const TextStyle(color: EchoColors.textMuted),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}
