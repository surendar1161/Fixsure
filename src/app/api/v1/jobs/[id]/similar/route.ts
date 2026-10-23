import { authorizeJob } from "@/lib/auth";
import { similarJobs } from "@/lib/elastic";
import { handler, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (request, { params }) => {
  const { job } = await authorizeJob(request, (await params).id, ["staff"]);
  return json(await similarJobs(job));
});
