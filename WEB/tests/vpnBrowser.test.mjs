import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createControllerApp } from "../../controller/src/app.js";
import { authService } from "../../user-auth/src/services/authService.js";
import { setInMemoryDriver } from "../../user-auth/src/repositories/index.js";
import { setVpnRepository } from "../../vpn/src/repositories/index.js";
import { InMemoryVpnRepository } from "../../vpn/src/repositories/inMemoryVpnRepository.js";
import { setWireguardDriver } from "../../vpn/src/drivers/index.js";
import { VirtualWireguardDriver } from "../../vpn/src/drivers/virtualWireguardDriver.js";
import { vpnPeerService } from "../../vpn/src/services/vpnPeerService.js";
import { defaultIpPoolManager } from "../../vpn/src/services/ipPoolManager.js";
const binary = process.env.WEB_TEST_BROWSER;
const webRoot = fileURLToPath(new URL("../", import.meta.url));
const dist = path.resolve(webRoot, process.env.WEB_TEST_BUILD_DIR || "dist");
async function until(check, label) {
  for (let i = 0; i < 220; i++) {
    try {
      const value = await check();
      if (value) return value;
    } catch {}
    await delay(100);
  }
  throw new Error("Timed out: " + label);
}
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      const waiter = this.pending.get(message.id);
      if (waiter) {
        this.pending.delete(message.id);
        message.error
          ? waiter.reject(new Error(message.error.message))
          : waiter.resolve(message.result);
      }
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("CDP timeout: " + method));
      }, 5000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  }
}
test(
  "browser: login, inventory, control, recovery, errors and revoked session",
  { skip: !binary, timeout: 60000 },
  async () => {
    assert.ok(fs.existsSync(path.join(dist, "index.html")), "Build WEB first");
    setInMemoryDriver();
    defaultIpPoolManager.clear();
    const repo = new InMemoryVpnRepository();
    const driver = new VirtualWireguardDriver();
    setVpnRepository(repo);
    setWireguardDriver(driver);
    const owner = await authService.register({
      email: "browser-vpn@example.com",
      password: "VpnTest!2026",
      name: "Browser owner",
    });
    await vpnPeerService.registerPeer({
      peer_id: "CAM-BROWSER",
      peer_type: "device",
      name: "Browser camera",
      mac_no: "00:1A:2B:3C:4D:5E",
      user_id: owner.user_id,
    });
    await vpnPeerService.registerPeer({
      peer_id: "CAM-FOREIGN",
      peer_type: "device",
      name: "Foreign camera",
      user_id: "foreign-owner",
    });
    const app = createControllerApp();
    let failRead = false;
    let failAction = false;
    let hangRead = false;
    const server = http.createServer((req, res) => {
      if (req.url.startsWith("/v1/")) {
        if (hangRead && req.url === "/v1/vpn/connections") return;
        if (
          (failRead && req.url === "/v1/vpn/connections") ||
          (failAction && req.url.endsWith("/action"))
        ) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error_code: "SERVICE_UNAVAILABLE",
              message: "VPN unavailable",
            }),
          );
          return;
        }
        return app(req, res);
      }
      const pathname = new URL(req.url, "http://localhost").pathname;
      const file = pathname.startsWith("/assets/")
        ? path.join(dist, pathname)
        : path.join(dist, "index.html");
      if (!file.startsWith(dist + path.sep)) {
        res.writeHead(404);
        res.end();
        return;
      }
      try {
        res.setHeader(
          "Content-Type",
          file.endsWith(".js")
            ? "application/javascript"
            : file.endsWith(".css")
              ? "text/css"
              : "text/html; charset=utf-8",
        );
        res.end(fs.readFileSync(file));
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    const profile = fs.mkdtempSync(
      path.join(os.tmpdir(), "securecam-vpn-browser-"),
    );
    const browser = spawn(
      binary,
      [
        "--headless=new",
        "--disable-gpu",
        "--remote-debugging-port=0",
        "--user-data-dir=" + profile,
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    let ws;
    try {
      const port = await until(() => {
        const f = path.join(profile, "DevToolsActivePort");
        return fs.existsSync(f) && fs.readFileSync(f, "utf8").split("\n")[0];
      }, "browser debug port");
      console.log("Browser debug port ready");
      const pages = await (
        await fetch("http://127.0.0.1:" + port + "/json/list", {
          signal: AbortSignal.timeout(5000),
        })
      ).json();
      const page = pages.find((p) => p.type === "page");
      ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("CDP socket timeout")),
          5000,
        );
        ws.addEventListener(
          "open",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
        ws.addEventListener(
          "error",
          (error) => {
            clearTimeout(timer);
            reject(error);
          },
          { once: true },
        );
      });
      const cdp = new CDP(ws);
      console.log("Browser CDP connected");
      const text = () => cdp.evaluate("document.body.innerText");
      const has = (needle) =>
        until(async () => (await text()).includes(needle), needle);
      const click = (label) =>
        cdp.evaluate(
          `(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)});if(!button||button.disabled)throw new Error('Button unavailable');button.click();})()`,
        );
      await cdp.send("Page.navigate", { url: base + "/login" });
      await has("WEBCAM Login");
      await cdp.evaluate(
        `(()=>{const inputs=document.querySelectorAll('form input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(inputs[0],'browser-vpn@example.com');inputs[0].dispatchEvent(new Event('input',{bubbles:true}));setter.call(inputs[1],'VpnTest!2026');inputs[1].dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
      await click("로그인");
      await until(
        () => cdp.evaluate("location.pathname==='/dashboard'"),
        "login and VPN check",
      );
      await cdp.send("Page.navigate", { url: base + "/vpn-manage" });
      await has("Browser camera");
      assert.equal((await text()).includes("Foreign camera"), false);
      await has("개발용 가상 VPN 상태");
      await until(
        () =>
          cdp.evaluate(
            "!!document.querySelector('button[aria-label=\"Browser camera 연결 해제\"]:not(:disabled)')",
          ),
        "inventory ready",
      );
      await click("Browser camera 연결 해제");
      await has("연결 해제 요청을 처리했습니다.");
      await until(
        () =>
          cdp.evaluate(
            "!!document.querySelector('button[aria-label=\"Browser camera 연결\"]:not(:disabled)')",
          ),
        "disconnect reflected",
      );
      failAction = true;
      await click("Browser camera 연결");
      await has("VPN unavailable");
      assert.equal(
        (await repo.findById("CAM-BROWSER")).vpn_status,
        "disconnected",
      );
      failAction = false;
      await click("Browser camera 연결");
      await has("연결 요청을 처리했습니다.");
      const peer = await repo.findById("CAM-BROWSER");
      driver.simulateTimeout(peer.wg_pubkey);
      await click("새로고침");
      await until(
        () =>
          cdp.evaluate(
            "!!document.querySelector('button[aria-label=\"Browser camera 복구 요청\"]:not(:disabled)')",
          ),
        "error recovery enabled",
      );
      await click("Browser camera 복구 요청");
      await has("복구 요청을 처리했습니다.");
      assert.equal(
        (await driver.getPeer(peer.wg_pubkey)).vpnStatus,
        "connected",
      );
      failRead = true;
      await click("새로고침");
      await has("아래 목록은 마지막으로 조회한 상태입니다.");
      assert.equal((await text()).includes("Foreign camera"), false);
      failRead = false;
      await click("상태 다시 확인");
      await until(
        () => cdp.evaluate("!document.querySelector('.vpn-feedback.error')"),
        "read error cleared",
      );
      // Polling must not restart a slow request every 10s and hide its 15s timeout.
      hangRead = true;
      await click("새로고침");
      await has("VPN 서버 응답 시간이 초과되었습니다.");
      hangRead = false;
      await click("상태 다시 확인");
      await until(
        () => cdp.evaluate("!document.querySelector('.vpn-feedback.error')"),
        "timeout recovered",
      );
      await cdp.evaluate(
        "fetch('/v1/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('accessToken')}}).then(r=>r.status)",
      );
      await click("새로고침");
      await until(
        () => cdp.evaluate("location.pathname==='/login'"),
        "revoked token redirects to login",
      );
    } finally {
      ws?.close();
      browser.kill();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      // Remove only this test-created profile, after verifying its location.
      const target = path.resolve(profile);
      const tempRoot = path.resolve(os.tmpdir()) + path.sep;
      if (
        target.startsWith(tempRoot) &&
        path.basename(target).startsWith("securecam-vpn-browser-")
      ) {
        await delay(400);
        try {
          fs.rmSync(target, {
            recursive: true,
            force: true,
            maxRetries: 5,
            retryDelay: 200,
          });
        } catch {}
      }
    }
  },
);
