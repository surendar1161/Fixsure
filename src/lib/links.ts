import type { CrewMember, Job } from "@/lib/types";

function withQuery(path: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value) params.set(name, value);
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export const links = {
  customer: (job: Pick<Job, "id" | "customerKey">, extra: Record<string, string | undefined> = {}) =>
    withQuery(`/jobs/${job.id}`, { k: job.customerKey, ...extra }),
  technician: (job: Pick<Job, "id" | "techKey">, extra: Record<string, string | undefined> = {}) =>
    withQuery(`/jobs/${job.id}/repair`, { k: job.techKey, ...extra }),
  review: (id: string) => `/review/${id}`,
  api: (id: string) => `/api/v1/jobs/${id}`,
  photo: (id: string, slot: "before" | "after", key?: string) => withQuery(`/api/v1/jobs/${id}/photos/${slot}`, { k: key }),
  milestonePhoto: (id: string, milestoneId: string, slot: "site" | "proof", key?: string) =>
    withQuery(`/api/v1/jobs/${id}/milestones/${milestoneId}/photos/${slot}`, { k: key }),
  crew: (member: Pick<CrewMember, "id" | "key">) => withQuery(`/crew/${member.id}`, { k: member.key }),
  schedule: () => "/schedule",
};
