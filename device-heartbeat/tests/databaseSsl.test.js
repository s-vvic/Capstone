import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDatabaseSslConfig } from "../src/config/database.js";

test("SSL-disabled configuration stays disabled; enabled SSL verifies certificates", () => {
  assert.equal(buildDatabaseSslConfig({ DB_SSL: false }), false);
  assert.deepEqual(buildDatabaseSslConfig({ DB_SSL: true }), { rejectUnauthorized: true });
});

test("configured database CA bundle is passed to TLS without disabling verification", () => {
  const directory = mkdtempSync(join(tmpdir(), "securecam-c2-ca-"));
  const file = join(directory, "test-ca.pem");
  // Configuration fixture only: no claim of a successful TLS handshake.
  const bundle = "-----BEGIN CERTIFICATE-----\nconfiguration-fixture\n-----END CERTIFICATE-----\n";
  writeFileSync(file, bundle, "utf8");
  try {
    assert.deepEqual(buildDatabaseSslConfig({ DB_SSL: true, DB_SSL_CA_FILE: file }), {
      rejectUnauthorized: true, ca: bundle,
    });
    unlinkSync(file);
    assert.throws(() => buildDatabaseSslConfig({ DB_SSL: true, DB_SSL_CA_FILE: file }), { code: "ENOENT" });
  } finally {
    // Only exact test-created paths; no recursive cleanup.
    try { unlinkSync(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
    rmdirSync(directory);
  }
});
