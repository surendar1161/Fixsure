import { handler, json } from "@/lib/http";
import { createSampleProject } from "@/lib/projects";
import { presentJob } from "@/lib/views";

export const POST = handler(async () => {
  const job = await createSampleProject();
  return json(await presentJob(job, "customer", job.customerKey), { status: 201, headers: { Location: `/api/v1/jobs/${job.id}` } });
});
