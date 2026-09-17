import crypto from 'crypto';

/**
 * 인메모리 완전 호환 저장소 (테스트 및 단독 실행 모드 지원)
 */

export class InMemoryUserRepository {
  constructor() {
    this.users = new Map();
  }

  async create({ email, passwordHash, name, plan = 'basic' }) {
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const user = {
      user_id: userId,
      email,
      password_hash: passwordHash,
      name,
      plan,
      created_at: now,
      updated_at: now,
    };
    this.users.set(userId, user);
    return { ...user };
  }

  async findById(userId) {
    const user = this.users.get(userId);
    return user ? { ...user } : null;
  }

  async findByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return { ...user };
      }
    }
    return null;
  }

  async findByName(name) {
    const results = [];
    for (const user of this.users.values()) {
      if (user.name === name) {
        results.push({ ...user });
      }
    }
    return results;
  }

  async update(userId, fields = {}) {
    const user = this.users.get(userId);
    if (!user) return null;

    if (fields.name !== undefined) user.name = fields.name;
    if (fields.passwordHash !== undefined) user.password_hash = fields.passwordHash;
    if (fields.plan !== undefined) user.plan = fields.plan;
    user.updated_at = new Date().toISOString();

    return { ...user };
  }

  async delete(userId) {
    return this.users.delete(userId);
  }

  clear() {
    this.users.clear();
  }
}

export class InMemorySessionRepository {
  constructor() {
    this.sessions = new Map();
  }

  async create({
    userId,
    deviceName,
    deviceType = 'web',
    clientIp,
    userAgent,
    tokenJti,
    isAutoLogin = false,
    expiresAt,
  }) {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const session = {
      session_id: sessionId,
      user_id: userId,
      device_name: deviceName,
      device_type: deviceType,
      client_ip: clientIp,
      user_agent: userAgent,
      token_jti: tokenJti,
      is_auto_login: Boolean(isAutoLogin),
      is_active: true,
      last_active_at: now,
      created_at: now,
      expires_at: expiresAt,
    };
    this.sessions.set(sessionId, session);
    return { ...session };
  }

  async findById(sessionId) {
    const s = this.sessions.get(sessionId);
    return s ? { ...s } : null;
  }

  async findByJti(tokenJti) {
    const now = new Date().getTime();
    for (const s of this.sessions.values()) {
      if (s.token_jti === tokenJti && s.is_active && new Date(s.expires_at).getTime() > now) {
        return { ...s };
      }
    }
    return null;
  }

  async findActiveByUserId(userId) {
    const now = new Date().getTime();
    const results = [];
    for (const s of this.sessions.values()) {
      if (s.user_id === userId && s.is_active && new Date(s.expires_at).getTime() > now) {
        results.push({ ...s });
      }
    }
    return results.sort((a, b) => new Date(b.last_active_at) - new Date(a.last_active_at));
  }

  async countActiveByUserId(userId) {
    const active = await this.findActiveByUserId(userId);
    return active.length;
  }

  async updateLastActive(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.last_active_at = new Date().toISOString();
    }
  }

  async deactivate(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.is_active = false;
      return true;
    }
    return false;
  }

  async deactivateByJti(tokenJti) {
    for (const s of this.sessions.values()) {
      if (s.token_jti === tokenJti) {
        s.is_active = false;
        return true;
      }
    }
    return false;
  }

  async deactivateAllOtherSessions(userId, currentSessionId) {
    let count = 0;
    for (const s of this.sessions.values()) {
      if (s.user_id === userId && s.session_id !== currentSessionId && s.is_active) {
        s.is_active = false;
        count++;
      }
    }
    return count;
  }

  async deactivateAllUserSessions(userId) {
    let count = 0;
    for (const s of this.sessions.values()) {
      if (s.user_id === userId && s.is_active) {
        s.is_active = false;
        count++;
      }
    }
    return count;
  }

  clear() {
    this.sessions.clear();
  }
}

export class InMemoryLoginAttemptRepository {
  constructor() {
    this.attempts = [];
  }

  async recordAttempt({ email, clientIp, isSuccess }) {
    const attempt = {
      attempt_id: crypto.randomUUID(),
      email,
      client_ip: clientIp,
      is_success: isSuccess,
      attempt_time: new Date().toISOString(),
    };
    this.attempts.push(attempt);
    return attempt;
  }

  async getRecentFailedAttempts(email, clientIp, windowMinutes = 15) {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    return this.attempts.filter((a) => {
      const match = a.email.toLowerCase() === email.toLowerCase() || a.client_ip === clientIp;
      const isFailed = !a.is_success;
      const inWindow = new Date(a.attempt_time).getTime() > cutoff;
      return match && isFailed && inWindow;
    }).length;
  }

  async clearAttempts(email, clientIp) {
    this.attempts = this.attempts.filter(
      (a) => a.email.toLowerCase() !== email.toLowerCase() && a.client_ip !== clientIp
    );
  }

  clear() {
    this.attempts = [];
  }
}

export class InMemoryPasswordResetRepository {
  constructor() {
    this.resets = new Map();
  }

  async create({ userId, resetToken, expiresAt }) {
    const reset = {
      reset_id: crypto.randomUUID(),
      user_id: userId,
      reset_token: resetToken,
      expires_at: expiresAt,
      is_used: false,
      created_at: new Date().toISOString(),
    };
    this.resets.set(resetToken, reset);
    return { ...reset };
  }

  async findByToken(resetToken) {
    const reset = this.resets.get(resetToken);
    if (!reset) return null;
    const now = Date.now();
    if (reset.is_used || new Date(reset.expires_at).getTime() <= now) {
      return null;
    }
    return { ...reset };
  }

  async markUsed(resetId) {
    for (const r of this.resets.values()) {
      if (r.reset_id === resetId) {
        r.is_used = true;
        return true;
      }
    }
    return false;
  }

  clear() {
    this.resets.clear();
  }
}
