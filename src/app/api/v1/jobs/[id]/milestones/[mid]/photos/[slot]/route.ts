import { authorizeMilestone } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { handler } from "@/lib/http";
import { readJobImage } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; mid: string; slot: string }> };

/** `site` is the project's starting photo; `proof` is this milestone's photo. */
export const GET = handler<Ctx>(async (request, { params }) => {
  const { id, mid, slot } = await params;
  if (slot !== "site" && slot !== "proof") throw notFound();
  const { job, milestone } = await authorizeMilestone(request, id, mid, ["customer", "crew", "staff"]);
  const filename = slot === "site" ? job.beforeImage : milestone.proofImage;
  if (!filename) throw notFound();

  const image = await readJobImage(filename).catch(() => {
    throw notFound();
  });
  return new Response(new Uint8Array(image.bytes), {
    headers: { "Content-Type": image.mime, "Cache-Control": "private, no-store", "Content-Disposition": "inline" },
  });
});
