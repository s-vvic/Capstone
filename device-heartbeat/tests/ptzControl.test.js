import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { reset, token, mac } from "./helpers.js";
test("removed ICD-03 and unversioned/serial routes are unavailable", async () => {
  const app = reset();
  for (const path of [
    "/v1/devices/" + mac + "/ptz",
    "/v1/devices/provision-by-serial",
  ]) {
    const res = await request(app)
      .post(path)
      .set("Authorization", "Bearer " + token())
      .send({});
    assert.equal(res.status, 404);
    assert.equal(res.body.error_code, "NOT_FOUND");
  }
  assert.equal(
    (
      await request(app)
        .get("/devices")
        .set("Authorization", "Bearer " + token())
    ).status,
    404,
  );
});
