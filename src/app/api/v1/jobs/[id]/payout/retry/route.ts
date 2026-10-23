import { authorizeJob } from "@/lib/auth";
import { Fields, handler, json, readJson } from "@/lib/http";
import { retryPayout } from "@/lib/jobs";
import { viewJob } from "@/lib/views";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler<Ctx>(async (request, { params }) => {
  const { job } = await authorizeJob(request, (await params).id, ["staff"]);
  const fields = new Fields(await readJson(request));
  const email = fields.email("email");
  fields.done();
  return json(viewJob(await retryPayout(job, email), "staff"));
});
