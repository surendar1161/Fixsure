import { ApiError } from "@/lib/errors";
import { Fields, handler, json, readForm } from "@/lib/http";
import { createProject } from "@/lib/projects";
import { presentJob } from "@/lib/views";

export const POST = handler(async (request) => {
  const form = await readForm(request);
  const fields = new Fields(form);
  const customerName = fields.text("customerName", { min: 2, max: 80 }, "Add your name.");
  const city = fields.text("city", { min: 2, max: 80 }, "Add a city.");
  const description = fields.text("description", { min: 12, max: 800 }, "Describe the project in a sentence or two.");
  const startDate = fields.text("startDate", { max: 10 }, "Use a start date like 2026-11-02.");
  const image = await fields.photo("photo");
  fields.done();

  let start: Date | undefined;
  if (startDate) {
    start = new Date(`${startDate}T09:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(start.getTime())) {
      throw new ApiError("validation", "Use a start date like 2026-11-02.", [{ field: "startDate", message: "Must be YYYY-MM-DD." }]);
    }
  }

  const job = await createProject({ customerName, city, description, image: image!, start });
  return json(await presentJob(job, "customer", job.customerKey), { status: 201, headers: { Location: `/api/v1/jobs/${job.id}` } });
});
