import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(
  new URL("../deploy/cloudfront-spa-rewrite.js", import.meta.url),
  "utf8",
);
const rewrite = runInNewContext(`${source}\nhandler;`);

test("CloudFront SPA routes serve index.html while preserving the browser URL query", () => {
  for (const uri of [
    "/",
    "/login",
    "/login/",
    "/vpn-check",
    "/monitoring/CAM-E099",
    "/settings/privacy-zones",
  ]) {
    const request = {
      method: "GET",
      uri,
      querystring: { next: { value: "/dashboard" } },
    };
    const result = rewrite({ request });
    assert.equal(result.uri, "/index.html");
    assert.equal(result.querystring.next.value, "/dashboard");
  }
});

test("SPA rewrite never turns API requests or missing assets into successful HTML", () => {
  for (const [method, uri] of [
    ["POST", "/v1/auth/login"],
    ["GET", "/v1/status"],
    ["GET", "/v1/devices"],
    ["OPTIONS", "/v1/auth/login"],
    ["GET", "/assets/missing.js"],
    ["GET", "/favicon.ico"],
    ["POST", "/login"],
  ]) {
    assert.equal(rewrite({ request: { method, uri } }).uri, uri);
  }
  assert.equal(
    rewrite({ request: { method: "HEAD", uri: "/login" } }).uri,
    "/index.html",
  );
});
