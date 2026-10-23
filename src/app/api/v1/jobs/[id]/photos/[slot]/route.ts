import { authorizeJob } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { handler } from "@/lib/http";
import { readJobImage } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; slot: string }> };

export const GET = handler<Ctx>(async (request, { params }) => {
  const { id, slot } = await params;
  if (slot !== "before" && slot !== "after") throw notFound();
  const { job } = await authorizeJob(request, id, ["customer", "technician", "staff"]);
  const filename = slot === "before" ? job.beforeImage : job.afterImage;
  if (!filename) throw notFound();

  const image = await readJobImage(filename).catch(() => {
    throw notFound();
  });
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
});
