import { randomBytes } from "node:crypto";
import { requireStaff } from "@/lib/auth";
import { CREW_COLORS, readColor } from "@/lib/crew-input";
import { ApiError } from "@/lib/errors";
import { Fields, handler, json, readJson } from "@/lib/http";
import { listCrew, saveCrew } from "@/lib/store";
import { crewRoster, viewCrew } from "@/lib/views";

export const GET = handler(async (request) => {
  requireStaff(request);
  const crew = await crewRoster();
  return json({ data: crew, count: crew.length });
});

export const POST = handler(async (request) => {
  requireStaff(request);
  const body = await readJson(request);
  const fields = new Fields(body);
  const name = fields.text("name", { min: 2, max: 60 }, "Add a name.");
  const trade = fields.text("trade", { min: 2, max: 40 }, "Add a trade, like Plumbing.");
  const email = fields.email("email");
  if (!email) fields.errors.push({ field: "email", message: "Add the PayPal email this crew member is paid at." });
  const color = readColor(fields, body.color);
  fields.done();

  const member = await saveCrew((crew) => {
    if (crew.some((item) => item.email === email)) throw new ApiError("conflict", "A crew member already uses that email.");
    const added = {
      id: crypto.randomUUID(),
      name,
      trade,
      email: email!,
      color: color ?? CREW_COLORS[crew.length % CREW_COLORS.length],
      key: randomBytes(18).toString("base64url"),
    };
    crew.push(added);
    return added;
  });
  return json(viewCrew(member!), { status: 201, headers: { Location: `/api/v1/crew/${member!.id}` } });
});
