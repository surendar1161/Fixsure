import { requireStaff } from "@/lib/auth";
import { readColor } from "@/lib/crew-input";
import { ApiError, notFound } from "@/lib/errors";
import { Fields, handler, json, readJson } from "@/lib/http";
import { getCrew, listJobs, saveCrew } from "@/lib/store";
import { viewCrew } from "@/lib/views";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (request, { params }) => {
  requireStaff(request);
  const member = await getCrew((await params).id);
  if (!member) throw notFound();
  return json(viewCrew(member, await listJobs()));
});

export const PATCH = handler<Ctx>(async (request, { params }) => {
  requireStaff(request);
  const { id } = await params;
  const body = await readJson(request);
  const fields = new Fields(body);
  const name = body.name === undefined ? undefined : fields.text("name", { min: 2, max: 60 }, "Add a name.");
  const trade = body.trade === undefined ? undefined : fields.text("trade", { min: 2, max: 40 }, "Add a trade, like Plumbing.");
  const email = body.email === undefined ? undefined : fields.email("email");
  if (body.email !== undefined && !email) fields.errors.push({ field: "email", message: "Add the PayPal email this crew member is paid at." });
  const color = readColor(fields, body.color);
  fields.done();
  if ([name, trade, email, color].every((value) => value === undefined)) {
    throw new ApiError("bad-request", "Send at least one of name, trade, email, color.");
  }

  const member = await saveCrew((crew) => {
    const target = crew.find((item) => item.id === id);
    if (!target) throw notFound();
    if (email && crew.some((item) => item.id !== id && item.email === email)) throw new ApiError("conflict", "A crew member already uses that email.");
    Object.assign(target, { ...(name && { name }), ...(trade && { trade }), ...(email && { email }), ...(color && { color }) });
    return target;
  });
  return json(viewCrew(member!));
});
