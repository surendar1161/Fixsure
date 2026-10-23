export const JOB_STATUSES = ["scoped", "funded", "review", "released", "voided"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type ScopeSource = "openai" | "fallback";

export type LineItem = {
  name: string;
  amountUsd: number;
};

export type Scope = {
  title: string;
  trade: string;
  summary: string;
  priceUsd: number;
  lineItems: LineItem[];
  confidence: number;
  assumptions: string[];
  source: ScopeSource;
};

export type Verdict = {
  sameJob: boolean;
  issueAddressed: boolean;
  confidence: number;
  notes: string;
  decision: "release" | "review";
  source: ScopeSource;
};

export type PayPalMode = "demo" | "sandbox" | "live";

export type PayPalHold = {
  mode: PayPalMode;
  orderId?: string;
  approveUrl?: string;
  authorizationId?: string;
  authorizationExpiresAt?: string;
  captureId?: string;
};

export type Payout = {
  mode: PayPalMode;
  amountUsd: number;
  feeUsd: number;
  status: "sent" | "failed" | "demo";
  attempt: number;
  batchId?: string;
  error?: string;
};

export const VERIFICATION_MODES = ["ai", "ai_then_human", "human"] as const;

/** ai: the model can release on its own. ai_then_human: the model checks, a person decides. human: no model. */
export type VerificationMode = (typeof VERIFICATION_MODES)[number];

export type MilestoneStatus = "scheduled" | "review" | "paid" | "cancelled";

export type Milestone = {
  id: string;
  title: string;
  detail: string;
  amountUsd: number;
  crewId: string;
  startsAt: string;
  endsAt: string;
  verification: VerificationMode;
  status: MilestoneStatus;
  proofImage?: string;
  proofHash?: string;
  verdict?: Verdict;
  captureId?: string;
  payout?: Payout;
  note?: string;
  paidAt?: string;
};

export type CrewMember = {
  id: string;
  name: string;
  trade: string;
  email: string;
  key: string;
  color: string;
};

export type JobEvent = {
  at: string;
  type: string;
  message: string;
};

export type Job = {
  id: string;
  createdAt: string;
  updatedAt: string;
  customerKey: string;
  techKey: string;
  sample?: boolean;
  customerName: string;
  city: string;
  description: string;
  beforeImage: string;
  beforeHash: string;
  afterImage?: string;
  afterHash?: string;
  technicianEmail?: string;
  status: JobStatus;
  scope: Scope;
  verdict?: Verdict;
  paypal?: PayPalHold;
  payout?: Payout;
  /** Present on multi-milestone projects. A plain repair has none. */
  milestones?: Milestone[];
  plan?: { source: "agent" | "fallback"; notes: string };
  events: JobEvent[];
};

export type ImageUpload = {
  bytes: Buffer;
  mime: "image/jpeg" | "image/png" | "image/webp";
};

export const STATUS_LABEL: Record<JobStatus, string> = {
  scoped: "Priced",
  funded: "Funds held",
  review: "Needs a person",
  released: "Paid",
  voided: "Hold returned",
};

export const MILESTONE_LABEL: Record<MilestoneStatus, string> = {
  scheduled: "Scheduled",
  review: "Needs a person",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const VERIFICATION_LABEL: Record<VerificationMode, string> = {
  ai: "AI can release",
  ai_then_human: "AI checks, person approves",
  human: "Person only",
};

export function isProject(job: Pick<Job, "milestones">) {
  return Array.isArray(job.milestones) && job.milestones.length > 0;
}

export function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
