import { authorizeJob } from "@/lib/auth";
import { Fields, handler, json, readJson } from "@/lib/http";
import { submitSampleProof } from "@/lib/jobs";
import { viewJob } from "@/lib/views";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler<Ctx>(async (request, { params }) => {
  const { job, key } = await authorizeJob(request, (await params).id, ["technician"]);
  const fields = new Fields(await readJson(request));
  const email = fields.email("email");
  fields.done();

  const checked = await submitSampleProof(job, email);
  return json(viewJob(checked, "technician", key), { status: 201, headers: { Location: `/api/v1/jobs/${job.id}/photos/after` } });
});
