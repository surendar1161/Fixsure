import { requireCrew } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { crewAssignments } from "@/lib/views";

/** A crew member's own milestones, by their crew key. */
export const GET = handler(async (request) => {
  const crew = await requireCrew(request);
  return json(await crewAssignments(crew));
});
