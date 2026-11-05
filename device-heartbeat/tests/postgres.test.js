import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";
import { PostgresDeviceRepository } from "../src/repositories/deviceRepository.js";
const url = process.env.C2_TEST_DATABASE_URL;
const schema = fs.readFileSync(
  new URL("../sql/schema.sql", import.meta.url),
  "utf8",
);
const migration = fs
  .readFileSync(new URL("../sql/migrate-v1-to-v2.sql", import.meta.url), "utf8")
  .replace(/^\\set.*$/m, "")
  .replace(/^\\ir schema.sql$/m, () => schema);
const user = "11111111-2222-3333-4444-555555555555";
const other = "99999999-9999-9999-9999-999999999999";
const mac = "001A2B3C4D5E";
const legacyDDL = `CREATE TABLE devices (
  device_id varchar(50) PRIMARY KEY, mac_no varchar(100), user_id uuid,
  name varchar(100), location varchar(200), model varchar(100), firmware_version varchar(50),
  wg_pubkey varchar(255), vpn_ip varchar(20), is_active boolean DEFAULT true,
  registered_at timestamptz, created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  description varchar(200), storage_used_bytes bigint DEFAULT 0,
  latest_event_time timestamptz, thumbnail_url varchar(500));
  CREATE TABLE heartbeat_history (device_id varchar(50) REFERENCES devices(device_id));`;
test(
  "PostgreSQL 17 repository, migration preservation and failed migration rollback",
  { skip: !url },
  async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const name = "c2_test_" + process.pid + "_" + Date.now();
    await client.query("CREATE SCHEMA " + name);
    try {
      await client.query("SET search_path TO " + name);
      await client.query("CREATE TABLE users (user_id UUID PRIMARY KEY)");
      await client.query("INSERT INTO users VALUES ($1),($2)", [user, other]);
      await client.query(schema);
      const repo = new PostgresDeviceRepository(client);
      const claimed = await repo.register(mac, user, { location: "room" });
      assert.equal(claimed.mac, mac);
      assert.ok(claimed.name.endsWith(mac));
      assert.equal(
        await repo.register(mac, other, { location: "stolen" }),
        null,
      );
      await repo.update(mac, {
        vpn_ip: "10.0.1.11",
        config_version: 8,
        latency_ms: 12,
        storage_used_bytes: 1024,
      });
      const now = Date.now();
      let d = await repo.updateHeartbeat(
        mac,
        "10.0.1.11",
        {
          rtsp_ok: false,
          wg_ok: false,
          applied_config_version: 3,
          latency_ms: 0,
          storage_used_bytes: 0,
        },
        new Date(now).toISOString(),
      );
      assert.equal(d.was_online, false);
      assert.equal(d.config_version, 8);
      assert.equal(d.applied_config_version, 3);
      assert.equal(d.rtsp_ok, false);
      assert.equal(d.wg_ok, false);
      assert.equal(d.latency_ms, 0);
      assert.equal(Number(d.storage_used_bytes), 0);
      d = await repo.updateHeartbeat(
        mac,
        "10.0.1.11",
        { rtsp_ok: true, wg_ok: true, applied_config_version: 8 },
        new Date(now + 5000).toISOString(),
      );
      assert.equal(d.was_online, true);
      assert.equal(d.latency_ms, 0);
      assert.equal(d.last_handshake, null);
      assert.equal(
        await repo.updateHeartbeat(
          mac,
          "10.0.1.12",
          { rtsp_ok: true, wg_ok: true, applied_config_version: 0 },
          new Date(now + 6000).toISOString(),
        ),
        null,
      );
      assert.equal(
        (await repo.markStaleDevicesOffline(new Date(now + 5000).toISOString()))
          .length,
        0,
      );
      assert.equal(
        (await repo.markStaleDevicesOffline(new Date(now + 5001).toISOString()))
          .length,
        1,
      );
      assert.equal(
        await repo.updateOwned(mac, other, { name: "stolen" }),
        null,
      );
      assert.equal((await repo.findByUserId(user)).length, 1);
      await assert.rejects(
        repo.update(mac, { "name; DROP TABLE users;--": "x" }),
        /Unsupported/,
      );
      // Use a second real connection for a concurrent ownership claim.
      const second = new pg.Client({ connectionString: url });
      await second.connect();
      try {
        await second.query("SET search_path TO " + name);
        const repo2 = new PostgresDeviceRepository(second);
        const results = await Promise.all([
          repo.register("AAAAAAAAAAAA", user, { location: "A" }),
          repo2.register("AAAAAAAAAAAA", other, { location: "B" }),
        ]);
        assert.equal(results.filter(Boolean).length, 1);
      } finally {
        await second.end();
      }
      await client.query("DROP TABLE devices");
      await client.query(legacyDDL);
      await client.query(
        "INSERT INTO devices (device_id,mac_no,user_id,name,location,vpn_ip) VALUES ($1,$2,$3,$4,$5,$6)",
        ["CAM-4D5E", "00:1a:2b:3c:4d:5e", user, "legacy", "room", "10.0.0.10"],
      );
      await client.query("INSERT INTO heartbeat_history VALUES ('CAM-4D5E')");
      await client.query(migration);
      assert.equal((await repo.findByMac(mac)).user_id, user);
      assert.equal((await repo.findByMac(mac)).vpn_ip, "10.0.0.10");
      assert.equal((await repo.findByMac(mac)).last_seen, null);
      assert.equal(
        (await client.query("SELECT count(*) FROM devices_legacy_v1")).rows[0]
          .count,
        "1",
      );
      assert.equal(
        (
          await client.query(
            "SELECT count(*) FROM heartbeat_history h JOIN devices_legacy_v1 d USING(device_id)",
          )
        ).rows[0].count,
        "1",
      );
      await client.query(
        "DROP TABLE heartbeat_history,devices,devices_legacy_v1",
      );
      await client.query(legacyDDL);
      await client.query(
        "INSERT INTO devices (device_id,mac_no,name,location) VALUES ('old','MAC-SERIAL-ONLY','bad','room')",
      );
      await assert.rejects(client.query(migration), /Invalid or synthetic/);
      await client.query("ROLLBACK");
      assert.equal(
        (await client.query("SELECT device_id FROM devices")).rows[0].device_id,
        "old",
      );
      assert.equal(
        (
          await client.query(
            "SELECT to_regclass('devices_legacy_v1') AS archive",
          )
        ).rows[0].archive,
        null,
      );
    } finally {
      await client.query("ROLLBACK");
      await client.query("SET search_path TO public");
      await client.query("DROP SCHEMA " + name + " CASCADE");
      await client.end();
    }
  },
);
