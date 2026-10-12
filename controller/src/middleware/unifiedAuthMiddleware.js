import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { store as storageMemoryStore } from '../../../storage-retention/src/repositories/memory/store.js';
import { getDeviceLookupRepository } from '../../../event-notification/src/repositories/index.js';
import { deviceRepository as c2DeviceRepo } from '../../../device-heartbeat/src/repositories/index.js';

export async function unifiedAuthenticate(req, res, next) {
  let uid = null;
  let decodedUser = null;

  // 1. Authorization: Bearer {token} 검증
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      uid = decoded.sub || decoded.user_id || decoded.userId;
      decodedUser = {
        ...decoded,
        userId: uid,
        user_id: uid,
        email: decoded.email || 'user@securecam.com',
        plan: decoded.plan || 'basic',
        name: decoded.name || '사용자',
      };
    } catch (err) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '인증 토큰이 유효하지 않거나 만료되었습니다.',
        },
      });
    }
  } else if (env.NODE_ENV !== 'production' && req.headers['x-user-id']) {
    // 2. 개발 및 테스트 환경용 x-user-id 헤더 지원
    uid = req.headers['x-user-id'];
    decodedUser = {
      userId: uid,
      user_id: uid,
      email: 'dev@securecam.com',
      plan: req.headers['x-user-plan'] || 'basic',
      name: '개발사용자',
    };
  }

  if (!uid || !decodedUser) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: '인증 토큰이 필요합니다.',
      },
    });
  }

  req.user = decodedUser;

  // ---------------------------------------------------------------------------
  // Inter-Component Data Synchronization (컴포넌트 간 실시간 동기화 브릿지)
  // ---------------------------------------------------------------------------
  try {
    // Component 5: 스토리지 메모리 스토어에 사용자 플랜 동기화
    if (storageMemoryStore && storageMemoryStore.users) {
      storageMemoryStore.users.set(uid, {
        user_id: uid,
        plan: decodedUser.plan || 'basic',
      });
    }

    // Component 2에서 등록된 기기 목록을 Component 3 (이벤트) 및 Component 5 (스토리지)에 동기화
    if (c2DeviceRepo && typeof c2DeviceRepo.findByUserId === 'function') {
      const userDevices = await c2DeviceRepo.findByUserId(uid);
      const c3DeviceRepo = getDeviceLookupRepository();

      for (const dev of userDevices) {
        if (c3DeviceRepo && typeof c3DeviceRepo.seedDevice === 'function') {
          c3DeviceRepo.seedDevice(dev);
        }
        if (storageMemoryStore && storageMemoryStore.devices) {
          storageMemoryStore.devices.set(dev.device_id, {
            device_id: dev.device_id,
            user_id: uid,
            name: dev.name,
            is_active: dev.is_active !== false,
          });
        }
      }
    }
  } catch (syncErr) {
    // 동기화 오류는 메인 요청을 막지 않음
  }

  next();
}
