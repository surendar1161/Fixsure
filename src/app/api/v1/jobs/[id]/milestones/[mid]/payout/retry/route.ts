import { authorizeMilestone } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { retryMilestonePayout } from "@/lib/projects";
import { presentJob } from "@/lib/views";

type Ctx = { params: Promise<{ id: string; mid: string }> };

export const POST = handler<Ctx>(async (request, { params }) => {
  const { id, mid } = await params;
  const { job } = await authorizeMilestone(request, id, mid, ["staff"]);
  const updated = await retryMilestonePayout(job, mid);
  return json(await presentJob(updated, "staff"));
});
