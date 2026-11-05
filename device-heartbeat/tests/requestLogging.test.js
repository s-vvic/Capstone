import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { reset, seed, heartbeat, mac, token, deviceRepository } from "./helpers.js";
import { logger } from "../src/utils/logger.js";
import { createControllerApp } from "../../controller/src/app.js";
import { env } from "../src/config/env.js";

let app;
let entries;
beforeEach(() => {
  app = reset();
  entries = [];
  for (const level of ["info", "warn", "error"]) {
    mock.method(logger, level, (...args) => entries.push({ level, args }));
  }
});
afterEach(() => mock.restoreAll());
const matching = (tag) => entries.filter((entry) => entry.args[0].includes(tag));

test("every standalone endpoint logs access and response once with a shared request ID", async () => {
  await seed();
  const calls = [
    ["get", "/health"],
    ["get", "/v1/devices"],
    ["post", "/v1/devices/register", { mac, location: "Room" }],
    ["get", `/v1/devices/${mac}/status`],
    ["patch", `/v1/devices/${mac}`, { name: "Updated" }],
    ["post", "/v1/devices/heartbeat", heartbeat()],
    ["post", "/v1/devices/provision-by-mac", { mac, wg_pubkey: "key", firmware_version: "2", model: "RV-1106" }],
    ["get", "/v1/missing"],
  ];
  for (const [method, path, body] of calls) {
    entries.length = 0;
    const response = await request(app)[method](path).set("Authorization", `Bearer ${token()}`).send(body);
    const incoming = matching("[REQUEST]");
    const completed = matching("[RESPONSE]");
    assert.equal(incoming.length, 1, path);
    assert.equal(completed.length, 1, path);
    assert.equal(incoming[0].args[1].path, path);
    assert.equal(incoming[0].args[1].method, method.toUpperCase());
    assert.equal(incoming[0].args[1].request_id, response.headers["x-request-id"]);
    assert.equal(completed[0].args[1].request_id, response.headers["x-request-id"]);
    assert.equal(completed[0].args[1].status, response.status);
    assert.equal(typeof completed[0].args[1].duration_ms, "number");
  }
});

test("500 logs the original error and stack before the response hides its cause", async () => {
  await seed();
  const cause = Object.assign(new Error("database connection refused"), { code: "ECONNREFUSED" });
  mock.method(deviceRepository, "updateHeartbeat", async () => { throw cause; });
  const response = await request(app).post("/v1/devices/heartbeat").send(heartbeat());
  assert.equal(response.status, 500);
  assert.equal(response.body.error_code, "INTERNAL_SERVER_ERROR");
  const failures = matching("[ERROR]");
  assert.equal(failures.length, 1);
  assert.equal(failures[0].args[1], cause);
  assert.match(failures[0].args[1].stack, /database connection refused/);
  assert.equal(failures[0].args[2].error_code, "ECONNREFUSED");
});

test("controller-mounted C2 logs requests and failures despite using controller error handling", async () => {
  await seed();
  mock.method(deviceRepository, "updateHeartbeat", async () => { throw new Error("PG query failed"); });
  const response = await request(createControllerApp()).post("/v1/devices/heartbeat").send(heartbeat());
  assert.equal(response.status, 500);
  assert.equal(matching("[REQUEST]").length, 1);
  assert.equal(matching("[RESPONSE]").length, 1);
  assert.equal(matching("[ERROR]").length, 1);
  assert.match(matching("[ERROR]")[0].args[1].stack, /PG query failed/);
});

test("malformed JSON is logged before parsing, including in the controller", async () => {
  for (const target of [app, createControllerApp()]) {
    entries.length = 0;
    const response = await request(target).post("/v1/devices/heartbeat").set("Content-Type", "application/json").send("{");
    assert.equal(response.status, 400);
    assert.equal(matching("[REQUEST]").length, 1);
    assert.equal(matching("[REJECTED]").length, 1);
    assert.equal(matching("[RESPONSE]")[0].args[1].status, 400);
  }
});

test("access logs exclude authorization, query string and request body", async () => {
  const secret = "do-not-log-this-secret";
  await request(app).post(`/v1/devices/heartbeat?token=${secret}`).set("Authorization", `Bearer ${secret}`).send({ password: secret });
  assert.equal(JSON.stringify(entries).includes(secret), false);
  assert.equal(matching("[REQUEST]")[0].args[1].path, "/v1/devices/heartbeat");
});

test("server logger includes stack information outside development mode", () => {
  mock.restoreAll();
  const output = [];
  mock.method(console, "error", (...args) => output.push(args));
  const cause = new Error("diagnostic stack");
  const previous = env.NODE_ENV;
  try { env.NODE_ENV = "production"; logger.error("[C2][ERROR] Request failed", cause); }
  finally { env.NODE_ENV = previous; }
  assert.equal(output[0][1].stack, cause.stack);
});
