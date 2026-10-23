import { handler, json } from "@/lib/http";
import { createSampleJob } from "@/lib/jobs";
import { viewJob } from "@/lib/views";

export const POST = handler(async () => {
  const job = await createSampleJob();
  return json(viewJob(job, "customer", job.customerKey), { status: 201, headers: { Location: `/api/v1/jobs/${job.id}` } });
});
