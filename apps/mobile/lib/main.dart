import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'core/network/websocket_service.dart';
import 'core/network/user_websocket_service.dart';
import 'core/webrtc/webrtc_service.dart';
import 'core/webrtc/screenshare_service.dart';
import 'providers/auth_provider.dart';
import 'providers/group_provider.dart';
import 'providers/chat_provider.dart';
import 'providers/dm_provider.dart';
import 'providers/voice_provider.dart';
import 'providers/screenshare_provider.dart';
import 'screens/auth/onboarding_screen.dart';
import 'screens/main_layout.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Request runtime permissions gracefully on mobile startup
  try {
    await [
      Permission.microphone,
      Permission.camera,
      Permission.notification,
    ].request();
  } catch (_) {}

  // Singletons
  final wsService = WebSocketService();
  final userWsService = UserWebSocketService();
  final voiceService = WebRtcVoiceService(wsService: wsService);
  final screenShareService = ScreenShareService(wsService: wsService);

  runApp(
    MultiProvider(
      providers: [
        Provider<WebSocketService>.value(value: wsService),
        Provider<UserWebSocketService>.value(value: userWsService),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => GroupProvider(wsService: wsService)),
        ChangeNotifierProvider(create: (_) => ChatProvider(wsService: wsService)),
        ChangeNotifierProvider(create: (_) => DmProvider(userWsService: userWsService)),
        ChangeNotifierProvider(create: (_) => VoiceProvider(voiceService: voiceService)),
        ChangeNotifierProvider(create: (_) => ScreenShareProvider(screenShareService: screenShareService)),
      ],
      child: const EchoMobileApp(),
    ),
  );
}

class EchoMobileApp extends StatelessWidget {
  const EchoMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return MaterialApp(
      title: 'Echo',
      debugShowCheckedModeBanner: false,
      theme: EchoTheme.darkTheme,
      home: auth.isLoading
          ? const Scaffold(
              backgroundColor: EchoColors.sidebar,
              body: Center(
                child: CircularProgressIndicator(color: EchoColors.blurple),
              ),
            )
          : auth.isAuthenticated
              ? const MainLayout()
              : const OnboardingScreen(),
    );
  }
}
