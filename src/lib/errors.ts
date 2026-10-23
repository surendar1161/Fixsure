export type ProblemType =
  | "bad-request"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "payload-too-large"
  | "unsupported-media-type"
  | "validation"
  | "upstream"
  | "unavailable";

const STATUS: Record<ProblemType, number> = {
  "bad-request": 400,
  unauthorized: 401,
  forbidden: 403,
  "not-found": 404,
  conflict: 409,
  "payload-too-large": 413,
  "unsupported-media-type": 415,
  validation: 422,
  upstream: 502,
  unavailable: 503,
};

const TITLE: Record<ProblemType, string> = {
  "bad-request": "Bad request",
  unauthorized: "Authentication required",
  forbidden: "Not allowed",
  "not-found": "Not found",
  conflict: "Job is in the wrong state",
  "payload-too-large": "Upload too large",
  "unsupported-media-type": "Unsupported media type",
  validation: "Validation failed",
  upstream: "Upstream service failed",
  unavailable: "Not available on this server",
};

export type FieldError = { field: string; message: string };

/** An error that maps to an RFC 9457 problem response. */
export class ApiError extends Error {
  readonly type: ProblemType;
  readonly status: number;
  readonly errors?: FieldError[];

  constructor(type: ProblemType, detail: string, errors?: FieldError[]) {
    super(detail);
    this.type = type;
    this.status = STATUS[type];
    this.errors = errors;
  }
}

export const notFound = () => new ApiError("not-found", "Job not found.");
export const conflict = (detail: string) => new ApiError("conflict", detail);

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: FieldError[];
};

export function problemOf(error: unknown, instance?: string): Problem {
  if (error instanceof ApiError) {
    return {
      type: `/docs#problem-${error.type}`,
      title: TITLE[error.type],
      status: error.status,
      detail: error.message,
      instance,
      errors: error.errors,
    };
  }
  console.error(error);
  return {
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
    detail: "Something went wrong on our side.",
    instance,
  };
}

export function messageOf(error: unknown) {
  if (error instanceof Error && error.message) return error.message.slice(0, 280);
  return "Something went wrong.";
}
