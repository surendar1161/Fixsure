import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { after } from "next/server";
import { paypalConfigured, paypalEnv, RELEASE_CONFIDENCE, splitPayment, visionConfigured } from "@/lib/config";
import { indexJob } from "@/lib/elastic";
import { ApiError, conflict, messageOf } from "@/lib/errors";
import { authorizeOrder, captureAuthorization, createAuthorizeOrder, getOrder, sendPayout, voidAuthorization } from "@/lib/paypal";
import { deleteJobImage, getJob, insertJob, readJobImage, updateJob, writeJobImage } from "@/lib/store";
import { isProject, type ImageUpload, type Job, type JobEvent, type Milestone, type Verdict } from "@/lib/types";
import { comparePhotos, fallbackScope, scopeFromPhoto } from "@/lib/vision";
import { type JobEventName, sendToZapier } from "@/lib/zapier";

export function event(type: string, message: string): JobEvent {
  return { at: new Date().toISOString(), type, message };
}

export function hashOf(image: ImageUpload) {
  return createHash("sha256").update(image.bytes).digest("hex");
}

export function newKey() {
  return randomBytes(18).toString("base64url");
}

/** Sends events to Zapier and re-indexes the job in Elastic once the response is out. */
export function publish(job: Job, ...names: JobEventName[]) {
  publishWith(job, undefined, ...names);
}

export function publishWith(job: Job, milestone: Milestone | undefined, ...names: JobEventName[]) {
  after(async () => {
    const results = await Promise.allSettled([indexJob(job), ...names.map((name) => sendToZapier(name, job, milestone))]);
    for (const result of results) {
      if (result.status === "rejected") console.warn("Integration call failed:", messageOf(result.reason));
    }
  });
}

function payoutEvent(job: Job): JobEventName[] {
  if (!job.payout) return [];
  return [job.payout.status === "failed" ? "payout.failed" : "payout.sent"];
}

export function withDecision(draft: Omit<Verdict, "decision" | "source">, source: Verdict["source"]): Verdict {
  const release = draft.sameJob && draft.issueAddressed && draft.confidence >= RELEASE_CONFIDENCE;
  return { ...draft, source, decision: release ? "release" : "review" };
}

async function payTechnician(job: Job, attempt = 1) {
  const { feeUsd, payoutUsd } = splitPayment(job.scope.priceUsd);
  const mode = job.paypal?.mode ?? "demo";

  if (mode === "demo") {
    job.payout = { mode, amountUsd: payoutUsd, feeUsd, status: "demo", attempt };
    job.events.push(event("payout", `Demo payout of $${payoutUsd.toFixed(2)} to the technician. No PayPal money moved.`));
    return;
  }

  if (!job.technicianEmail) {
    job.payout = { mode, amountUsd: payoutUsd, feeUsd, status: "failed", attempt, error: "No technician PayPal email on the job." };
    job.events.push(event("payout", "Captured, but the technician has no PayPal email on file. Staff can retry after adding one."));
    return;
  }

  try {
    const batchId = await sendPayout({
      jobId: job.id,
      attempt,
      email: job.technicianEmail,
      amount: payoutUsd.toFixed(2),
      note: `${job.scope.title} in ${job.city}`,
    });
    job.payout = { mode, amountUsd: payoutUsd, feeUsd, status: "sent", attempt, batchId };
    job.events.push(event("payout", `PayPal payout of $${payoutUsd.toFixed(2)} sent to ${job.technicianEmail}. Batch ${batchId}.`));
  } catch (error) {
    const reason = messageOf(error);
    job.payout = { mode, amountUsd: payoutUsd, feeUsd, status: "failed", attempt, error: reason };
    job.events.push(event("payout", `Captured, but the PayPal payout failed: ${reason}`));
  }
}

async function captureHeldFunds(job: Job) {
  if (!job.paypal || job.paypal.mode === "demo") {
    job.status = "released";
    job.events.push(event("released", "Demo hold captured. No PayPal money moved."));
    await payTechnician(job);
    return;
  }
  if (!job.paypal.authorizationId) throw conflict("This job has no PayPal authorization to capture.");

  try {
    job.paypal.captureId = await captureAuthorization(job.paypal.authorizationId);
    job.status = "released";
    job.events.push(event("released", `PayPal captured the hold. Capture ${job.paypal.captureId}.`));
  } catch (error) {
    job.status = "review";
    job.events.push(event("review", `The check passed, but PayPal could not capture the hold: ${messageOf(error)}`));
    return;
  }

  await payTechnician(job);
}

async function priceRepair(input: { image: ImageUpload; description: string; city: string }) {
  if (!visionConfigured()) return fallbackScope(input.description, input.city);
  try {
    return await scopeFromPhoto(input);
  } catch (error) {
    const scope = fallbackScope(input.description, input.city);
    scope.assumptions = [`The vision model failed (${messageOf(error)}), so this price comes from the description.`];
    return scope;
  }
}

export async function createJob(input: { customerName: string; city: string; description: string; image: ImageUpload; sample?: boolean }) {
  const id = crypto.randomUUID();
  const filename = await writeJobImage(id, "before", input.image);

  try {
    const scope = await priceRepair(input);
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
      scope,
      events: [
        event("scoped", scope.source === "openai" ? "Vision model priced the repair from the photo." : "Priced from the description. Add an OpenAI key to read the photo."),
      ],
    };
    await insertJob(job);
    publish(job, "job.scoped");
    return job;
  } catch (error) {
    await deleteJobImage(filename);
    throw error;
  }
}

export async function sampleImage(slot: "before" | "after"): Promise<ImageUpload> {
  const bytes = await readFile(path.join(process.cwd(), "public", "proof", `${slot}.png`));
  return { bytes, mime: "image/png" };
}

export async function createSampleJob() {
  return createJob({
    customerName: "Sample customer",
    city: "Austin",
    description: "The kitchen faucet is dripping from the base onto the counter.",
    image: await sampleImage("before"),
    sample: true,
  });
}

function requireStatus(job: Job, status: Job["status"], detail: string) {
  if (job.status !== status) throw conflict(detail);
}

/**
 * Places the hold. In demo mode the job is funded at once. With PayPal keys it
 * creates an AUTHORIZE order and returns the approval link for the customer.
 */
export async function placeHold(job: Job): Promise<{ job: Job; approveUrl?: string }> {
  requireStatus(job, "scoped", "This job is not waiting for a hold.");

  if (!paypalConfigured()) {
    const funded = await updateJob(job.id, (current) => {
      requireStatus(current, "scoped", "This job is not waiting for a hold.");
      current.status = "funded";
      current.paypal = { mode: "demo" };
      current.events.push(event("funded", "Demo hold placed. Connect PayPal sandbox keys to authorize a real payment."));
    });
    publish(funded, "job.funded");
    return { job: funded };
  }

  if (job.paypal?.approveUrl) return { job, approveUrl: job.paypal.approveUrl };

  const order = await createAuthorizeOrder({
    jobId: job.id,
    customerKey: job.customerKey,
    amount: job.scope.priceUsd.toFixed(2),
    description: job.scope.title,
  });
  const pending = await updateJob(job.id, (current) => {
    requireStatus(current, "scoped", "This job is not waiting for a hold.");
    current.paypal = { mode: paypalEnv(), orderId: order.id, approveUrl: order.approveUrl };
    current.events.push(event("paypal", "PayPal order created. Waiting for the customer to approve the hold."));
  });
  return { job: pending, approveUrl: order.approveUrl };
}

export async function completePayPalApproval(job: Job, orderId: string) {
  if (!job.paypal?.orderId || job.paypal.orderId !== orderId) {
    throw new ApiError("bad-request", "This PayPal approval does not belong to this job.");
  }
  if (job.status === "funded") return job;
  requireStatus(job, "scoped", "This job is not waiting for a hold.");

  const order = await getOrder(orderId);
  if (order.customId !== job.id) throw new ApiError("bad-request", "This PayPal order was created for a different job.");
  if (order.currency !== "USD" || order.amount !== job.scope.priceUsd.toFixed(2)) {
    throw new ApiError("bad-request", "The PayPal amount does not match the priced repair.");
  }

  const authorization = await authorizeOrder(orderId);
  let changed = false;
  const funded = await updateJob(job.id, (current) => {
    if (current.status === "funded") return;
    requireStatus(current, "scoped", "This job is not waiting for a hold.");
    changed = true;
    current.status = "funded";
    current.paypal = {
      mode: paypalEnv(),
      orderId,
      authorizationId: authorization.id,
      authorizationExpiresAt: authorization.expiresAt,
      approveUrl: current.paypal?.approveUrl,
    };
    current.events.push(event("funded", "PayPal hold approved. The technician can start, and the customer has not been charged yet."));
  });
  if (changed) publish(funded, "job.funded");
  return funded;
}

export async function voidHeld(job: Job, message: string) {
  if (job.paypal && job.paypal.mode !== "demo" && job.paypal.authorizationId) {
    await voidAuthorization(job.paypal.authorizationId);
  }
  job.status = "voided";
  job.events.push(event("voided", job.paypal?.mode === "demo" ? `${message} Demo hold, so no PayPal money moved.` : `${message} PayPal authorization voided.`));
}

export async function cancelHold(job: Job) {
  const voided = await updateJob(job.id, async (current) => {
    if (current.status !== "funded" || current.afterImage || current.milestones?.some((m) => m.status !== "scheduled")) {
      throw conflict("Only a funded job with no work submitted can be cancelled. A reviewer decides from here.");
    }
    for (const milestone of current.milestones ?? []) milestone.status = "cancelled";
    await voidHeld(current, "The customer cancelled before the repair was submitted.");
  });
  publish(voided, "job.voided");
  return voided;
}

async function judge(before: ImageUpload, after: ImageUpload, job: Job): Promise<Verdict> {
  if (!visionConfigured()) return withDecision(await comparePhotos({ before, after, scope: job.scope }), "fallback");
  try {
    return withDecision(await comparePhotos({ before, after, scope: job.scope }), "openai");
  } catch (error) {
    return {
      sameJob: false,
      issueAddressed: false,
      confidence: 0,
      notes: `The vision model failed (${messageOf(error)}). A reviewer needs to compare the photos.`,
      decision: "review",
      source: "fallback",
    };
  }
}

function requireRepair(job: Job) {
  if (isProject(job)) throw conflict("This is a milestone project. Use the milestone endpoints instead.");
}

export async function submitProof(job: Job, image: ImageUpload, technicianEmail?: string) {
  requireRepair(job);
  requireStatus(job, "funded", "This job is not waiting for an after photo.");
  if (job.afterImage) throw conflict("An after photo was already submitted for this job.");
  if (paypalConfigured() && !technicianEmail) {
    throw new ApiError("validation", "Add the PayPal email where you want to be paid.", [{ field: "email", message: "Required when PayPal is connected." }]);
  }

  const afterHash = hashOf(image);
  if (afterHash === job.beforeHash) {
    throw new ApiError("validation", "That is the before photo. Take a new photo of the finished repair.", [{ field: "photo", message: "Identical to the before photo." }]);
  }

  const filename = await writeJobImage(job.id, "after", image);
  const verdict = await judge(await readJobImage(job.beforeImage), image, job);

  const checked = await updateJob(job.id, async (current) => {
    if (current.status !== "funded" || current.afterImage) throw conflict("This job changed while the photo was being checked.");
    current.afterImage = filename;
    current.afterHash = afterHash;
    if (technicianEmail) current.technicianEmail = technicianEmail;
    current.verdict = verdict;
    current.events.push(event("checked", verdict.notes));
    if (verdict.decision === "release") {
      await captureHeldFunds(current);
      return;
    }
    current.status = "review";
    current.events.push(
      event("review", `Auto-release needs a matching repair, a resolved issue, and confidence of at least ${Math.round(RELEASE_CONFIDENCE * 100)}%.`),
    );
  });
  publish(checked, checked.status === "released" ? "job.released" : "job.review", ...payoutEvent(checked));
  return checked;
}

export async function submitSampleProof(job: Job, technicianEmail?: string) {
  if (!job.sample) throw conflict("The sample after photo only works on a sample job.");
  return submitProof(job, await sampleImage("after"), technicianEmail);
}

export async function releaseJob(job: Job) {
  requireRepair(job);
  const released = await updateJob(job.id, async (current) => {
    requireStatus(current, "review", "This job is not waiting for review.");
    current.events.push(event("reviewer", "A reviewer accepted the repair and released the hold."));
    await captureHeldFunds(current);
  });
  publish(released, released.status === "released" ? "job.released" : "job.review", ...payoutEvent(released));
  return released;
}

export async function voidJob(job: Job) {
  const voided = await updateJob(job.id, async (current) => {
    if (current.status !== "funded" && current.status !== "review") throw conflict("This hold can no longer be returned.");
    const paid = current.milestones?.filter((m) => m.status === "paid") ?? [];
    for (const milestone of current.milestones ?? []) if (milestone.status !== "paid") milestone.status = "cancelled";
    const paidUsd = paid.reduce((sum, m) => sum + m.amountUsd, 0);
    await voidHeld(
      current,
      paid.length
        ? `A reviewer stopped the project. $${paidUsd.toFixed(2)} stays paid for ${paid.length} finished milestone${paid.length === 1 ? "" : "s"}; the rest of the hold goes back.`
        : "A reviewer returned the hold to the customer.",
    );
  });
  publish(voided, "job.voided");
  return voided;
}

export async function reopenJob(job: Job) {
  requireRepair(job);
  let oldAfter: string | undefined;
  const reopened = await updateJob(job.id, (current) => {
    if (current.status !== "review" || !current.afterImage) throw conflict("Only a job in review with an after photo can be reopened.");
    oldAfter = current.afterImage;
    current.afterImage = undefined;
    current.afterHash = undefined;
    current.verdict = undefined;
    current.status = "funded";
    current.events.push(event("reopened", "A reviewer asked the technician for a clearer after photo."));
  });
  if (oldAfter) await deleteJobImage(oldAfter);
  publish(reopened, "job.reopened");
  return reopened;
}

export async function retryPayout(job: Job, technicianEmail?: string) {
  requireRepair(job);
  const retried = await updateJob(job.id, async (current) => {
    if (current.status !== "released" || current.payout?.status !== "failed") {
      throw conflict("Only a paid job with a failed payout can be retried.");
    }
    const previous = current.payout.attempt || 1;
    const changedEmail = Boolean(technicianEmail && technicianEmail !== current.technicianEmail);
    if (technicianEmail) current.technicianEmail = technicianEmail;
    // The same attempt reuses PayPal's idempotency key, so a payout that went
    // through is not sent twice. A new email is a new payout.
    await payTechnician(current, changedEmail ? previous + 1 : previous);
  });
  publish(retried, ...payoutEvent(retried));
  return retried;
}

export { getJob };
