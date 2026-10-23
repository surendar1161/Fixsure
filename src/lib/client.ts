import type { FieldError, Problem } from "@/lib/errors";

export class ApiProblem extends Error {
  readonly status: number;
  readonly errors: FieldError[];

  constructor(problem: Partial<Problem>, status: number) {
    super(problem.detail || problem.title || `Request failed (${status}).`);
    this.status = status;
    this.errors = problem.errors ?? [];
  }
}

/** Browser-side caller for /api/v1. Throws ApiProblem with the server's problem details. */
export async function api<T>(
  path: string,
  options: { method?: string; token?: string; json?: unknown; form?: FormData } = {},
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  }

  const response = await fetch(path, { method: options.method ?? "GET", headers, body, credentials: "same-origin" });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new ApiProblem(data ?? {}, response.status);
  return { status: response.status, data: data as T };
}

export function fieldErrors(error: unknown) {
  const map: Record<string, string> = {};
  if (error instanceof ApiProblem) for (const item of error.errors) map[item.field] = item.message;
  return map;
}
