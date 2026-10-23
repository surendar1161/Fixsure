import type { Role } from "@/lib/auth";
import { RELEASE_CONFIDENCE, splitPayment } from "@/lib/config";
import { links } from "@/lib/links";
import { projectProgress } from "@/lib/projects";
import { listCrew, listJobs } from "@/lib/store";
import { MILESTONE_LABEL, STATUS_LABEL, VERIFICATION_LABEL, isProject, type CrewMember, type Job, type Milestone } from "@/lib/types";

export type JobView = ReturnType<typeof viewJob>;

/**
 * The JSON shape every API response and page uses. Each role only sees its own
 * link key; the customer never sees the technician link and vice versa.
 */
export type MilestoneViewer = { role: "customer" | "crew" | "staff"; key?: string; crewId?: string };

/** One milestone as a given viewer sees it. A crew member only gets photo links to their own milestones. */
export function viewMilestone(job: Job, milestone: Milestone, crew: CrewMember[], viewer: MilestoneViewer) {
  const member = crew.find((item) => item.id === milestone.crewId);
  const ownsIt = viewer.role !== "crew" || viewer.crewId === milestone.crewId;
  const photoKey = viewer.role === "staff" ? undefined : viewer.key;
  return {
    id: milestone.id,
    title: milestone.title,
    detail: milestone.detail,
    amountUsd: milestone.amountUsd,
    status: milestone.status,
    statusLabel: MILESTONE_LABEL[milestone.status],
    verification: milestone.verification,
    verificationLabel: VERIFICATION_LABEL[milestone.verification],
    startsAt: milestone.startsAt,
    endsAt: milestone.endsAt,
    crew: member ? { id: member.id, name: member.name, trade: member.trade, color: member.color } : null,
    verdict: ownsIt ? (milestone.verdict ?? null) : null,
    note: ownsIt ? (milestone.note ?? null) : null,
    paidAt: milestone.paidAt ?? null,
    captureId: viewer.role === "staff" ? (milestone.captureId ?? null) : null,
    payout: viewer.role === "customer" ? null : ownsIt ? (milestone.payout ?? null) : null,
    photo: milestone.proofImage && ownsIt ? links.milestonePhoto(job.id, milestone.id, "proof", photoKey) : null,
  };
}

export type MilestoneView = ReturnType<typeof viewMilestone>;

export function viewProject(job: Job, crew: CrewMember[], viewer: MilestoneViewer) {
  if (!isProject(job)) return null;
  return {
    plan: job.plan ?? null,
    progress: projectProgress(job),
    milestones: job.milestones!.map((milestone) => viewMilestone(job, milestone, crew, viewer)),
  };
}

export function viewJob(job: Job, role: Role, key?: string, crew: CrewMember[] = []) {
  const { feeUsd, payoutUsd } = splitPayment(job.scope.priceUsd);
  const photoKey = role === "staff" ? undefined : key;
  const hold = job.paypal
    ? {
        mode: job.paypal.mode,
        orderId: job.paypal.orderId ?? null,
        authorizationId: job.paypal.authorizationId ?? null,
        authorizationExpiresAt: job.paypal.authorizationExpiresAt ?? null,
        captureId: job.paypal.captureId ?? null,
        approveUrl: role === "customer" && job.status === "scoped" ? (job.paypal.approveUrl ?? null) : null,
      }
    : null;

  return {
    id: job.id,
    kind: isProject(job) ? ("project" as const) : ("repair" as const),
    status: job.status,
    statusLabel: STATUS_LABEL[job.status],
    sample: Boolean(job.sample),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    customerName: role === "technician" ? null : job.customerName,
    city: job.city,
    description: job.description,
    scope: job.scope,
    verdict: job.verdict ?? null,
    releaseThreshold: RELEASE_CONFIDENCE,
    money: { priceUsd: job.scope.priceUsd, feeUsd, payoutUsd, currency: "USD" as const },
    hold,
    payout: job.payout ?? null,
    technicianEmail: role === "customer" ? null : (job.technicianEmail ?? null),
    photos: {
      before: links.photo(job.id, "before", photoKey),
      after: job.afterImage ? links.photo(job.id, "after", photoKey) : null,
    },
    project: viewProject(job, crew, { role: role === "technician" ? "customer" : role, key }),
    events: job.events,
    links: {
      self: links.api(job.id),
      customer: role === "customer" || role === "staff" ? links.customer(job) : null,
      technician: !isProject(job) && (role === "technician" || (role === "staff" && job.status !== "scoped")) ? links.technician(job) : null,
      review: role === "staff" ? links.review(job.id) : null,
    },
  };
}

/** viewJob with crew names filled in on milestone projects. */
export async function presentJob(job: Job, role: Role, key?: string) {
  return viewJob(job, role, key, isProject(job) ? await listCrew() : []);
}

/** One row of the staff job list, sized for AG Grid. */
export function viewRow(job: Job) {
  const { payoutUsd } = splitPayment(job.scope.priceUsd);
  const progress = isProject(job) ? projectProgress(job) : null;
  return {
    id: job.id,
    kind: isProject(job) ? ("project" as const) : ("repair" as const),
    milestones: progress ? `${progress.paidCount}/${progress.count}` : null,
    awaiting: job.milestones?.filter((m) => m.status === "review").length ?? 0,
    title: job.scope.title,
    trade: job.scope.trade,
    city: job.city,
    customerName: job.customerName,
    status: job.status,
    statusLabel: STATUS_LABEL[job.status],
    priceUsd: job.scope.priceUsd,
    payoutUsd,
    confidence: job.verdict?.confidence ?? null,
    decision: job.verdict?.decision ?? null,
    scopeSource: job.scope.source,
    paypalMode: job.paypal?.mode ?? null,
    payoutStatus: job.payout?.status ?? null,
    sample: Boolean(job.sample),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    technicianUrl: job.status === "scoped" || progress ? null : links.technician(job),
  };
}

export type JobRow = ReturnType<typeof viewRow>;

/** Calendar days a milestone spans; a 09:00 to 17:00 booking on one day is one day. */
export function bookedDays(milestone: Pick<Milestone, "startsAt" | "endsAt">) {
  return Math.max(1, Math.ceil((Date.parse(milestone.endsAt) - Date.parse(milestone.startsAt)) / 86_400_000));
}

/** What one crew member has on their plate across every project, for the staff roster. */
export function crewWorkload(member: CrewMember, jobs: Job[]) {
  const mine = jobs
    .filter((job) => isProject(job) && job.status !== "voided")
    .flatMap((job) => job.milestones!.filter((m) => m.crewId === member.id && m.status !== "cancelled").map((milestone) => ({ job, milestone })));
  const funded = (job: Job) => job.status === "funded" || job.status === "review";
  const open = mine.filter(({ milestone }) => milestone.status === "scheduled" || milestone.status === "review");
  const next = open
    .filter(({ milestone }) => milestone.status === "scheduled")
    .sort((a, b) => a.milestone.startsAt.localeCompare(b.milestone.startsAt))[0];

  return {
    readyForProof: open.filter(({ job, milestone }) => milestone.status === "scheduled" && funded(job)).length,
    awaitingHold: open.filter(({ job, milestone }) => milestone.status === "scheduled" && !funded(job)).length,
    inReview: open.filter(({ milestone }) => milestone.status === "review").length,
    paid: mine.filter(({ milestone }) => milestone.status === "paid").length,
    failedPayouts: mine.filter(({ milestone }) => milestone.payout?.status === "failed").length,
    bookedDays: open.reduce((sum, { milestone }) => sum + bookedDays(milestone), 0),
    earnedUsd: mine.reduce((sum, { milestone }) => sum + (milestone.payout && milestone.payout.status !== "failed" ? milestone.payout.amountUsd : 0), 0),
    next: next
      ? { jobId: next.job.id, project: next.job.scope.title, milestone: next.milestone.title, startsAt: next.milestone.startsAt, funded: funded(next.job) }
      : null,
  };
}

export type CrewWorkload = ReturnType<typeof crewWorkload>;

/** Staff view of a crew member. The portal link carries the crew key, so only staff see it. */
export function viewCrew(member: CrewMember, jobs?: Job[]) {
  return {
    id: member.id,
    name: member.name,
    trade: member.trade,
    email: member.email,
    color: member.color,
    portalUrl: links.crew(member),
    ...(jobs ? { workload: crewWorkload(member, jobs) } : {}),
  };
}

export type CrewView = ReturnType<typeof viewCrew>;

export async function crewRoster() {
  const [jobs, crew] = await Promise.all([listJobs(), listCrew()]);
  return crew.map((member) => ({ ...viewCrew(member), workload: crewWorkload(member, jobs) }));
}

export type CrewRosterRow = Awaited<ReturnType<typeof crewRoster>>[number];

/** Everything booked to one crew member, for their portal. */
export async function crewAssignments(member: CrewMember) {
  const [jobs, crew] = await Promise.all([listJobs(), listCrew()]);
  const viewer: MilestoneViewer = { role: "crew", key: member.key, crewId: member.id };
  const data = jobs
    .filter((job) => isProject(job) && job.status !== "voided")
    .flatMap((job) =>
      job.milestones!
        .filter((milestone) => milestone.crewId === member.id && milestone.status !== "cancelled")
        .map((milestone) => ({
          ...viewMilestone(job, milestone, crew, viewer),
          step: job.milestones!.indexOf(milestone),
          job: {
            id: job.id,
            title: job.scope.title,
            city: job.city,
            status: job.status,
            funded: job.status === "funded" || job.status === "review",
            sitePhoto: links.milestonePhoto(job.id, milestone.id, "site", member.key),
          },
        })),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return {
    crew: { id: member.id, name: member.name, trade: member.trade, color: member.color },
    data,
    earnedUsd: data.reduce((sum, item) => sum + (item.payout && item.payout.status !== "failed" ? item.payout.amountUsd : 0), 0),
  };
}

export type CrewAssignments = Awaited<ReturnType<typeof crewAssignments>>;

/** Bryntum Scheduler data: crew as resources, milestones as events. Only scheduled milestones can be dragged. */
export async function scheduleData() {
  const [jobs, crew] = await Promise.all([listJobs(), listCrew()]);
  const events = jobs
    .filter((job) => isProject(job) && job.status !== "voided")
    .flatMap((job) =>
      job.milestones!
        .filter((milestone) => milestone.status !== "cancelled")
        .map((milestone) => {
          const movable = milestone.status === "scheduled";
          return {
            id: `${job.id}:${milestone.id}`,
            resourceId: milestone.crewId,
            name: milestone.title,
            startDate: milestone.startsAt,
            endDate: milestone.endsAt,
            draggable: movable,
            resizable: movable,
            cls: `ms-${milestone.status}`,
            jobId: job.id,
            milestoneId: milestone.id,
            project: job.scope.title,
            city: job.city,
            funded: job.status !== "scoped",
            status: milestone.status,
            statusLabel: MILESTONE_LABEL[milestone.status],
            amountUsd: milestone.amountUsd,
            verification: milestone.verification,
            verificationLabel: VERIFICATION_LABEL[milestone.verification],
            confidence: milestone.verdict?.confidence ?? null,
            photo: milestone.proofImage ? links.milestonePhoto(job.id, milestone.id, "proof") : null,
            review: links.review(job.id),
          };
        }),
    );
  return {
    resources: crew.map((member) => ({ id: member.id, name: member.name, trade: member.trade, eventColor: member.color })),
    events,
  };
}

export type ScheduleData = Awaited<ReturnType<typeof scheduleData>>;
export type ScheduleEvent = ScheduleData["events"][number];
