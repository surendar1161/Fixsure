import { cookies } from "next/headers";
import { isStaffKey, STAFF_COOKIE, staffKeyConfigured } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { Fields, handler, readJson } from "@/lib/http";

/** Staff sign-in for the browser desks. API clients send the staff key as a Bearer token instead. */
export const POST = handler(async (request) => {
  const fields = new Fields(await readJson(request));
  const key = fields.text("key", { min: 1, max: 200 }, "Enter the staff key.");
  fields.done();
  if (!staffKeyConfigured()) throw new ApiError("conflict", "Set FIXSURE_STAFF_KEY on the server to protect the desks.");
  if (!isStaffKey(key)) throw new ApiError("unauthorized", "That staff key is not right.");

  (await cookies()).set(STAFF_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return new Response(null, { status: 204 });
});

export const DELETE = handler(async () => {
  (await cookies()).delete(STAFF_COOKIE);
  return new Response(null, { status: 204 });
});
