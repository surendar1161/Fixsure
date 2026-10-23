import { authorizeMilestone } from "@/lib/auth";
import { Fields, handler, json, readJson } from "@/lib/http";
import { rejectMilestone } from "@/lib/projects";
import { presentJob } from "@/lib/views";

type Ctx = { params: Promise<{ id: string; mid: string }> };

export const POST = handler<Ctx>(async (request, { params }) => {
  const { id, mid } = await params;
  const { job } = await authorizeMilestone(request, id, mid, ["staff"]);
  const fields = new Fields(await readJson(request));
  const note = fields.text("note", { min: 4, max: 300 }, "Tell the crew what to fix, in a sentence.");
  fields.done();
  const updated = await rejectMilestone(job, mid, note);
  return json(await presentJob(updated, "staff"));
});
