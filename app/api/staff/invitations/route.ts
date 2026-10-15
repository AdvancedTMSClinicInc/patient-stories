import { appendDevInvite, mutate } from "@/lib/db";
import { createInvitation } from "@/lib/invites";
import { DomainError } from "@/lib/domain";
import { inScope } from "@/lib/rbac";
import { isValidDay } from "@/lib/dates";
import { PROTOCOL_LABELS, SERVICE_LABELS, type InvitePurpose, type ProtocolCode, type ServiceCode } from "@/lib/types";
import { handle, json, readJson, staffOr401 } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const staff = await staffOr401("invites.manage");
    if (staff instanceof Response) return staff;
    const b = await readJson<Record<string, unknown>>(req);
    const str = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const firstName = str(b.firstName);
    const lastName = str(b.lastName);
    if (!firstName || !lastName) throw new DomainError("First and last name are required.");
    const services = (Array.isArray(b.services) ? b.services : []).filter((s): s is ServiceCode => typeof s === "string" && s in SERVICE_LABELS);
    if (services.length === 0) throw new DomainError("Pick at least one service.");
    const purpose = str(b.purpose) as InvitePurpose;
    if (!["TESTIMONIAL", "JOURNAL", "BOTH"].includes(purpose)) throw new DomainError("Choose what to invite them to.");
    const protocol = str(b.protocol) as ProtocolCode;
    if (!(protocol in PROTOCOL_LABELS)) throw new DomainError("Choose a treatment plan.");
    const startDate = str(b.startDate);
    if (!isValidDay(startDate)) throw new DomainError("Enter a valid start date.");

    const result = mutate((db) => {
      const location = db.locations.find((l) => l.id === b.locationId && l.active);
      if (!location || location.facilityId !== b.facilityId) throw new DomainError("Pick a location for that facility.");
      if (!inScope(staff, location.facilityId)) throw new DomainError("You can't invite patients for that facility.", 403);
      const r = createInvitation(
        db,
        { firstName, lastName, phone: str(b.phone, 30) || null, email: str(b.email, 120) || null, facilityId: location.facilityId, locationId: location.id, services, purpose, protocol, startDate },
        staff.id,
      );
      return { r, facility: db.facilities.find((f) => f.id === location.facilityId)!.name, location: location.name };
    });
    const path = `/i/${result.r.token}`;
    if (process.env.NODE_ENV !== "production") {
      appendDevInvite({ patient: `${firstName} ${lastName}`, facility: result.facility, location: result.location, plan: PROTOCOL_LABELS[protocol], path, code: result.r.code });
    }
    return json({ ok: true, path, code: result.r.code, expiresAt: result.r.invitation.expiresAt });
  });
}
