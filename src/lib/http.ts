import { NextResponse, type NextRequest } from "next/server";
import { ApiError, type FieldError, problemOf } from "@/lib/errors";
import type { ImageUpload } from "@/lib/types";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { status: init.status ?? 200, headers: { ...NO_STORE, ...init.headers } });
}

export function problemResponse(error: unknown, instance: string) {
  const problem = problemOf(error, instance);
  const headers: Record<string, string> = { ...NO_STORE, "Content-Type": "application/problem+json" };
  if (problem.status === 401) headers["WWW-Authenticate"] = 'Bearer realm="fixsure"';
  return new NextResponse(JSON.stringify(problem), { status: problem.status, headers });
}

/** Wraps a route handler so any thrown error becomes an RFC 9457 problem response. */
export function handler<Ctx>(fn: (request: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (request: NextRequest, ctx: Ctx) => {
    try {
      return await fn(request, ctx);
    } catch (error) {
      return problemResponse(error, request.nextUrl.pathname);
    }
  };
}

function mediaType(request: NextRequest) {
  return (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
}

export async function readForm(request: NextRequest) {
  if (mediaType(request) !== "multipart/form-data") {
    throw new ApiError("unsupported-media-type", "Send this request as multipart/form-data.");
  }
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_PHOTO_BYTES + 64 * 1024) throw new ApiError("payload-too-large", "Use a photo under 5 MB.");
  try {
    return await request.formData();
  } catch {
    throw new ApiError("bad-request", "The multipart body could not be read.");
  }
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  if (mediaType(request) !== "application/json") throw new ApiError("unsupported-media-type", "Send this request as application/json.");
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError("bad-request", "The JSON body is not a valid object.");
  }
}

export function sniffImage(bytes: Buffer): ImageUpload["mime"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Collects field errors so one 422 can report all of them. */
export class Fields {
  readonly errors: FieldError[] = [];

  constructor(private readonly source: FormData | Record<string, unknown>) {}

  private raw(name: string) {
    return this.source instanceof FormData ? this.source.get(name) : this.source[name];
  }

  text(name: string, { min = 0, max }: { min?: number; max: number }, message: string) {
    const value = this.raw(name);
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length < min || text.length > max) this.errors.push({ field: name, message });
    return text.slice(0, max);
  }

  email(name: string) {
    const value = this.raw(name);
    const email = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!email) return undefined;
    if (email.length > 254 || !EMAIL.test(email)) this.errors.push({ field: name, message: "That PayPal email does not look right." });
    return email;
  }

  async photo(name: string): Promise<ImageUpload | null> {
    const file = this.raw(name);
    if (!(file instanceof File) || file.size === 0) {
      this.errors.push({ field: name, message: "Add a photo." });
      return null;
    }
    if (file.size > MAX_PHOTO_BYTES) throw new ApiError("payload-too-large", "Use a photo under 5 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) throw new ApiError("unsupported-media-type", "Use a JPG, PNG, or WebP photo.");
    return { bytes, mime };
  }

  done() {
    if (this.errors.length) throw new ApiError("validation", this.errors[0].message, this.errors);
  }
}
