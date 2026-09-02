class AuthUser {
  AuthUser({required this.id, required this.name, this.email, this.phone});

  final String id;
  final String name;
  final String? email;
  final String? phone;

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
    id: j['id'] as String,
    name: (j['name'] as String?) ?? '',
    email: j['email'] as String?,
    phone: j['phone'] as String?,
  );
}

class TokenPair {
  TokenPair(this.access, this.refresh);

  final String access;
  final String refresh;

  factory TokenPair.fromJson(Map<String, dynamic> j) =>
      TokenPair(j['accessToken'] as String, j['refreshToken'] as String);
}

class BusinessInfo {
  BusinessInfo({required this.id, required this.name, this.role});

  final String id;
  final String name;
  final String? role;

  factory BusinessInfo.fromJson(Map<String, dynamic> j) => BusinessInfo(
    id: j['id'] as String,
    name: (j['name'] as String?) ?? 'Business',
    role: j['role'] as String?,
  );
}
