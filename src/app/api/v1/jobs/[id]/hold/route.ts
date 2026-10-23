import { authorizeJob } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { cancelHold, placeHold } from "@/lib/jobs";
import { presentJob } from "@/lib/views";

type Ctx = { params: Promise<{ id: string }> };

/** 200 when the hold is in place, 202 when the customer still has to approve it at `hold.approveUrl`. */
export const POST = handler<Ctx>(async (request, { params }) => {
  const { job, key } = await authorizeJob(request, (await params).id, ["customer"]);
  const result = await placeHold(job);
  return json(await presentJob(result.job, "customer", key), { status: result.approveUrl ? 202 : 200 });
});

export const DELETE = handler<Ctx>(async (request, { params }) => {
  const { job, key } = await authorizeJob(request, (await params).id, ["customer"]);
  return json(await presentJob(await cancelHold(job), "customer", key));
});
