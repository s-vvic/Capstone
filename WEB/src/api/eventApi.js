/**
 * 이벤트 로그 및 Push 알림 REST API (Component 3, ICD 2.3, ICD 2.7, SV-F-020 ~ SV-F-024)
 */
import { apiClient } from "./client.js";

export const eventApi = {
  /**
   * 이벤트 목록 조회 (GET /events, ICD 2.3.1, WEB-F-030)
   * @param {Object} [params] - { page, size, start_date, end_date, device_id, event_type, status }
   */
  async getEvents(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return apiClient.get(`/events${queryString}`);
  },

  /**
   * 대시보드 통계 요약 조회 (GET /events/summary, WEB-F-001)
   */
  async getEventSummary() {
    return apiClient.get("/events/summary");
  },

  /**
   * 개별 이벤트 상태 갱신 (확인 처리, 중요 표시, 메모 작성) (PATCH /events/:id, ICD 2.3.2)
   */
  async updateEvent(eventId, updateData) {
    return apiClient.patch(`/events/${encodeURIComponent(eventId)}`, updateData);
  },

  /**
   * 미확인 이벤트 일괄 확인 처리 (PATCH /events/batch, WEB-F-033)
   * @param {string[]} eventIds
   */
  async batchConfirmEvents(eventIds) {
    return apiClient.patch("/events/batch", { event_ids: eventIds });
  },

  /**
   * 사용자 알림 수신 설정 조회 (GET /notifications/settings, ICD 2.7)
   */
  async getNotificationSettings() {
    return apiClient.get("/notifications/settings");
  },

  /**
   * 사용자 알림 수신 설정 저장 (PUT /notifications/settings, ICD 2.7)
   */
  async updateNotificationSettings(settings) {
    return apiClient.put("/notifications/settings", settings);
  },
};

export default eventApi;
