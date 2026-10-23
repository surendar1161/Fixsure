import { authorizeJob } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { voidJob } from "@/lib/jobs";
import { presentJob } from "@/lib/views";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler<Ctx>(async (request, { params }) => {
  const { job } = await authorizeJob(request, (await params).id, ["staff"]);
  return json(await presentJob(await voidJob(job), "staff"));
});
