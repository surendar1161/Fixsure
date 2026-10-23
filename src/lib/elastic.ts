import { elasticConfigured } from "@/lib/config";
import { listJobs } from "@/lib/store";
import { isProject, type Job, type JobStatus } from "@/lib/types";

export type SimilarJob = {
  id: string;
  title: string;
  trade: string;
  city: string;
  priceUsd: number;
  status: JobStatus;
  score: number;
};

export type SimilarResult = {
  source: "elastic" | "local";
  jobs: SimilarJob[];
  /** Median price of similar jobs that were paid, when there are any. */
  medianPaidUsd: number | null;
};

type IndexedJob = {
  title: string;
  trade: string;
  city: string;
  description: string;
  summary: string;
  priceUsd: number;
  status: JobStatus;
  kind: "repair" | "project";
  createdAt: string;
};

function index() {
  return process.env.ELASTIC_INDEX || "fixsure-jobs";
}

async function elastic<T>(path: string, method: "GET" | "POST" | "PUT", body: unknown): Promise<T> {
  const response = await fetch(`${process.env.ELASTIC_URL!.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      Authorization: `ApiKey ${process.env.ELASTIC_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Elastic returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return (await response.json()) as T;
}

function documentOf(job: Job): IndexedJob {
  return {
    title: job.scope.title,
    trade: job.scope.trade,
    city: job.city,
    description: job.description,
    summary: job.scope.summary,
    priceUsd: job.scope.priceUsd,
    status: job.status,
    kind: isProject(job) ? "project" : "repair",
    createdAt: job.createdAt,
  };
}

export async function indexJob(job: Job) {
  if (!elasticConfigured()) return;
  await elastic(`/${index()}/_doc/${job.id}`, "PUT", documentOf(job));
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

function summarize(source: SimilarResult["source"], jobs: SimilarJob[]): SimilarResult {
  return { source, jobs, medianPaidUsd: median(jobs.filter((job) => job.status === "released").map((job) => job.priceUsd)) };
}

async function searchElastic(job: Job): Promise<SimilarResult> {
  type Hit = { _id: string; _score: number; _source: IndexedJob };
  const result = await elastic<{ hits: { hits: Hit[] } }>(`/${index()}/_search`, "POST", {
    size: 6,
    query: {
      bool: {
        must: [
          {
            more_like_this: {
              fields: ["title", "trade", "description", "summary"],
              like: `${job.scope.title} ${job.scope.trade} ${job.description}`,
              min_term_freq: 1,
              min_doc_freq: 1,
            },
          },
        ],
        should: [{ term: { "trade.keyword": job.scope.trade } }, { term: { "city.keyword": job.city } }],
        // Projects are priced against projects and repairs against repairs; older documents have no kind and count as repairs.
        ...(isProject(job) ? { filter: [{ term: { "kind.keyword": "project" } }] } : {}),
        must_not: [{ ids: { values: [job.id] } }, ...(isProject(job) ? [] : [{ term: { "kind.keyword": "project" } }])],
      },
    },
    _source: ["title", "trade", "city", "priceUsd", "status"],
  });
  return summarize(
    "elastic",
    result.hits.hits.map((hit) => ({
      id: hit._id,
      title: hit._source.title,
      trade: hit._source.trade,
      city: hit._source.city,
      priceUsd: hit._source.priceUsd,
      status: hit._source.status,
      score: Math.round(hit._score * 100) / 100,
    })),
  );
}

const STOP = new Set(["the", "and", "from", "with", "onto", "this", "that", "is", "a", "an", "of", "on", "in", "to", "it"]);

function terms(text: string) {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP.has(word)));
}

/** Term-overlap ranking over the local ledger, used when Elastic is not configured. */
async function searchLocal(job: Job): Promise<SimilarResult> {
  const target = terms(`${job.scope.title} ${job.scope.trade} ${job.description}`);
  const ranked = (await listJobs())
    .filter((other) => other.id !== job.id && isProject(other) === isProject(job))
    .map((other) => {
      const words = terms(`${other.scope.title} ${other.scope.trade} ${other.description}`);
      const shared = [...target].filter((word) => words.has(word)).length;
      const union = new Set([...target, ...words]).size || 1;
      const trade = other.scope.trade === job.scope.trade ? 0.25 : 0;
      return { other, score: shared / union + trade };
    })
    .filter((item) => item.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return summarize(
    "local",
    ranked.map(({ other, score }) => ({
      id: other.id,
      title: other.scope.title,
      trade: other.scope.trade,
      city: other.city,
      priceUsd: other.scope.priceUsd,
      status: other.status,
      score: Math.round(score * 100) / 100,
    })),
  );
}

export async function similarJobs(job: Job): Promise<SimilarResult> {
  if (!elasticConfigured()) return searchLocal(job);
  try {
    return await searchElastic(job);
  } catch (error) {
    console.warn("Elastic search failed, using the local ledger.", error);
    return searchLocal(job);
  }
}
