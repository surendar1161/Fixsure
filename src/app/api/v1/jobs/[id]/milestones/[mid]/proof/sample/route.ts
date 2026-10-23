import { authorizeMilestone } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { submitSampleMilestoneProof } from "@/lib/projects";
import { listCrew } from "@/lib/store";
import { viewMilestone } from "@/lib/views";

type Ctx = { params: Promise<{ id: string; mid: string }> };

export const POST = handler<Ctx>(async (request, { params }) => {
  const { id, mid } = await params;
  const { job, crew, key } = await authorizeMilestone(request, id, mid, ["crew"]);
  const checked = await submitSampleMilestoneProof(job, mid);
  const milestone = checked.milestones!.find((item) => item.id === mid)!;
  return json(viewMilestone(checked, milestone, await listCrew(), { role: "crew", key, crewId: crew!.id }), {
    status: 201,
    headers: { Location: `/api/v1/jobs/${id}/milestones/${mid}/photos/proof` },
  });
});
