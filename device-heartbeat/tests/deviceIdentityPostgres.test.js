import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";
import { PostgresDeviceRepository } from "../src/repositories/deviceRepository.js";

const url = process.env.C2_TEST_DATABASE_URL;
const schema = readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../sql/migrate-add-device-id.sql", import.meta.url), "utf8").replace(/^\\set.*$/m, "");
const macSchema = schema.split("-- Covers SQL seed")[0]
  .split("\n").filter((line) => !line.trimStart().startsWith("device_id CHAR(8)")).join("\n")
  .replace("mac CHAR(12) NOT NULL UNIQUE", "mac CHAR(12) PRIMARY KEY");
const mac = "001A2B3C4D5E";
const userId = "11111111-2222-3333-4444-555555555555";

test("PostgreSQL device ID generation, existing schema upgrades and collision rollback", { skip: !url }, async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const namespace = "c2_identity_" + process.pid + "_" + Date.now();
  await client.query("CREATE SCHEMA " + namespace);
  try {
    await client.query("SET search_path TO " + namespace);
    await client.query("CREATE TABLE users (user_id uuid PRIMARY KEY)");
    await client.query("INSERT INTO users VALUES ($1)", [userId]);
    await client.query(schema);
    const repo = new PostgresDeviceRepository(client);
    const saved = await repo.register(mac, userId, { location: "A" });
    assert.equal(saved.device_id, "CAM-4D5E");
    assert.equal(saved.mac, mac);
    assert.equal((await repo.register(mac, userId, { location: "Updated" })).device_id, "CAM-4D5E");
    await assert.rejects(repo.register("AA1122334D5E", userId, { location: "Collision" }), { code: "23505" });
    assert.equal((await repo.findByMac(mac)).location, "Updated");
    // Inserts from seed scripts get an ID even if they omit device_id.
    const seeded = await client.query("INSERT INTO devices(mac,name,location) VALUES ('AA1122334D5F','Seed','Room') RETURNING mac,device_id");
    assert.equal(seeded.rows[0].device_id, "CAM-4D5F");
    const corrected = await repo.create({ mac: "AA1122334D60", device_id: "CAM-FFFF", name: "Correct", location: "Room" });
    assert.equal(corrected.device_id, "CAM-4D60");
    await client.query(schema); // New schema is not mistaken for legacy device_id/mac_no.

    await client.query("DROP TABLE devices");
    await client.query(macSchema);
    await client.query("INSERT INTO devices(mac,name,location) VALUES ($1,'Existing','Room')", [mac]);
    await client.query("CREATE TABLE dependent (mac char(12) REFERENCES devices(mac))");
    await client.query("INSERT INTO dependent VALUES ($1)", [mac]);
    await client.query(migration);
    await client.query(migration); // Reapplying is safe.
    assert.equal((await repo.findByMac(mac)).device_id, "CAM-4D5E");
    assert.equal((await client.query("SELECT count(*) FROM dependent JOIN devices USING(mac)")).rows[0].count, "1");
    await client.query("DROP TABLE dependent, devices");

    // User-edited schema: device_id PK, but mac has no unique constraint yet.
    await client.query("CREATE TABLE devices(device_id char(8) PRIMARY KEY, mac char(12) NOT NULL, user_id uuid, name text NOT NULL, location text NOT NULL, is_active boolean NOT NULL DEFAULT true, registered_at timestamptz, created_at timestamptz DEFAULT now())");
    await client.query("INSERT INTO devices(device_id,mac,name,location) VALUES ('CAM-0000',$1,'Manual','Room')", [mac]);
    await client.query(migration);
    assert.equal((await repo.register(mac, userId, { location: "Claimed" })).device_id, "CAM-4D5E");
    assert.equal((await repo.register("AA1122334D5F", userId, { location: "New" })).device_id, "CAM-4D5F");
    await client.query("DROP TABLE devices");

    await client.query(macSchema);
    await client.query("INSERT INTO devices(mac,name,location) VALUES ($1,'First','A'),('AA1122334D5E','Second','B')", [mac]);
    await assert.rejects(client.query(migration), /device_id collision/);
    await client.query("ROLLBACK");
    assert.equal((await client.query("SELECT count(*) FROM devices")).rows[0].count, "2");
    assert.equal((await client.query("SELECT count(*) FROM information_schema.columns WHERE table_schema=$1 AND table_name='devices' AND column_name='device_id'", [namespace])).rows[0].count, "0");
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query("DROP SCHEMA " + namespace + " CASCADE");
    await client.end();
  }
});
