import { VpnRepositoryInterface } from './vpnRepositoryInterface.js';
import { getDatabasePool } from '../config/database.js';
import { VPN_STATUS } from '../constants/vpnConstants.js';
import { logger } from '../utils/logger.js';

export class PostgresVpnRepository extends VpnRepositoryInterface {
  constructor() {
    super();
    this.initPromise = this.ensureTables();
  }

  async ensureTables() {
    const pool = getDatabasePool();
    if (!pool) return;

    const query = `
      CREATE TABLE IF NOT EXISTS vpn_peers (
        peer_id VARCHAR(50) PRIMARY KEY,
        device_id VARCHAR(50),
        phone_id VARCHAR(50),
        user_id UUID,
        peer_type VARCHAR(20) NOT NULL DEFAULT 'device',
        name VARCHAR(100) NOT NULL,
        mac_no VARCHAR(100),
        serial_no VARCHAR(100),
        wg_pubkey VARCHAR(255) UNIQUE NOT NULL,
        vpn_ip VARCHAR(20) UNIQUE NOT NULL,
        vpn_server VARCHAR(100) DEFAULT 'vpn.securecam.com:443',
        vpn_status VARCHAR(20) DEFAULT 'disconnected',
        connected_duration_sec INTEGER DEFAULT 0,
        last_handshake TIMESTAMP WITH TIME ZONE,
        error_type VARCHAR(50),
        auto_connect BOOLEAN DEFAULT true,
        reconnect_on_start BOOLEAN DEFAULT true,
        reconnect_on_network_change BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    try {
      await pool.query(query);
      logger.info('[PostgresVpnRepository] vpn_peers 테이블 확인 및 준비 완료');
    } catch (err) {
      logger.warn(`[PostgresVpnRepository] 테이블 생성 확인 실패: ${err.message}`);
    }
  }

  mapRow(row) {
    if (!row) return null;
    return {
      peer_id: row.peer_id,
      device_id: row.device_id,
      phone_id: row.phone_id,
      user_id: row.user_id,
      peer_type: row.peer_type,
      name: row.name,
      device_name: row.name,
      mac_no: row.mac_no,
      serial_no: row.serial_no,
      wg_pubkey: row.wg_pubkey,
      vpn_ip: row.vpn_ip,
      vpn_server: row.vpn_server,
      vpn_status: row.vpn_status,
      connected_duration_sec: parseInt(row.connected_duration_sec, 10) || 0,
      last_handshake: row.last_handshake ? new Date(row.last_handshake).toISOString() : null,
      error_type: row.error_type,
      auto_connect: row.auto_connect,
      reconnect_on_start: row.reconnect_on_start,
      reconnect_on_network_change: row.reconnect_on_network_change,
      is_active: row.is_active,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  async create(peerData) {
    await this.initPromise;
    const pool = getDatabasePool();
    const peerId = peerData.peer_id || peerData.device_id || peerData.phone_id || `PEER-${Date.now()}`;

    const query = `
      INSERT INTO vpn_peers (
        peer_id, device_id, phone_id, user_id, peer_type, name, mac_no, serial_no,
        wg_pubkey, vpn_ip, vpn_server, vpn_status, auto_connect, reconnect_on_start, reconnect_on_network_change
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *;
    `;

    const values = [
      peerId,
      peerData.device_id || (peerData.peer_type === 'device' ? peerId : null),
      peerData.phone_id || (peerData.peer_type === 'phone' ? peerId : null),
      peerData.user_id || null,
      peerData.peer_type || 'device',
      peerData.name || peerData.device_name || '기기',
      peerData.mac_no || null,
      peerData.serial_no || null,
      peerData.wg_pubkey,
      peerData.vpn_ip,
      peerData.vpn_server || 'vpn.securecam.com:443',
      peerData.vpn_status || VPN_STATUS.DISCONNECTED,
      peerData.auto_connect !== false,
      peerData.reconnect_on_start !== false,
      peerData.reconnect_on_network_change !== false,
    ];

    const result = await pool.query(query, values);
    return this.mapRow(result.rows[0]);
  }

  async findById(peerId) {
    await this.initPromise;
    const pool = getDatabasePool();
    const result = await pool.query(
      'SELECT * FROM vpn_peers WHERE peer_id = $1 OR device_id = $1 OR phone_id = $1;',
      [peerId]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByPublicKey(publicKey) {
    await this.initPromise;
    const pool = getDatabasePool();
    const result = await pool.query('SELECT * FROM vpn_peers WHERE wg_pubkey = $1;', [publicKey]);
    return this.mapRow(result.rows[0]);
  }

  async findByVpnIp(vpnIp) {
    await this.initPromise;
    const pool = getDatabasePool();
    const result = await pool.query('SELECT * FROM vpn_peers WHERE vpn_ip = $1;', [vpnIp]);
    return this.mapRow(result.rows[0]);
  }

  async findByUserId(userId) {
    await this.initPromise;
    const pool = getDatabasePool();
    const result = await pool.query('SELECT * FROM vpn_peers WHERE user_id = $1 ORDER BY created_at DESC;', [userId]);
    return result.rows.map((row) => this.mapRow(row));
  }

  async findAll() {
    await this.initPromise;
    const pool = getDatabasePool();
    const result = await pool.query('SELECT * FROM vpn_peers ORDER BY created_at DESC;');
    return result.rows.map((row) => this.mapRow(row));
  }

  async update(peerId, updateData) {
    await this.initPromise;
    const pool = getDatabasePool();
    const current = await this.findById(peerId);
    if (!current) return null;

    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updateData)) {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }

    fields.push(`updated_at = NOW()`);
    values.push(current.peer_id);

    const query = `
      UPDATE vpn_peers
      SET ${fields.join(', ')}
      WHERE peer_id = $${idx}
      RETURNING *;
    `;

    const result = await pool.query(query, values);
    return this.mapRow(result.rows[0]);
  }

  async delete(peerId) {
    await this.initPromise;
    const pool = getDatabasePool();
    const result = await pool.query(
      'DELETE FROM vpn_peers WHERE peer_id = $1 OR device_id = $1 OR phone_id = $1 RETURNING peer_id;',
      [peerId]
    );
    return result.rowCount > 0;
  }

  async clear() {
    await this.initPromise;
    const pool = getDatabasePool();
    if (pool) {
      await pool.query('TRUNCATE TABLE vpn_peers CASCADE;');
    }
  }
}
