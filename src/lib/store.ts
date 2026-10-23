import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "@/lib/errors";
import { randomBytes } from "node:crypto";
import type { CrewMember, ImageUpload, Job } from "@/lib/types";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const IMAGE_DIR = path.join(DATA_DIR, "images");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const CREW_FILE = path.join(DATA_DIR, "crew.json");

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_PATTERN = /^[0-9a-f-]{36}-(before|after|m-[a-z0-9]{8})\.(jpg|png|webp)$/i;

export type ImageSlot = "before" | "after" | `m-${string}`;

let queue: Promise<unknown> = Promise.resolve();

// One writer at a time. This store assumes a single server instance.
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readJobsFile(): Promise<Job[]> {
  try {
    const parsed = JSON.parse(await readFile(JOBS_FILE, "utf8")) as Job[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeJobsFile(jobs: Job[]) {
  await mkdir(IMAGE_DIR, { recursive: true });
  const temp = `${JOBS_FILE}.tmp`;
  await writeFile(temp, JSON.stringify(jobs, null, 2));
  await rename(temp, JOBS_FILE);
}

export function isJobId(id: string) {
  return ID_PATTERN.test(id);
}

export async function listJobs(): Promise<Job[]> {
  return locked(() => readJobsFile());
}

export async function getJob(id: string): Promise<Job | null> {
  if (!isJobId(id)) return null;
  const jobs = await listJobs();
  return jobs.find((job) => job.id === id) ?? null;
}

export async function insertJob(job: Job) {
  await locked(async () => {
    const jobs = await readJobsFile();
    jobs.unshift(job);
    await writeJobsFile(jobs);
  });
}

/** Runs `mutate` under the write lock. If it throws, nothing is saved. */
export async function updateJob(id: string, mutate: (job: Job) => Promise<void> | void): Promise<Job> {
  return locked(async () => {
    const jobs = await readJobsFile();
    const job = jobs.find((item) => item.id === id);
    if (!job) throw notFound();
    await mutate(job);
    job.updatedAt = new Date().toISOString();
    await writeJobsFile(jobs);
    return structuredClone(job);
  });
}

function extensionFor(mime: ImageUpload["mime"]) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function writeJobImage(id: string, slot: ImageSlot, image: ImageUpload) {
  if (!isJobId(id) || !/^(before|after|m-[a-z0-9]{8})$/.test(slot)) throw notFound();
  await mkdir(IMAGE_DIR, { recursive: true });
  const ext = extensionFor(image.mime);
  const filename = `${id}-${slot}.${ext}`;
  for (const other of ["jpg", "png", "webp"]) {
    if (other === ext) continue;
    await unlink(path.join(IMAGE_DIR, `${id}-${slot}.${other}`)).catch(() => undefined);
  }
  await writeFile(path.join(IMAGE_DIR, filename), image.bytes);
  return filename;
}

export async function readJobImage(filename: string): Promise<ImageUpload> {
  if (!FILE_PATTERN.test(filename)) throw notFound();
  const bytes = await readFile(path.join(IMAGE_DIR, filename));
  const ext = filename.split(".").pop();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { bytes, mime };
}

export async function deleteJobImage(filename: string) {
  if (!FILE_PATTERN.test(filename)) return;
  await unlink(path.join(IMAGE_DIR, filename)).catch(() => undefined);
}

const DEMO_CREW: Omit<CrewMember, "id" | "key">[] = [
  { name: "Ravi Kumar", trade: "Plumbing", email: "ravi.plumbing@example.com", color: "blue" },
  { name: "Aisha Khan", trade: "Tiling", email: "aisha.tiles@example.com", color: "teal" },
  { name: "Marco Silva", trade: "Electrical", email: "marco.electric@example.com", color: "orange" },
  { name: "Lena Park", trade: "Carpentry", email: "lena.carpentry@example.com", color: "violet" },
  { name: "Sam Okafor", trade: "Painting", email: "sam.painting@example.com", color: "green" },
];

async function readCrewFile(): Promise<CrewMember[] | null> {
  try {
    const parsed = JSON.parse(await readFile(CREW_FILE, "utf8")) as CrewMember[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeCrewFile(crew: CrewMember[]) {
  await mkdir(DATA_DIR, { recursive: true });
  const temp = `${CREW_FILE}.tmp`;
  await writeFile(temp, JSON.stringify(crew, null, 2));
  await rename(temp, CREW_FILE);
}

/** The crew roster. Seeded with a demo crew the first time it is read. */
export async function listCrew(): Promise<CrewMember[]> {
  return locked(async () => {
    const existing = await readCrewFile();
    if (existing) return existing;
    const seeded = DEMO_CREW.map((member) => ({ ...member, id: crypto.randomUUID(), key: randomBytes(18).toString("base64url") }));
    await writeCrewFile(seeded);
    return seeded;
  });
}

export async function getCrew(id: string) {
  return (await listCrew()).find((member) => member.id === id) ?? null;
}

export async function saveCrew(mutate: (crew: CrewMember[]) => CrewMember | void): Promise<CrewMember | void> {
  await listCrew();
  return locked(async () => {
    const crew = (await readCrewFile()) ?? [];
    const result = mutate(crew);
    await writeCrewFile(crew);
    return result;
  });
}
