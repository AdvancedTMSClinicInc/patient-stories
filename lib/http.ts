import { NextResponse } from "next/server";
import { DomainError } from "./domain";
import { getPatientContext, getStaff, type PatientContext } from "./session";
import { can, type Permission } from "./rbac";
import type { StaffUser } from "./types";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400): NextResponse {
  return json({ error: message }, status);
}

/** Runs a handler and turns DomainErrors into friendly JSON errors. */
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DomainError) return fail(e.message, e.status);
    console.error(e);
    return fail("Something went wrong. Please try again.", 500);
  }
}

export async function patientOr401(): Promise<PatientContext | NextResponse> {
  const ctx = await getPatientContext();
  return ctx ?? fail("Your session has ended. Please open your invitation link again.", 401);
}

export async function staffOr401(perm: Permission): Promise<StaffUser | NextResponse> {
  const staff = await getStaff();
  if (!staff) return fail("Please sign in.", 401);
  if (!can(staff, perm)) return fail("You don't have access to this.", 403);
  return staff;
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new DomainError("Invalid request.");
  }
}
