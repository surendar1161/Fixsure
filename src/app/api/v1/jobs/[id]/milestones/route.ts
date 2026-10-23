import { authorizeJob } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { Fields, handler, json, readJson } from "@/lib/http";
import { addMilestone } from "@/lib/projects";
import { presentJob } from "@/lib/views";
import { readDate, readAmount } from "@/lib/milestone-input";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (request, { params }) => {
  const { job, role, key } = await authorizeJob(request, (await params).id, ["customer", "staff"]);
  const view = await presentJob(job, role, key);
  if (!view.project) throw new ApiError("not-found", "This job is a single repair and has no milestones.");
  return json({ data: view.project.milestones, progress: view.project.progress });
});

export const POST = handler<Ctx>(async (request, { params }) => {
  const { job } = await authorizeJob(request, (await params).id, ["staff"]);
  const body = await readJson(request);
  const fields = new Fields(body);
  const title = fields.text("title", { min: 2, max: 60 }, "Name the milestone.");
  const detail = fields.text("detail", { min: 4, max: 240 }, "Say what a finished photo shows.");
  const crewId = fields.text("crewId", { min: 1, max: 64 }, "Pick a crew member.");
  const amountUsd = readAmount(fields, body, true)!;
  const startsAt = readDate(fields, body, "startsAt", true)!;
  const endsAt = readDate(fields, body, "endsAt", true)!;
  fields.done();

  const updated = await addMilestone(job, { title, detail, crewId, amountUsd, startsAt, endsAt });
  const added = updated.milestones!.at(-1)!;
  return json(await presentJob(updated, "staff"), { status: 201, headers: { Location: `/api/v1/jobs/${job.id}/milestones/${added.id}` } });
});
