import { authorizeJob } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { presentJob } from "@/lib/views";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (request, { params }) => {
  const { job, role, key } = await authorizeJob(request, (await params).id, ["customer", "technician", "staff"]);
  return json(await presentJob(job, role, key));
});
