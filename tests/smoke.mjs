// End-to-end smoke test: starts the built app and walks the main patient and
// staff flows over HTTP. Run after `npm run build`:  node tests/smoke.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-smoke-"));

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT), "-H", "127.0.0.1"], {
  env: { ...process.env, DATA_DIR: dataDir, ALLOW_SAMPLE_LOGIN: "1", NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

function cookieFrom(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function req(p, { method = "GET", cookie = "", json, body, headers = {}, redirect = "manual" } = {}) {
  const h = { ...headers };
  if (cookie) h.Cookie = cookie;
  let payload = body;
  if (json !== undefined) {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(json);
  }
  return fetch(BASE + p, { method, headers: h, body: payload, redirect });
}

async function page(p, opts) {
  const r = await req(p, opts);
  // React separates adjacent text with <!-- --> markers; strip them before matching.
  return (await r.text()).replace(/<!-- -->/g, "");
}

const steps = [];
async function step(name, fn) {
  try {
    await fn();
    steps.push(`ok   ${name}`);
  } catch (e) {
    steps.push(`FAIL ${name}: ${e.message}`);
    throw e;
  }
}

async function main() {
  // Wait for the server.
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + "/");
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  let invites;
  await step("home page renders and seeds sample data", async () => {
    const r = await req("/");
    assert.equal(r.status, 200);
    // The home page is static; the first page that reads data creates the sample data.
    assert.equal((await req("/staff/login")).status, 200);
    invites = JSON.parse(fs.readFileSync(path.join(dataDir, "dev-invites.json"), "utf8"));
    assert.equal(invites.length, 6);
  });
  const jordan = invites.find((i) => i.patient.startsWith("Jordan"));
  const token = jordan.path.split("/").pop();

  await step("sample patient page is hidden in production", async () => {
    assert.equal((await req("/dev")).status, 404);
  });

  await step("invite page renders", async () => {
    const r = await req(jordan.path);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /6-digit code/);
  });

  await step("wrong code is rejected", async () => {
    const wrong = jordan.code === "000000" ? "111111" : "000000";
    const r = await req("/api/patient/verify", { method: "POST", json: { token, code: wrong } });
    assert.equal(r.status, 401);
  });

  let pc = "";
  await step("correct code signs the patient in", async () => {
    const r = await req("/api/patient/verify", { method: "POST", json: { token, code: jordan.code } });
    assert.equal(r.status, 200);
    pc = cookieFrom(r);
    assert.ok(pc.includes("ps_session="));
  });

  await step("patient pages need a session", async () => {
    const r = await req("/p");
    assert.equal(r.status, 307);
    assert.match(r.headers.get("location") ?? "", /\/expired/);
  });

  await step("welcome page shows the patient's details", async () => {
    const html = await page("/p", { cookie: pc });
    assert.match(html, /Hi Jordan/);
    assert.match(html, /Santee/);
    assert.match(html, /advanced-tms\.png/);
  });

  await step("video can't be submitted before signing", async () => {
    const r = await req("/api/patient/testimonial", { method: "POST", cookie: pc, body: fakeWebm(), headers: { "Content-Type": "video/webm", "X-Duration-Seconds": "75" } });
    assert.equal(r.status, 403);
  });

  await step("authorization form renders and validates", async () => {
    assert.equal((await req("/p/authorize", { cookie: pc })).status, 200);
    const r = await req("/api/patient/authorization", { method: "POST", cookie: pc, json: { channels: [], nameDisplay: "FIRST_NAME", signedName: "Jordan Sample", agreed: true, years: 3 } });
    assert.equal(r.status, 400);
  });

  await step("patient signs the authorization", async () => {
    const r = await req("/api/patient/authorization", {
      method: "POST",
      cookie: pc,
      json: { channels: ["WEBSITE", "YOUTUBE"], nameDisplay: "FIRST_NAME", blurFace: false, signedName: "Jordan Sample", agreed: true, years: 3 },
    });
    assert.equal(r.status, 200, await r.text());
  });

  await step("non-video uploads are refused", async () => {
    const r = await req("/api/patient/testimonial", { method: "POST", cookie: pc, body: "not a video at all, just text", headers: { "Content-Type": "video/webm", "X-Duration-Seconds": "75" } });
    assert.equal(r.status, 415);
  });

  let testimonialId = "";
  await step("patient uploads a video", async () => {
    const r = await req("/api/patient/testimonial", { method: "POST", cookie: pc, body: fakeWebm(), headers: { "Content-Type": "video/webm", "X-Duration-Seconds": "75" } });
    const data = await r.json();
    assert.equal(r.status, 200, JSON.stringify(data));
    testimonialId = data.id;
  });

  await step("thank-you page shows the Santee Google review link", async () => {
    const html = await page("/p/thanks", { cookie: pc });
    assert.match(html, /g\.page\/r\/CUhBp4jzSifYEAE\/review/);
  });

  await step("record, permission, journal, timeline and check-in pages render", async () => {
    for (const p of ["/p/record", "/p/permission", "/p/journal", "/p/journal/new", "/p/timeline", "/p/checkin?m=S20"]) {
      const r = await req(p, { cookie: pc });
      assert.equal(r.status, 200, `${p} -> ${r.status}`);
    }
    const tl = await page("/p/timeline", { cookie: pc });
    assert.match(tl, /Standard TMS · session 18 of 36/);
  });

  await step("patient adds a journal entry; crisis words are flagged", async () => {
    let r = await req("/api/patient/journal", { method: "POST", cookie: pc, json: { body: "Slept better this week.", mood: 6, sleep: 7, energy: 5, milestone: "S20" } });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).flagged, false);
    r = await req("/api/patient/journal", { method: "POST", cookie: pc, json: { body: "Some days I want to die.", mood: 2, sleep: 3, energy: 2 } });
    assert.equal((await r.json()).flagged, true);
  });

  const login = async (staffId) => {
    const r = await req("/api/staff/login", { method: "POST", json: { staffId } });
    assert.equal(r.status, 200);
    return cookieFrom(r);
  };

  let mk = "";
  await step("marketing reviewer sees the video in the queue", async () => {
    mk = await login("staff-marketing");
    const html = await page("/staff/queue", { cookie: mk });
    assert.match(html, /Jordan S\./);
  });

  await step("marketing can't open clinical pages", async () => {
    const r = await req("/staff/flags", { cookie: mk });
    assert.equal(r.status, 307);
    assert.match(r.headers.get("location") ?? "", /\/staff\/forbidden/);
  });

  await step("video review page and streaming (range requests) work", async () => {
    assert.equal((await req(`/staff/testimonials/${testimonialId}`, { cookie: mk })).status, 200);
    const r = await req(`/api/staff/video/${testimonialId}`, { cookie: mk, headers: { Range: "bytes=0-9" } });
    assert.equal(r.status, 206);
    assert.equal((await r.arrayBuffer()).byteLength, 10);
    assert.equal((await req(`/api/staff/video/${testimonialId}`)).status, 401);
  });

  await step("export is blocked before approval, allowed after", async () => {
    assert.equal((await req(`/api/staff/export/${testimonialId}`, { cookie: mk })).status, 409);
    const d = await req(`/api/staff/testimonials/${testimonialId}/decision`, { method: "POST", cookie: mk, json: { decision: "APPROVE", reason: "" } });
    assert.equal(d.status, 200);
    const ex = await req(`/api/staff/export/${testimonialId}`, { cookie: mk });
    assert.equal(ex.status, 200);
    assert.match(ex.headers.get("content-disposition") ?? "", /attachment/);
  });

  await step("patient revokes; export is blocked and a takedown list appears", async () => {
    const db = JSON.parse(fs.readFileSync(path.join(dataDir, "db.json"), "utf8"));
    const auth = db.authorizations.find((a) => a.status === "ACTIVE");
    const r = await req("/api/patient/authorization/revoke", { method: "POST", cookie: pc, json: { authorizationId: auth.id } });
    assert.equal(r.status, 200);
    assert.equal((await req(`/api/staff/export/${testimonialId}`, { cookie: mk })).status, 409);
    const po = await login("staff-privacy");
    const html = await page("/staff/authorizations", { cookie: po });
    assert.match(html, /Takedown open/);
  });

  await step("clinic staff (Advanced TMS only) see only their facility", async () => {
    const cs = await login("staff-clinic-atms");
    const inv = await page("/staff/invitations", { cookie: cs });
    assert.match(inv, /Jordan/);
    assert.doesNotMatch(inv, /Maria Sample/);
    const flags = await page("/staff/flags", { cookie: cs });
    assert.match(flags, /want to die/);
  });

  await step("clinic staff create an invitation", async () => {
    const cs = await login("staff-clinic-atms");
    const r = await req("/api/staff/invitations", {
      method: "POST",
      cookie: cs,
      json: { firstName: "Casey", lastName: "Test", phone: "+1 555 0100", facilityId: "fac-atms", locationId: "loc-atms-ocean", services: ["TMS"], purpose: "BOTH", protocol: "TMS_ONE_DAY", startDate: "2026-10-01" },
    });
    const data = await r.json();
    assert.equal(r.status, 200, JSON.stringify(data));
    assert.match(data.path, /^\/i\//);
    assert.match(data.code, /^\d{6}$/);
    const denied = await req("/api/staff/invitations", {
      method: "POST",
      cookie: cs,
      json: { firstName: "No", lastName: "Access", facilityId: "fac-phs", locationId: "loc-phs-ocean", services: ["THERAPY"], purpose: "BOTH", protocol: "THERAPY", startDate: "2026-10-01" },
    });
    assert.equal(denied.status, 403);
  });

  await step("12-week follow-up is due for the finished patient and sends in test mode", async () => {
    const cs = await login("staff-clinic-atms");
    const html = await page("/staff/followups", { cookie: cs });
    assert.match(html, /Taylor/);
    assert.match(html, /ILUV-TMS/);
    const db = JSON.parse(fs.readFileSync(path.join(dataDir, "db.json"), "utf8"));
    const taylor = db.patients.find((p) => p.firstName === "Taylor");
    const plan = db.treatmentPlans.find((p) => p.patientId === taylor.id);
    // The due date is in the page's button props; fall back to trying recent dates.
    const m = html.match(/dueOn\\?":\\?"(\d{4}-\d{2}-\d{2})/);
    let sent = false;
    if (m) sent = (await req(`/api/staff/followups/${plan.id}/send`, { method: "POST", cookie: cs, json: { dueOn: m[1] } })).status === 200;
    for (let back = 0; back < 60 && !sent; back++) {
      const d = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
      const r = await req(`/api/staff/followups/${plan.id}/send`, { method: "POST", cookie: cs, json: { dueOn: d } });
      if (r.status === 200) sent = true;
    }
    assert.ok(sent, "follow-up could not be sent");
  });

  await step("auditor sees an intact audit chain", async () => {
    const au = await login("staff-auditor");
    const html = await page("/staff/audit", { cookie: au });
    assert.match(html, /Chain verified/);
    assert.equal((await req("/staff/queue", { cookie: au })).status, 307);
  });
}

function fakeWebm() {
  // EBML header + filler: enough to pass the format check and test streaming.
  return Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(4096, 7)]);
}

main()
  .then(() => {
    console.log(steps.join("\n"));
    console.log(`\nAll ${steps.length} smoke steps passed.`);
  })
  .catch((e) => {
    console.log(steps.join("\n"));
    console.error("\nSmoke test failed:", e);
    console.error("\n--- server log ---\n" + serverLog.slice(-4000));
    if (process.env.GITHUB_ACTIONS) {
      // Surface the details as a check annotation as well as in the log.
      const esc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "").replace(/\n/g, "%0A");
      console.log(`::error title=Smoke test failed::${esc(steps.join("\n") + "\n\n" + (e?.stack ?? e) + "\n\nSERVER LOG:\n" + serverLog.slice(-3000))}`);
    }
    process.exitCode = 1;
  })
  .finally(() => {
    server.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
