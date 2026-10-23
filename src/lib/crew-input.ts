import type { Fields } from "@/lib/http";

export const CREW_COLORS = ["blue", "teal", "orange", "violet", "green", "red", "pink", "indigo", "lime", "amber"] as const;

export function readColor(fields: Fields, value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value === "string" && (CREW_COLORS as readonly string[]).includes(value)) return value;
  fields.errors.push({ field: "color", message: `Use one of: ${CREW_COLORS.join(", ")}.` });
  return undefined;
}
