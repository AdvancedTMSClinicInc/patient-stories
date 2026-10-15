import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildSeed } from "../lib/seed";
import { createInvitation, verifyInvite, MAX_CODE_ATTEMPTS } from "../lib/invites";
import { appendAudit, verifyAuditChain } from "../lib/audit";
import {
  signAuthorization,
  createTestimonial,
  decideTestimonial,
  revokeAuthorization,
  assertExportable,
  addJournalEntry,
  needsCrisisFlag,
  markTakedown,
  DomainError,
} from "../lib/domain";
import {
  standardTmsDates,
  buildTimeline,
  followUpDates,
  firstFollowUpDate,
  inSpravatoMonitoringWindow,
  spravatoDates,
} from "../lib/protocols";
import { can, inScope } from "../lib/rbac";
import { followUpMessage, sendFollowUp, maskPhone } from "../lib/ghl";
import { addDays, weekday } from "../lib/dates";
import type { DB, TreatmentPlan } from "../lib/types";

const NOW = new Date("2026-10-14T18:00:00Z");

function freshDb(): DB {
  return buildSeed(NOW).db;
}

function inviteFor(db: DB) {
  return createInvitation(
    db,
    {
      firstName: "Test",
      lastName: "Patient",
      phone: "+1 555 010 4321",
      email: null,
      facilityId: "fac-atms",
      locationId: "loc-atms-santee",
      services: ["TMS"],
      purpose: "BOTH",
      protocol: "TMS_STANDARD",
      startDate: "2026-09-21",
    },
    "staff-admin",
    NOW,
  );
}

test("seed has both facilities, six locations with review links, and sample invites", () => {
  const { db, devInvites } = buildSeed(NOW);
  assert.equal(db.facilities.length, 2);
  assert.equal(db.locations.length, 6);
  for (const l of db.locations) assert.match(l.googleReviewUrl, /^https:\/\/g\.page\/r\/.+\/review$/);
  assert.equal(devInvites.length, db.invitations.length);
  assert.ok(devInvites.every((d) => /^\/i\/[A-Za-z0-9_-]{40,}$/.test(d.path) && /^\d{6}$/.test(d.code)));
  assert.equal(verifyAuditChain(db.audit), -1);
});

test("invites store only hashes and verify token + code", () => {
  const db = freshDb();
  const { token, code, invitation } = inviteFor(db);
  assert.ok(!JSON.stringify(db).includes(token));
  assert.notEqual(invitation.codeHash, code);
  const ok = verifyInvite(db, token, code, NOW);
  assert.equal(ok.ok, true);
  assert.equal(verifyInvite(db, "nope", code, NOW).ok, false);
});

test("invites lock after too many wrong codes", () => {
  const db = freshDb();
  const { token, code } = inviteFor(db);
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) verifyInvite(db, token, "000000" === code ? "111111" : "000000", NOW);
  const res = verifyInvite(db, token, code, NOW);
  assert.deepEqual(res, { ok: false, reason: "LOCKED" });
});

test("invites expire", () => {
  const db = freshDb();
  const { token, code } = inviteFor(db);
  const later = new Date(NOW.getTime() + 200 * 86_400_000);
  assert.deepEqual(verifyInvite(db, token, code, later), { ok: false, reason: "EXPIRED" });
});

test("audit chain detects tampering", () => {
  const db = freshDb();
  appendAudit(db, { actorType: "SYSTEM", actorId: "t", action: "X", entity: "e", entityId: "1" }, NOW);
  assert.equal(verifyAuditChain(db.audit), -1);
  db.audit[1].action = "CHANGED";
  assert.equal(verifyAuditChain(db.audit), 1);
});

test("testimonial needs a signed authorization, and revocation withdraws it and blocks export", () => {
  const db = freshDb();
  const { invitation } = inviteFor(db);
  const video = { objectKey: "testimonials/x.webm", mimeType: "video/webm", sizeBytes: 10, sha256: "a", durationS: 75 };
  assert.throws(() => createTestimonial(db, invitation, video, NOW), DomainError);
  assert.throws(
    () => signAuthorization(db, invitation, { channels: [], nameDisplay: "FIRST_NAME", blurFace: false, signedName: "Test Patient", years: 3, agreed: true }, "ip", NOW),
    DomainError,
  );
  const auth = signAuthorization(
    db,
    invitation,
    { channels: ["WEBSITE", "YOUTUBE"], nameDisplay: "FIRST_NAME", blurFace: false, signedName: "Test Patient", years: 3, agreed: true },
    "ip",
    NOW,
  );
  assert.equal(auth.status, "ACTIVE");
  const t = createTestimonial(db, invitation, video, NOW);
  assert.throws(() => decideTestimonial(db, t.id, "REJECT", "", "staff-marketing", NOW), DomainError);
  decideTestimonial(db, t.id, "APPROVE", "", "staff-marketing", NOW);
  assert.equal(assertExportable(db, t.id, NOW).id, t.id);

  const rev = revokeAuthorization(db, auth.id, "APP", { type: "PATIENT", id: invitation.patientId }, NOW);
  assert.equal(db.testimonials.find((x) => x.id === t.id)!.status, "WITHDRAWN");
  assert.throws(() => assertExportable(db, t.id, NOW), DomainError);
  assert.throws(() => decideTestimonial(db, t.id, "APPROVE", "", "staff-marketing", NOW), DomainError);
  assert.deepEqual(rev.takedown.map((x) => x.channel), ["WEBSITE", "YOUTUBE"]);
  markTakedown(db, rev.id, "WEBSITE", "staff-privacy", true, NOW);
  assert.equal(rev.confirmedAt, null);
  markTakedown(db, rev.id, "YOUTUBE", "staff-privacy", true, NOW);
  assert.notEqual(rev.confirmedAt, null);
  assert.equal(verifyAuditChain(db.audit), -1);
});

test("expired authorizations can't be approved", () => {
  const db = freshDb();
  const { invitation } = inviteFor(db);
  signAuthorization(db, invitation, { channels: ["WEBSITE"], nameDisplay: "NONE", blurFace: true, signedName: "Test Patient", years: 1, agreed: true }, "ip", NOW);
  const t = createTestimonial(db, invitation, { objectKey: "testimonials/y.webm", mimeType: "video/webm", sizeBytes: 1, sha256: "b", durationS: 61 }, NOW);
  const later = new Date(NOW.getTime() + 400 * 86_400_000);
  assert.throws(() => decideTestimonial(db, t.id, "APPROVE", "", "staff-marketing", later), DomainError);
});

test("crisis language is flagged", () => {
  assert.equal(needsCrisisFlag("Some days I want to die"), true);
  assert.equal(needsCrisisFlag("Slept better and went for a walk"), false);
  const db = freshDb();
  const { patient, plan } = inviteFor(db);
  const e = addJournalEntry(db, patient.id, plan.id, { body: "thinking about self-harm", mood: 2, sleep: 3, energy: 2, milestone: null, mediaId: null, sharedWithCareTeam: false }, NOW);
  assert.equal(e.flagged, true);
  assert.throws(() => addJournalEntry(db, patient.id, plan.id, { body: "", mood: 5, sleep: 5, energy: 5, milestone: null, mediaId: null, sharedWithCareTeam: false }, NOW));
  assert.throws(() => addJournalEntry(db, patient.id, plan.id, { body: "ok", mood: 11, sleep: 5, energy: 5, milestone: null, mediaId: null, sharedWithCareTeam: false }, NOW));
});

test("standard TMS is 30 weekday sessions plus a 3-2-1 taper", () => {
  const d = standardTmsDates("2026-09-21"); // a Monday
  assert.equal(d.length, 36);
  assert.ok(d.slice(0, 30).every((x) => weekday(x) >= 1 && weekday(x) <= 5));
  assert.equal(d[29], "2026-10-30");
  assert.deepEqual(d.slice(30), ["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-10", "2026-11-12", "2026-11-18"]);
  assert.equal(standardTmsDates("2026-09-19")[0], "2026-09-21"); // Saturday start moves to Monday
});

function plan(protocol: TreatmentPlan["protocol"], startDate: string, sessionsCompleted: number): TreatmentPlan {
  return { id: "p", patientId: "x", facilityId: "fac-atms", locationId: "loc-atms-santee", protocol, startDate, sessionsCompleted, lastSessionAt: null, status: "ACTIVE", createdAt: NOW.toISOString() };
}

test("timelines mark exactly one current phase and the right next check-in", () => {
  const t = buildTimeline(plan("TMS_STANDARD", "2026-09-21", 18), "2026-10-14", new Set(["BEFORE", "S10"]));
  assert.equal(t.phases.filter((p) => p.status === "now").length, 1);
  assert.equal(t.phases.find((p) => p.status === "now")!.key, "daily");
  assert.equal(t.nextCheckin!.milestone, "S20");
  assert.equal(t.summary, "Standard TMS · session 18 of 36");

  const one = buildTimeline(plan("TMS_ONE_DAY", "2026-09-23", 20), "2026-10-14", new Set(["BEFORE", "W2"]));
  assert.equal(one.phases.find((p) => p.status === "now")!.key, "w1-4");
  assert.equal(one.nextCheckin!.milestone, "W4");
  assert.ok(one.patienceNote);

  const sp = buildTimeline(plan("SPRAVATO", "2026-09-27", 5), "2026-10-14", new Set());
  assert.equal(sp.phases.find((p) => p.status === "now")!.key, "induction");
  assert.equal(spravatoDates("2026-09-27").length, 12);

  const acc = buildTimeline(plan("TMS_ACCELERATED", "2026-10-12", 20), "2026-10-14", new Set());
  assert.equal(acc.summary, "Accelerated TMS · day 2 of 5");

  const th = buildTimeline(plan("THERAPY", "2026-09-04", 0), "2026-10-14", new Set());
  assert.equal(th.phases.find((p) => p.status === "now")!.key, "care");
});

test("12-week follow-up dates", () => {
  const std = plan("TMS_STANDARD", "2026-09-21", 36);
  assert.equal(firstFollowUpDate(std), addDays("2026-11-18", 84));
  assert.deepEqual(followUpDates(std, "2026-12-01"), []);
  const one = plan("TMS_ONE_DAY", "2026-01-05", 20);
  assert.deepEqual(followUpDates(one, "2026-12-31"), [addDays("2026-01-05", 84)]);
  const sp = plan("SPRAVATO", "2026-01-05", 30);
  assert.equal(followUpDates(sp, addDays("2026-01-05", 84 * 3)).length, 3);
});

test("Spravato 2-hour monitoring window blocks prompts", () => {
  const p = { ...plan("SPRAVATO", "2026-09-27", 6), lastSessionAt: new Date(NOW.getTime() - 30 * 60_000).toISOString() };
  assert.equal(inSpravatoMonitoringWindow(p, NOW), true);
  assert.equal(inSpravatoMonitoringWindow({ ...p, lastSessionAt: new Date(NOW.getTime() - 3 * 3_600_000).toISOString() }, NOW), false);
  assert.equal(inSpravatoMonitoringWindow({ ...p, protocol: "TMS_STANDARD" }, NOW), false);
});

test("roles keep marketing and clinical apart, and facility scope applies", () => {
  assert.equal(can({ role: "MARKETING_REVIEWER" }, "testimonials.decide"), true);
  assert.equal(can({ role: "MARKETING_REVIEWER" }, "flags.view"), false);
  assert.equal(can({ role: "CLINIC_STAFF" }, "testimonials.decide"), false);
  assert.equal(can({ role: "AUDITOR" }, "testimonials.view"), false);
  assert.equal(inScope({ facilityScope: ["fac-atms"] }, "fac-phs"), false);
  assert.equal(inScope({ facilityScope: [] }, "fac-phs"), true);
});

test("follow-up text is generic and points to the 855 line", () => {
  const msg = followUpMessage({ firstName: "Jordan" }, { protocol: "TMS_STANDARD" });
  assert.match(msg, /\(855\) ILUV-TMS/);
  assert.doesNotMatch(msg, /TMS therapy|depress|Spravato|anxiety/i);
  assert.equal(maskPhone("+1 555 010 4321"), "***-***-4321");
  const db = freshDb();
  const { patient, plan: p } = inviteFor(db);
  const log = sendFollowUp(db, p, patient, "2027-02-10", "staff-clinic-atms", NOW);
  assert.equal(log.via, "GHL_MOCK");
  assert.equal(db.reminders.length, 1);
});

test("uploads must look like real video files", async () => {
  const { looksLikeVideo } = await import("../lib/upload");
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(4)]);
  assert.equal(looksLikeVideo(webm), true);
  assert.equal(looksLikeVideo(mp4), true);
  assert.equal(looksLikeVideo(Buffer.from("<script>alert(1)</script>")), false);
});

test("each role lands on a page it can open", async () => {
  const { homeFor } = await import("../lib/staffnav");
  assert.equal(homeFor({ role: "MARKETING_REVIEWER" }), "/staff/queue");
  assert.equal(homeFor({ role: "CLINIC_STAFF" }), "/staff/invitations");
  assert.equal(homeFor({ role: "AUDITOR" }), "/staff/audit");
});

test("JSON store seeds on first read and persists changes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-"));
  process.env.DATA_DIR = dir;
  const { readDb, mutate, readDevInvites } = await import("../lib/db");
  assert.equal(readDb().locations.length, 6);
  assert.equal(readDevInvites().length, 6);
  mutate((db) => {
    db.locations[0].active = false;
  });
  assert.equal(readDb().locations[0].active, false);
  fs.rmSync(dir, { recursive: true, force: true });
});
