import { BadgeCheck, Bot, Camera, CalendarDays, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { formatUsd, type MilestoneStatus, type VerificationMode } from "@/lib/types";
import type { JobView, MilestoneView } from "@/lib/views";

type Project = NonNullable<JobView["project"]>;

const VERIFY_ICON: Record<VerificationMode, React.ReactNode> = {
  ai: <Bot size={13} />,
  ai_then_human: <ShieldCheck size={13} />,
  human: <UserCheck size={13} />,
};

const STATUS_CLASS: Record<MilestoneStatus, string> = {
  scheduled: "pill-scoped",
  review: "pill-review",
  paid: "pill-released",
  cancelled: "pill-voided",
};

export function formatSpan(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return start.toDateString() === end.toDateString() ? day(start) : `${day(start)} – ${day(end)}`;
}

export function VerificationBadge({ mode, label }: { mode: VerificationMode; label: string }) {
  return (
    <span className={`chip verify verify-${mode}`}>
      {VERIFY_ICON[mode]} {label}
    </span>
  );
}

/** Paid, held, and remaining money across the project, as one bar. */
export function ProjectProgress({ project, held }: { project: Project; held: boolean }) {
  const { progress } = project;
  return (
    <section className="card">
      <div className="card-title">
        <h3>Released so far</h3>
        <span className="sub">
          {progress.paidCount} of {progress.count} milestones
        </span>
      </div>
      <div className="progress">
        <div className="progress-paid" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="progress-legend">
        <span>
          <i className="dot-paid" /> Paid <b>{formatUsd(progress.paidUsd)}</b>
        </span>
        <span>
          <i className="dot-held" /> {held ? "Still held" : "Not held yet"} <b>{formatUsd(held ? progress.heldUsd : progress.totalUsd - progress.paidUsd)}</b>
        </span>
      </div>
    </section>
  );
}

export function MilestoneCard({ milestone, index, children }: { milestone: MilestoneView; index: number; children?: React.ReactNode }) {
  const verdict = milestone.verdict;
  return (
    <article className={`milestone ms-${milestone.status}`}>
      <div className="ms-thumb">
        {milestone.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated API image
          <img src={milestone.photo} alt={`Proof for ${milestone.title}`} />
        ) : (
          <span>
            {milestone.status === "paid" ? <BadgeCheck size={20} /> : <Camera size={20} />}
            <small>Step {index + 1}</small>
          </span>
        )}
      </div>
      <div className="ms-body">
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <h4>{milestone.title}</h4>
            <p className="muted small">{milestone.detail}</p>
          </div>
          <div className="ms-amount">
            <b>{formatUsd(milestone.amountUsd)}</b>
            <span className={`pill ${STATUS_CLASS[milestone.status]}`}>{milestone.statusLabel}</span>
          </div>
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {milestone.crew ? (
            <span className="chip">
              <i className={`crew-dot c-${milestone.crew.color}`} /> {milestone.crew.name} · {milestone.crew.trade}
            </span>
          ) : null}
          <span className="chip">
            <CalendarDays size={13} /> {formatSpan(milestone.startsAt, milestone.endsAt)}
          </span>
          <VerificationBadge mode={milestone.verification} label={milestone.verificationLabel} />
        </div>
        {verdict ? (
          <div className="ms-verdict">
            <div className="meter-bar small-bar">
              <div className={`meter-fill ${verdict.decision === "release" ? "pass" : "fail"}`} style={{ width: `${Math.round(verdict.confidence * 100)}%` }} />
            </div>
            <span className="small">
              <b>AI {Math.round(verdict.confidence * 100)}%</b> <span className="muted">{verdict.notes}</span>
            </span>
          </div>
        ) : null}
        {milestone.note ? <p className="ms-note small">{milestone.note}</p> : null}
        {milestone.payout ? (
          <p className="faint small" style={{ marginTop: 6 }}>
            <Lock size={12} /> Paid out {formatUsd(milestone.payout.amountUsd)}
            {milestone.payout.status === "failed" ? ` · payout failed: ${milestone.payout.error ?? "unknown"}` : milestone.payout.batchId ? ` · batch ${milestone.payout.batchId}` : " · demo"}
          </p>
        ) : null}
        {children ? <div className="ms-actions">{children}</div> : null}
      </div>
    </article>
  );
}

export function MilestonePlan({
  project,
  title = "Milestone plan",
  actions,
}: {
  project: Project;
  title?: string;
  actions?: (milestone: MilestoneView) => React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-title">
        <h3>{title}</h3>
        <span className="sub">{project.plan?.source === "agent" ? "Planned by the AI agent" : "Planned from a template"}</span>
      </div>
      {project.plan?.notes ? <p className="muted small" style={{ marginBottom: 14 }}>{project.plan.notes}</p> : null}
      <div className="milestones">
        {project.milestones.map((milestone, index) => (
          <MilestoneCard key={milestone.id} milestone={milestone} index={index}>
            {actions?.(milestone)}
          </MilestoneCard>
        ))}
      </div>
    </section>
  );
}
