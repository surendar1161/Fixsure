import { requireStaff } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { scheduleData } from "@/lib/views";

/** Resources and events in the shape the Bryntum Scheduler loads directly. */
export const GET = handler(async (request) => {
  requireStaff(request);
  return json(await scheduleData());
});
