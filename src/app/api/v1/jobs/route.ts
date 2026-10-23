import { requireStaff } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { Fields, handler, json, readForm } from "@/lib/http";
import { createJob } from "@/lib/jobs";
import { listJobs } from "@/lib/store";
import { JOB_STATUSES, type JobStatus } from "@/lib/types";
import { viewJob, viewRow } from "@/lib/views";

export const GET = handler(async (request) => {
  requireStaff(request);
  const filter = request.nextUrl.searchParams.get("status");
  const wanted = filter ? filter.split(",").map((value) => value.trim()) : null;
  if (wanted?.some((value) => !JOB_STATUSES.includes(value as JobStatus))) {
    throw new ApiError("bad-request", `status must be a comma-separated list of: ${JOB_STATUSES.join(", ")}.`);
  }
  const rows = (await listJobs()).filter((job) => !wanted || wanted.includes(job.status)).map(viewRow);
  return json({ data: rows, count: rows.length });
});

export const POST = handler(async (request) => {
  const fields = new Fields(await readForm(request));
  const customerName = fields.text("customerName", { min: 2, max: 80 }, "Add your name.");
  const city = fields.text("city", { min: 2, max: 80 }, "Add a city.");
  const description = fields.text("description", { min: 8, max: 500 }, "Describe the problem in a sentence.");
  const image = await fields.photo("photo");
  fields.done();

  const job = await createJob({ customerName, city, description, image: image! });
  return json(viewJob(job, "customer", job.customerKey), { status: 201, headers: { Location: `/api/v1/jobs/${job.id}` } });
});
