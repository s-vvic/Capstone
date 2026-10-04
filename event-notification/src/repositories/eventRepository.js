import { getDatabasePool } from '../config/database.js';

export class PostgresEventRepository {
  async create(data) {
    const pool = getDatabasePool();
    const query = `
      INSERT INTO events (
        device_id, event_type, occurred_at, status, is_important,
        zone_id, sound_level_db, snapshot_url, clip_url, memo, detail
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      data.device_id,
      data.event_type,
      data.occurred_at || new Date().toISOString(),
      data.status || 'unconfirmed',
      Boolean(data.is_important),
      data.zone_id || null,
      data.sound_level_db !== undefined ? data.sound_level_db : null,
      data.snapshot_url || null,
      data.clip_url || null,
      data.memo || null,
      data.detail || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async findById(eventId) {
    const pool = getDatabasePool();
    const query = `
      SELECT e.*, d.name AS device_name
      FROM events e
      LEFT JOIN devices d ON e.device_id = d.device_id
      WHERE e.event_id = $1;
    `;
    const result = await pool.query(query, [eventId]);
    return result.rows[0] || null;
  }

  async findMany(filters = {}, pagination = { page: 1, size: 20 }) {
    const pool = getDatabasePool();
    const conditions = [];
    const values = [];
    let idx = 1;

    if (filters.device_ids && Array.isArray(filters.device_ids) && filters.device_ids.length > 0) {
      conditions.push(`e.device_id = ANY($${idx++})`);
      values.push(filters.device_ids);
    }
    if (filters.device_id) {
      conditions.push(`e.device_id = $${idx++}`);
      values.push(filters.device_id);
    }
    if (filters.event_type) {
      conditions.push(`e.event_type = $${idx++}`);
      values.push(filters.event_type);
    }
    if (filters.status) {
      conditions.push(`e.status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.start_date) {
      conditions.push(`e.occurred_at >= $${idx++}`);
      values.push(filters.start_date);
    }
    if (filters.end_date) {
      conditions.push(`e.occurred_at <= $${idx++}`);
      values.push(filters.end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM events e ${whereClause};`;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const page = Math.max(1, parseInt(pagination.page || 1, 10));
    const size = Math.max(1, parseInt(pagination.size || 20, 10));
    const offset = (page - 1) * size;

    const dataQuery = `
      SELECT e.*, COALESCE(d.name, e.device_id) AS device_name
      FROM events e
      LEFT JOIN devices d ON e.device_id = d.device_id
      ${whereClause}
      ORDER BY e.occurred_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    values.push(size, offset);

    const dataRes = await pool.query(dataQuery, values);
    return {
      total,
      page,
      size,
      items: dataRes.rows,
    };
  }

  async updateStatus(eventId, { status, is_important, memo }) {
    const pool = getDatabasePool();
    const updates = [];
    const values = [eventId];
    let idx = 2;

    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
    }
    if (is_important !== undefined) {
      updates.push(`is_important = $${idx++}`);
      values.push(Boolean(is_important));
    }
    if (memo !== undefined) {
      updates.push(`memo = $${idx++}`);
      values.push(memo);
    }

    if (updates.length === 0) {
      return this.findById(eventId);
    }

    const query = `
      UPDATE events
      SET ${updates.join(', ')}
      WHERE event_id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async batchUpdateStatus(eventIds, status = 'confirmed') {
    const pool = getDatabasePool();
    const query = `
      UPDATE events
      SET status = $1
      WHERE event_id = ANY($2);
    `;
    const result = await pool.query(query, [status, eventIds]);
    return result.rowCount;
  }

  async getSummary(deviceIds = []) {
    const pool = getDatabasePool();
    let whereClause = '';
    const values = [];

    if (deviceIds.length > 0) {
      whereClause = 'WHERE device_id = ANY($1)';
      values.push(deviceIds);
    }

    const query = `
      SELECT
        COUNT(*) FILTER (WHERE occurred_at::date = CURRENT_DATE) AS today_events_count,
        COUNT(*) FILTER (WHERE status = 'unconfirmed') AS unconfirmed_count,
        COUNT(*) AS total_events_count
      FROM events
      ${whereClause};
    `;
    const result = await pool.query(query, values);
    const row = result.rows[0];

    return {
      today_events_count: parseInt(row.today_events_count || 0, 10),
      unconfirmed_count: parseInt(row.unconfirmed_count || 0, 10),
      total_events_count: parseInt(row.total_events_count || 0, 10),
    };
  }
}
