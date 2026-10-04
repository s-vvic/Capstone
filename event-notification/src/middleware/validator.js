import { AppError } from '../errors/AppError.js';
import { VALID_EVENT_TYPES, VALID_EVENT_STATUSES } from '../constants/eventTypes.js';

export function validateEventReport(req, res, next) {
  const { mac_no, provision_token, event_type, occurred_at } = req.body || {};

  if (!mac_no || typeof mac_no !== 'string') {
    return next(AppError.badRequest('mac_no(문자열)는 필수 항목입니다.'));
  }
  if (!provision_token || typeof provision_token !== 'string') {
    return next(AppError.badRequest('provision_token(문자열)은 필수 항목입니다.'));
  }
  if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
    return next(
      AppError.badRequest(
        `event_type은 다음 중 하나여야 합니다: ${VALID_EVENT_TYPES.join(', ')}`
      )
    );
  }
  if (!occurred_at || isNaN(Date.parse(occurred_at))) {
    return next(AppError.badRequest('occurred_at은 유효한 ISO 8601 날짜 형식이어야 합니다.'));
  }

  next();
}

export function validateEventStatusUpdate(req, res, next) {
  const { status, is_important, memo } = req.body || {};

  if (status !== undefined && !VALID_EVENT_STATUSES.includes(status)) {
    return next(
      AppError.badRequest(
        `status는 다음 중 하나여야 합니다: ${VALID_EVENT_STATUSES.join(', ')}`
      )
    );
  }

  if (is_important !== undefined && typeof is_important !== 'boolean') {
    return next(AppError.badRequest('is_important는 boolean 값이어야 합니다.'));
  }

  if (memo !== undefined && typeof memo !== 'string') {
    return next(AppError.badRequest('memo는 문자열이어야 합니다.'));
  }

  if (memo && memo.length > 500) {
    return next(AppError.badRequest('memo는 최대 500자까지 허용됩니다.'));
  }

  next();
}

export function validateBatchConfirm(req, res, next) {
  const { event_ids } = req.body || {};

  if (!Array.isArray(event_ids) || event_ids.length === 0) {
    return next(AppError.badRequest('event_ids 배열(최소 1개 이상)이 필요합니다.'));
  }

  next();
}

export function validateNotificationSettings(req, res, next) {
  const {
    motion_alert,
    sound_alert,
    offline_alert,
    reconnect_alert,
    important_only,
    device_alerts,
  } = req.body || {};

  if (motion_alert !== undefined && typeof motion_alert !== 'boolean') {
    return next(AppError.badRequest('motion_alert는 boolean 값이어야 합니다.'));
  }
  if (sound_alert !== undefined && typeof sound_alert !== 'boolean') {
    return next(AppError.badRequest('sound_alert는 boolean 값이어야 합니다.'));
  }
  if (offline_alert !== undefined && typeof offline_alert !== 'boolean') {
    return next(AppError.badRequest('offline_alert는 boolean 값이어야 합니다.'));
  }
  if (reconnect_alert !== undefined && typeof reconnect_alert !== 'boolean') {
    return next(AppError.badRequest('reconnect_alert는 boolean 값이어야 합니다.'));
  }
  if (important_only !== undefined && typeof important_only !== 'boolean') {
    return next(AppError.badRequest('important_only는 boolean 값이어야 합니다.'));
  }
  if (device_alerts !== undefined && !Array.isArray(device_alerts)) {
    return next(AppError.badRequest('device_alerts는 배열 형식이어야 합니다.'));
  }

  next();
}
