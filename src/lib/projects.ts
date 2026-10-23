import { RELEASE_CONFIDENCE, splitPayment, visionConfigured } from "@/lib/config";
import { ApiError, conflict, messageOf, notFound } from "@/lib/errors";
import { event, hashOf, newKey, publish, publishWith, sampleImage, withDecision } from "@/lib/jobs";
import { captureAuthorization, sendPayout } from "@/lib/paypal";
import { newMilestoneId, planProject, verificationFor } from "@/lib/planner";
import { deleteJobImage, getCrew, insertJob, listCrew, readJobImage, updateJob, writeJobImage } from "@/lib/store";
import { VERIFICATION_LABEL, isProject, type CrewMember, type ImageUpload, type Job, type Milestone, type Verdict, type VerificationMode } from "@/lib/types";
import { verifyMilestone } from "@/lib/vision";
import type { JobEventName } from "@/lib/zapier";

function requireProject(job: Job) {
  if (!isProject(job)) throw conflict("This job is a single repair, not a milestone project.");
  return job.milestones!;
}

export function findMilestone(job: Job, milestoneId: string) {
  const milestone = requireProject(job).find((item) => item.id === milestoneId);
  if (!milestone) throw notFound();
  return milestone;
}

function openMilestones(job: Job) {
  return (job.milestones ?? []).filter((m) => m.status !== "paid" && m.status !== "cancelled");
}

/** Project status follows its milestones: any waiting on a person is review; all paid is released. */
function syncStatus(job: Job) {
  if (job.status !== "funded" && job.status !== "review") return;
  const milestones = job.milestones ?? [];
  if (milestones.every((m) => m.status === "paid" || m.status === "cancelled")) {
    job.status = "released";
    job.events.push(event("released", "Every milestone is paid. The project is complete."));
    return;
  }
  job.status = milestones.some((m) => m.status === "review") ? "review" : "funded";
}

function paidUsd(job: Job) {
  return (job.milestones ?? []).filter((m) => m.status === "paid").reduce((sum, m) => sum + m.amountUsd, 0);
}

export async function createProject(input: { customerName: string; city: string; description: string; image: ImageUpload; start?: Date; sample?: boolean }) {
  const id = crypto.randomUUID();
  const filename = await writeJobImage(id, "before", input.image);

  try {
    const crew = await listCrew();
    if (!crew.length) throw conflict("Add at least one crew member before planning a project.");
    const plan = await planProject({ ...input, crew, start: input.start ?? new Date(Date.now() + 86_400_000) });
    const priceUsd = plan.milestones.reduce((sum, m) => sum + m.amountUsd, 0);
    const now = new Date().toISOString();
    const job: Job = {
      id,
      createdAt: now,
      updatedAt: now,
      customerKey: newKey(),
      techKey: newKey(),
      sample: input.sample || undefined,
      customerName: input.customerName,
      city: input.city,
      description: input.description,
      beforeImage: filename,
      beforeHash: hashOf(input.image),
      status: "scoped",
      scope: {
        title: plan.title,
        trade: plan.trade,
        summary: plan.summary,
        priceUsd,
        lineItems: plan.milestones.map((m) => ({ name: m.title, amountUsd: m.amountUsd })),
        confidence: plan.source === "agent" ? 0.8 : 0.5,
        assumptions: [plan.notes],
        source: plan.source === "agent" ? "openai" : "fallback",
      },
      milestones: plan.milestones,
      plan: { source: plan.source, notes: plan.notes },
      events: [
        event(
          "planned",
          plan.source === "agent"
            ? `The planning agent split the project into ${plan.milestones.length} paid milestones and booked the crew.`
            : `Planned ${plan.milestones.length} milestones from a template and booked the crew.`,
        ),
      ],
    };
    await insertJob(job);
    publish(job, "project.planned");
    return job;
  } catch (error) {
    await deleteJobImage(filename);
    throw error;
  }
}

export async function createSampleProject() {
  return createProject({
    customerName: "Sample customer",
    city: "Austin",
    description: "Replace the dripping kitchen faucet and sink, reseal the counter, and repaint the splash wall.",
    image: await sampleImage("before"),
    sample: true,
  });
}

/** Captures this milestone's slice of the hold and pays its crew member. Mutates `job` inside a store update. */
async function payMilestone(job: Job, milestone: Milestone, crew: CrewMember | null, attempt = 1) {
  const mode = job.paypal?.mode ?? "demo";

  if (!milestone.captureId) {
    if (mode === "demo") {
      milestone.captureId = "demo";
    } else {
      if (!job.paypal?.authorizationId) throw conflict("This project has no PayPal authorization to capture.");
      const last = openMilestones(job).every((m) => m.id === milestone.id);
      try {
        milestone.captureId = await captureAuthorization(job.paypal.authorizationId, {
          key: `${job.id}-${milestone.id}`,
          amount: milestone.amountUsd.toFixed(2),
          final: last,
          note: `${job.scope.title}: ${milestone.title}`,
        });
      } catch (error) {
        milestone.status = "review";
        milestone.note = `The check passed, but PayPal could not capture this milestone: ${messageOf(error)}`;
        job.events.push(event("review", milestone.note));
        return;
      }
    }
  }

  milestone.status = "paid";
  milestone.paidAt = new Date().toISOString();
  job.events.push(
    event(
      "milestone",
      mode === "demo"
        ? `"${milestone.title}" released: demo capture of $${milestone.amountUsd.toFixed(2)}.`
        : `"${milestone.title}" released: PayPal captured $${milestone.amountUsd.toFixed(2)} (capture ${milestone.captureId}).`,
    ),
  );

  const { feeUsd, payoutUsd } = splitPayment(milestone.amountUsd);
  const who = crew?.name ?? "the crew member";
  if (mode === "demo") {
    milestone.payout = { mode, amountUsd: payoutUsd, feeUsd, status: "demo", attempt };
    job.events.push(event("payout", `Demo payout of $${payoutUsd.toFixed(2)} to ${who}.`));
  } else if (!crew?.email) {
    milestone.payout = { mode, amountUsd: payoutUsd, feeUsd, status: "failed", attempt, error: "No PayPal email for this crew member." };
    job.events.push(event("payout", `Captured, but ${who} has no PayPal email. Staff can retry after adding one.`));
  } else {
    try {
      const batchId = await sendPayout({
        jobId: job.id,
        itemId: milestone.id,
        attempt,
        email: crew.email,
        amount: payoutUsd.toFixed(2),
        note: `${milestone.title} on ${job.scope.title}`,
      });
      milestone.payout = { mode, amountUsd: payoutUsd, feeUsd, status: "sent", attempt, batchId };
      job.events.push(event("payout", `PayPal payout of $${payoutUsd.toFixed(2)} sent to ${who}. Batch ${batchId}.`));
    } catch (error) {
      const reason = messageOf(error);
      milestone.payout = { mode, amountUsd: payoutUsd, feeUsd, status: "failed", attempt, error: reason };
      job.events.push(event("payout", `Captured, but the payout to ${who} failed: ${reason}`));
    }
  }
}

function milestoneEvents(milestone: Milestone): JobEventName[] {
  if (milestone.status === "review") return ["milestone.review"];
  if (milestone.status !== "paid") return [];
  return ["milestone.paid", milestone.payout?.status === "failed" ? "payout.failed" : "payout.sent"];
}

function finish(job: Job, milestoneId: string, ...extra: JobEventName[]) {
  const milestone = job.milestones?.find((m) => m.id === milestoneId);
  const names = [...(milestone ? milestoneEvents(milestone) : []), ...extra];
  if (job.status === "released") names.push("job.released");
  publishWith(job, milestone, ...names);
  return job;
}

async function judgeMilestone(job: Job, milestone: Milestone, proof: ImageUpload): Promise<Verdict | undefined> {
  if (milestone.verification === "human") return undefined;
  const source = visionConfigured() ? "openai" : "fallback";
  try {
    const draft = await verifyMilestone({
      site: await readJobImage(job.beforeImage),
      proof,
      project: job.scope.title,
      milestone,
    });
    return withDecision(draft, source);
  } catch (error) {
    return {
      sameJob: false,
      issueAddressed: false,
      confidence: 0,
      notes: `The vision model failed (${messageOf(error)}). A reviewer needs to check the photo.`,
      decision: "review",
      source: "fallback",
    };
  }
}

function reviewReason(milestone: Milestone) {
  if (milestone.verification === "human") return "This milestone is checked by a person only.";
  if (milestone.verification === "ai_then_human") {
    return milestone.verdict?.decision === "release"
      ? "The AI check passed. This milestone is large enough that a person approves the payout."
      : "The AI check did not pass, and a person approves this milestone anyway.";
  }
  return `The AI check did not reach ${Math.round(RELEASE_CONFIDENCE * 100)}% confidence on a matching, finished step, so a person decides.`;
}

/** A crew member posts the photo that proves one milestone is done. */
export async function submitMilestoneProof(job: Job, milestoneId: string, image: ImageUpload) {
  const milestone = findMilestone(job, milestoneId);
  if (job.status !== "funded" && job.status !== "review") throw conflict("This project is not funded, so work cannot be submitted.");
  if (milestone.status !== "scheduled") throw conflict("This milestone is not waiting for a proof photo.");

  const proofHash = hashOf(image);
  const reused = proofHash === job.beforeHash || job.milestones!.some((m) => m.id !== milestone.id && m.proofHash === proofHash);
  if (reused) {
    throw new ApiError("validation", "That photo was already used on this project. Take a new photo of this milestone.", [
      { field: "photo", message: "Identical to an earlier photo on this project." },
    ]);
  }

  const filename = await writeJobImage(job.id, `m-${milestone.id}`, image);
  const verdict = await judgeMilestone(job, milestone, image);
  const crew = await getCrew(milestone.crewId);

  const checked = await updateJob(job.id, async (current) => {
    const target = findMilestone(current, milestoneId);
    if (target.status !== "scheduled") throw conflict("This milestone changed while the photo was being checked.");
    target.proofImage = filename;
    target.proofHash = proofHash;
    target.verdict = verdict;
    target.note = undefined;
    current.events.push(event("checked", verdict ? `"${target.title}": ${verdict.notes}` : `"${target.title}" proof posted for a person to check.`));

    if (target.verification === "ai" && verdict?.decision === "release") {
      await payMilestone(current, target, crew);
    } else {
      target.status = "review";
      target.note = reviewReason(target);
      current.events.push(event("review", `"${target.title}": ${target.note}`));
    }
    syncStatus(current);
  });
  return finish(checked, milestoneId);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Tags the sample PNG with the milestone id, so each sample milestone gets a distinct photo. */
function tagPng(image: ImageUpload, label: string): ImageUpload {
  const data = Buffer.concat([Buffer.from("Comment\0", "latin1"), Buffer.from(label, "latin1")]);
  const type = Buffer.from("tEXt", "latin1");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  const iend = image.bytes.length - 12;
  return { mime: image.mime, bytes: Buffer.concat([image.bytes.subarray(0, iend), length, type, data, crc, image.bytes.subarray(iend)]) };
}

export async function submitSampleMilestoneProof(job: Job, milestoneId: string) {
  if (!job.sample) throw conflict("The sample proof photo only works on a sample project.");
  return submitMilestoneProof(job, milestoneId, tagPng(await sampleImage("after"), `fixsure sample ${milestoneId}`));
}

export async function approveMilestone(job: Job, milestoneId: string) {
  findMilestone(job, milestoneId);
  const crew = await getCrew(findMilestone(job, milestoneId).crewId);
  const approved = await updateJob(job.id, async (current) => {
    const target = findMilestone(current, milestoneId);
    if (target.status !== "review") throw conflict("This milestone is not waiting for a person.");
    current.events.push(event("reviewer", `A reviewer approved "${target.title}".`));
    target.note = undefined;
    await payMilestone(current, target, crew);
    syncStatus(current);
  });
  return finish(approved, milestoneId);
}

export async function rejectMilestone(job: Job, milestoneId: string, note: string) {
  let oldProof: string | undefined;
  const rejected = await updateJob(job.id, (current) => {
    const target = findMilestone(current, milestoneId);
    if (target.status !== "review" || target.captureId) throw conflict("Only a milestone waiting for a person, and not yet captured, can be sent back.");
    oldProof = target.proofImage;
    target.proofImage = undefined;
    target.proofHash = undefined;
    target.verdict = undefined;
    target.status = "scheduled";
    target.note = note;
    current.events.push(event("rejected", `A reviewer sent "${target.title}" back: ${note}`));
    syncStatus(current);
  });
  if (oldProof) await deleteJobImage(oldProof);
  return finish(rejected, milestoneId, "milestone.rejected");
}

export async function retryMilestonePayout(job: Job, milestoneId: string) {
  const crew = await getCrew(findMilestone(job, milestoneId).crewId);
  const retried = await updateJob(job.id, async (current) => {
    const target = findMilestone(current, milestoneId);
    if (target.status !== "paid" || target.payout?.status !== "failed") throw conflict("Only a paid milestone with a failed payout can be retried.");
    // A new attempt number is a new PayPal batch; the same number would be deduplicated.
    current.events.push(event("payout", `Retrying the payout for "${target.title}".`));
    await payMilestone(current, target, crew, (target.payout.attempt || 1) + 1);
  });
  return finish(retried, milestoneId);
}

export type MilestoneChanges = {
  crewId?: string;
  startsAt?: Date;
  endsAt?: Date;
  verification?: VerificationMode;
  amountUsd?: number;
  title?: string;
};

/** Staff and the copilot move, reassign, reprice, or change how a milestone is checked. */
export async function updateMilestone(job: Job, milestoneId: string, changes: MilestoneChanges) {
  if (changes.crewId && !(await getCrew(changes.crewId))) {
    throw new ApiError("validation", "That crew member does not exist.", [{ field: "crewId", message: "Unknown crew member." }]);
  }
  return updateJob(job.id, (current) => {
    const target = findMilestone(current, milestoneId);
    if (target.status !== "scheduled") throw conflict("Only a scheduled milestone can be changed.");
    const said: string[] = [];

    if (changes.amountUsd !== undefined && changes.amountUsd !== target.amountUsd) {
      if (current.status !== "scoped") throw conflict("Prices are locked once the customer has placed the hold.");
      target.amountUsd = Math.round(changes.amountUsd * 100) / 100;
      target.verification = verificationFor(target.amountUsd, target.verification !== "human");
      current.scope.priceUsd = current.milestones!.reduce((sum, m) => sum + m.amountUsd, 0);
      current.scope.lineItems = current.milestones!.map((m) => ({ name: m.title, amountUsd: m.amountUsd }));
      said.push(`price $${target.amountUsd.toFixed(2)}`);
    }
    if (changes.title) {
      target.title = changes.title;
      current.scope.lineItems = current.milestones!.map((m) => ({ name: m.title, amountUsd: m.amountUsd }));
    }
    if (changes.crewId && changes.crewId !== target.crewId) {
      target.crewId = changes.crewId;
      said.push("new crew member");
    }
    const startsAt = changes.startsAt ?? new Date(target.startsAt);
    const endsAt = changes.endsAt ?? new Date(target.endsAt);
    if (changes.startsAt || changes.endsAt) {
      if (!(endsAt > startsAt)) throw new ApiError("validation", "The milestone must end after it starts.", [{ field: "endsAt", message: "Must be after startsAt." }]);
      target.startsAt = startsAt.toISOString();
      target.endsAt = endsAt.toISOString();
      said.push(`booked ${startsAt.toDateString()}`);
    }
    if (changes.verification && changes.verification !== target.verification) {
      target.verification = changes.verification;
      said.push(VERIFICATION_LABEL[changes.verification].toLowerCase());
    }
    if (said.length) current.events.push(event("schedule", `"${target.title}" updated: ${said.join(", ")}.`));
  });
}

export async function addMilestone(job: Job, input: { title: string; detail: string; amountUsd: number; crewId: string; startsAt: Date; endsAt: Date }) {
  if (!(await getCrew(input.crewId))) throw new ApiError("validation", "That crew member does not exist.", [{ field: "crewId", message: "Unknown crew member." }]);
  return updateJob(job.id, (current) => {
    requireProject(current);
    if (current.status !== "scoped") throw conflict("Milestones can only be added before the customer places the hold.");
    const milestone: Milestone = {
      id: newMilestoneId(),
      title: input.title,
      detail: input.detail,
      amountUsd: Math.round(input.amountUsd * 100) / 100,
      crewId: input.crewId,
      startsAt: input.startsAt.toISOString(),
      endsAt: input.endsAt.toISOString(),
      verification: verificationFor(input.amountUsd),
      status: "scheduled",
    };
    current.milestones!.push(milestone);
    current.scope.priceUsd = current.milestones!.reduce((sum, m) => sum + m.amountUsd, 0);
    current.scope.lineItems = current.milestones!.map((m) => ({ name: m.title, amountUsd: m.amountUsd }));
    current.events.push(event("schedule", `Added "${milestone.title}" for $${milestone.amountUsd.toFixed(2)}.`));
  });
}

export function projectProgress(job: Job) {
  const total = job.scope.priceUsd;
  const paid = paidUsd(job);
  const milestones = job.milestones ?? [];
  return {
    paidUsd: paid,
    heldUsd: job.status === "funded" || job.status === "review" ? Math.max(0, total - paid) : 0,
    totalUsd: total,
    paidCount: milestones.filter((m) => m.status === "paid").length,
    count: milestones.length,
    percent: total > 0 ? Math.round((paid / total) * 100) : 0,
  };
}
