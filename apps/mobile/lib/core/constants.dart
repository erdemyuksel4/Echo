class AppConstants {
  static const String appName = 'Echo';
  static const String serverHttpUrl = 'https://echo-server.erdemyuksel04.workers.dev';
  static const String serverWsUrl = 'wss://echo-server.erdemyuksel04.workers.dev';

  // Fallback STUN/TURN list
  static const List<Map<String, dynamic>> defaultIceServers = [
    {'urls': 'stun:stun.cloudflare.com:3478'},
    {'urls': 'stun:stun.l.google.com:19302'},
    {'urls': 'stun:stun1.l.google.com:19302'},
  ];
}
