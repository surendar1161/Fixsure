import { integrations } from "@/lib/config";
import { json } from "@/lib/http";

export function GET() {
  return json({ status: "ok", version: "v1", integrations: integrations(), time: new Date().toISOString() });
}
