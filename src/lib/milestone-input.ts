import type { Fields } from "@/lib/http";

/** Reads an ISO 8601 date field from a JSON body, recording a field error when it is not one. */
export function readDate(fields: Fields, body: Record<string, unknown>, name: string, required = false) {
  const value = body[name];
  if (value === undefined || value === null || value === "") {
    if (required) fields.errors.push({ field: name, message: "Add a date and time." });
    return undefined;
  }
  const date = typeof value === "string" ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) {
    fields.errors.push({ field: name, message: "Use an ISO 8601 date, like 2026-11-02T09:00:00Z." });
    return undefined;
  }
  return date;
}

export function readAmount(fields: Fields, body: Record<string, unknown>, required = false) {
  const value = body.amountUsd;
  if (value === undefined || value === null) {
    if (required) fields.errors.push({ field: "amountUsd", message: "Add an amount." });
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 10000) {
    fields.errors.push({ field: "amountUsd", message: "Use an amount between 1 and 10000." });
    return undefined;
  }
  return value;
}
