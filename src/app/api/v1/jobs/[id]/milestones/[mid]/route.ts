import { authorizeMilestone } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { Fields, handler, json, readJson } from "@/lib/http";
import { readAmount, readDate } from "@/lib/milestone-input";
import { updateMilestone } from "@/lib/projects";
import { listCrew } from "@/lib/store";
import { VERIFICATION_MODES, type VerificationMode } from "@/lib/types";
import { viewMilestone } from "@/lib/views";

type Ctx = { params: Promise<{ id: string; mid: string }> };

export const GET = handler<Ctx>(async (request, { params }) => {
  const { id, mid } = await params;
  const { job, milestone, role, crew, key } = await authorizeMilestone(request, id, mid, ["customer", "crew", "staff"]);
  return json(viewMilestone(job, milestone, await listCrew(), { role, key, crewId: crew?.id }));
});

export const PATCH = handler<Ctx>(async (request, { params }) => {
  const { id, mid } = await params;
  const { job } = await authorizeMilestone(request, id, mid, ["staff"]);
  const body = await readJson(request);
  const fields = new Fields(body);
  const crewId = body.crewId === undefined ? undefined : fields.text("crewId", { min: 1, max: 64 }, "Pick a crew member.");
  const title = body.title === undefined ? undefined : fields.text("title", { min: 2, max: 60 }, "Name the milestone.");
  const startsAt = readDate(fields, body, "startsAt");
  const endsAt = readDate(fields, body, "endsAt");
  const amountUsd = readAmount(fields, body);
  let verification: VerificationMode | undefined;
  if (body.verification !== undefined) {
    if (VERIFICATION_MODES.includes(body.verification as VerificationMode)) verification = body.verification as VerificationMode;
    else fields.errors.push({ field: "verification", message: `Use one of: ${VERIFICATION_MODES.join(", ")}.` });
  }
  fields.done();
  if ([crewId, title, startsAt, endsAt, amountUsd, verification].every((value) => value === undefined)) {
    throw new ApiError("bad-request", "Send at least one of crewId, title, startsAt, endsAt, amountUsd, verification.");
  }

  const updated = await updateMilestone(job, mid, { crewId, title, startsAt, endsAt, amountUsd, verification });
  const milestone = updated.milestones!.find((item) => item.id === mid)!;
  return json(viewMilestone(updated, milestone, await listCrew(), { role: "staff" }));
});
