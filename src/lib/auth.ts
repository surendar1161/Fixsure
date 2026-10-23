import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { ApiError, notFound } from "@/lib/errors";
import { getJob, listCrew } from "@/lib/store";
import type { CrewMember, Job } from "@/lib/types";

export type Role = "customer" | "technician" | "staff";

export const STAFF_COOKIE = "fixsure_staff";

export function sameKey(given: string | null | undefined, expected: string | null | undefined) {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function staffKeyConfigured() {
  return Boolean(process.env.FIXSURE_STAFF_KEY);
}

/** Without a staff key the desks are open, but only in development. */
export function staffDeskOpen() {
  return !staffKeyConfigured() && process.env.NODE_ENV !== "production";
}

export function isStaffKey(key: string | null | undefined) {
  return sameKey(key, process.env.FIXSURE_STAFF_KEY);
}

/** For server components: is the staff cookie valid? */
export async function hasStaffSession() {
  if (staffDeskOpen()) return true;
  return isStaffKey((await cookies()).get(STAFF_COOKIE)?.value);
}

/** For server components: which role does a `?k=` link key grant on this job? */
export function roleForKey(job: Job, key: string | null | undefined): Role | null {
  if (sameKey(key, job.customerKey)) return "customer";
  if (sameKey(key, job.techKey)) return "technician";
  return null;
}

function bearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1].trim();
  // <img> tags cannot send headers, so photo reads also accept ?k=.
  if (request.method === "GET") return request.nextUrl.searchParams.get("k");
  return null;
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Cookie auth only counts for safe methods or same-origin writes, which blocks CSRF. */
function staffCookie(request: NextRequest) {
  const safe = request.method === "GET" || request.method === "HEAD";
  if (!safe && !sameOrigin(request)) return false;
  if (staffDeskOpen()) return true;
  return isStaffKey(request.cookies.get(STAFF_COOKIE)?.value);
}

export function unauthorized() {
  return new ApiError("unauthorized", "Send `Authorization: Bearer <key>` with a job key or the staff key.");
}

export function requireStaff(request: NextRequest) {
  const token = bearerToken(request);
  if (isStaffKey(token) || (!token && staffCookie(request))) return;
  if (!token && !request.cookies.has(STAFF_COOKIE)) throw unauthorized();
  throw new ApiError("forbidden", token ? "This endpoint needs the staff key." : "The staff session is invalid, or this cross-site request cannot use it.");
}

/**
 * Loads a job and checks that the caller holds one of `allowed` roles on it.
 * A key that does not belong to the job gets a 404, so job ids cannot be probed.
 */
export async function authorizeJob(request: NextRequest, id: string, allowed: Role[]) {
  const token = bearerToken(request);
  const cookieStaff = !token && staffCookie(request);
  if (!token && !cookieStaff) {
    if (request.cookies.has(STAFF_COOKIE)) throw new ApiError("forbidden", "The staff session is invalid, or this cross-site request cannot use it.");
    throw unauthorized();
  }

  const job = await getJob(id);
  if (!job) throw notFound();

  const role: Role | null = isStaffKey(token) || cookieStaff ? "staff" : roleForKey(job, token);
  if (!role) throw notFound();
  if (!allowed.includes(role)) throw new ApiError("forbidden", `A ${role} cannot do this on a job.`);
  return { job, role, key: role === "staff" ? undefined : token ?? undefined };
}

export type MilestoneRole = "customer" | "crew" | "staff";

export async function crewForKey(key: string | null | undefined) {
  if (!key) return null;
  return (await listCrew()).find((member) => sameKey(key, member.key)) ?? null;
}

/** A crew key only reaches milestones booked to that crew member. */
export async function authorizeMilestone(request: NextRequest, id: string, milestoneId: string, allowed: MilestoneRole[]) {
  const token = bearerToken(request);
  const cookieStaff = !token && staffCookie(request);
  if (!token && !cookieStaff) {
    if (request.cookies.has(STAFF_COOKIE)) throw new ApiError("forbidden", "The staff session is invalid, or this cross-site request cannot use it.");
    throw unauthorized();
  }

  const job = await getJob(id);
  const milestone = job?.milestones?.find((item) => item.id === milestoneId);
  if (!job || !milestone) throw notFound();

  let role: MilestoneRole | null = null;
  let crew: CrewMember | null = null;
  if (isStaffKey(token) || cookieStaff) role = "staff";
  else if (sameKey(token, job.customerKey)) role = "customer";
  else {
    crew = await crewForKey(token);
    if (crew && crew.id === milestone.crewId) role = "crew";
  }
  if (!role) throw notFound();
  if (!allowed.includes(role)) throw new ApiError("forbidden", `A ${role === "crew" ? "crew member" : role} cannot do this on a milestone.`);
  return { job, milestone, role, crew, key: role === "staff" ? undefined : (token ?? undefined) };
}

export async function requireCrew(request: NextRequest) {
  const token = bearerToken(request);
  if (!token) throw new ApiError("unauthorized", "Send `Authorization: Bearer <key>` with your crew key.");
  const crew = await crewForKey(token);
  if (!crew) throw new ApiError("unauthorized", "That crew key is not valid.");
  return crew;
}

/** Staff, by key or same-origin cookie, or a crew member by their own key. */
export async function requireStaffOrCrew(request: NextRequest) {
  const token = bearerToken(request);
  if (isStaffKey(token) || (!token && staffCookie(request))) return { role: "staff" as const, crew: null };
  const crew = await crewForKey(token);
  if (crew) return { role: "crew" as const, crew };
  requireStaff(request);
  throw unauthorized();
}
