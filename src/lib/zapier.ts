import { appUrl, splitPayment, zapierConfigured } from "@/lib/config";
import { links } from "@/lib/links";
import type { Job, Milestone } from "@/lib/types";

export type JobEventName =
  | "job.scoped"
  | "job.funded"
  | "job.review"
  | "job.released"
  | "job.voided"
  | "job.reopened"
  | "payout.sent"
  | "payout.failed"
  | "project.planned"
  | "milestone.review"
  | "milestone.paid"
  | "milestone.rejected";

/**
 * Posts a flat JSON event to a Zapier catch hook. Flat keys map straight onto
 * Zap fields (Gmail, Slack, SMS, Sheets) without a formatter step.
 */
export async function sendToZapier(name: JobEventName, job: Job, milestone?: Milestone) {
  if (!zapierConfigured()) return;
  const { feeUsd, payoutUsd } = splitPayment(job.scope.priceUsd);
  const base = appUrl();
  const payload = {
    event: name,
    occurred_at: new Date().toISOString(),
    job_id: job.id,
    status: job.status,
    title: job.scope.title,
    trade: job.scope.trade,
    city: job.city,
    price_usd: job.scope.priceUsd,
    payout_usd: payoutUsd,
    fee_usd: feeUsd,
    paypal_mode: job.paypal?.mode ?? "none",
    confidence: job.verdict?.confidence ?? null,
    verdict_notes: job.verdict?.notes ?? null,
    technician_email: job.technicianEmail ?? null,
    payout_status: job.payout?.status ?? null,
    // Only a dispatch event carries the technician link; that link is the technician's credential.
    technician_url: name === "job.funded" ? `${base}${links.technician(job)}` : null,
    review_url: `${base}${links.review(job.id)}`,
    milestone_id: milestone?.id ?? null,
    milestone_title: milestone?.title ?? null,
    milestone_amount_usd: milestone?.amountUsd ?? null,
    milestone_status: milestone?.status ?? null,
    milestone_verification: milestone?.verification ?? null,
    milestone_note: milestone?.note ?? null,
  };

  const response = await fetch(process.env.ZAPIER_HOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Zapier hook returned ${response.status}.`);
}
