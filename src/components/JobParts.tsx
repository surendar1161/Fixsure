import { ArrowDownToLine, BadgeCheck, Camera, Check, CircleDollarSign, Hand, Landmark, Lock, Sparkles, Undo2, X } from "lucide-react";
import { formatUsd, formatWhen, type JobStatus } from "@/lib/types";
import type { JobView } from "@/lib/views";

export function StatusPill({ status, label }: { status: JobStatus; label: string }) {
  return <span className={`pill pill-${status}`}>{label}</span>;
}

const RAIL = [
  { key: "scoped", title: "Priced", hint: "AI read the photo" },
  { key: "funded", title: "Funds held", hint: "PayPal authorization" },
  { key: "proof", title: "Proof checked", hint: "Before vs after" },
  { key: "released", title: "Paid", hint: "Captured and paid out" },
] as const;

export function StatusRail({ job }: { job: JobView }) {
  const reached: Record<JobStatus, number> = { scoped: 0, funded: 1, review: 2, released: 4, voided: -1 };
  const at = reached[job.status];
  return (
    <div className="rail">
      {RAIL.map((step, index) => {
        let state = index < at ? "done" : index === at ? "now" : "";
        if (job.status === "voided") state = index === 0 ? "done" : "";
        if (job.status === "review" && index === 2) state = "now";
        const payoutFailed = step.key === "released" && job.payout?.status === "failed";
        return (
          <div key={step.key} className={`rail-step ${state}`}>
            <span className="dot">{state === "done" ? <Check size={15} strokeWidth={3} /> : index + 1}</span>
            <span>
              <b>{step.key === "proof" && job.status === "review" ? "With a reviewer" : payoutFailed ? "Captured" : step.title}</b>
              {payoutFailed ? "Payout did not go through" : step.hint}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ScopeCard({ job }: { job: JobView }) {
  const { scope } = job;
  return (
    <section className="card">
      <div className="row between">
        <span className="chips">
          <span className="chip">{scope.trade}</span>
          <span className="chip">{job.city}</span>
          <span className="chip">
            <Sparkles size={13} /> {scope.source === "openai" ? "Priced by vision model" : "Priced from description"}
          </span>
        </span>
        <span className="faint small">Scope confidence {Math.round(scope.confidence * 100)}%</span>
      </div>
      <h2 className="scope-title">{scope.title}</h2>
      <p className="muted">{scope.summary}</p>
      <ul className="lines">
        {scope.lineItems.map((item) => (
          <li key={item.name}>
            <span>{item.name}</span>
            <span>{formatUsd(item.amountUsd)}</span>
          </li>
        ))}
        <li className="total">
          <span>Held on PayPal</span>
          <span>{formatUsd(scope.priceUsd)}</span>
        </li>
      </ul>
      {scope.assumptions.length > 0 ? (
        <ul className="assumptions">
          {scope.assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function VerdictCard({ job }: { job: JobView }) {
  const verdict = job.verdict;
  if (!verdict) return null;
  const percent = Math.round(verdict.confidence * 100);
  const threshold = Math.round(job.releaseThreshold * 100);
  const pass = verdict.decision === "release";
  return (
    <section className="card">
      <div className="card-title">
        <h3>AI verdict</h3>
        <span className={`pill ${pass ? "pill-released" : "pill-review"}`}>{pass ? "Auto-released" : "Sent to a reviewer"}</span>
      </div>
      <div className="checks">
        <Check2 ok={verdict.sameJob} label="Same job" />
        <Check2 ok={verdict.issueAddressed} label="Issue fixed" />
        <Check2 ok={verdict.confidence >= job.releaseThreshold} label={`Confidence ≥ ${threshold}%`} />
      </div>
      <div className="meter" style={{ marginTop: 26 }}>
        <div className="meter-bar">
          <div className={`meter-fill ${pass ? "pass" : "fail"}`} style={{ width: `${percent}%` }} />
          <div className="meter-mark" style={{ left: `${threshold}%` }}>
            <span>Release line {threshold}%</span>
          </div>
        </div>
        <div className="meter-legend">
          <span>Model confidence</span>
          <b>{percent}%</b>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>
        “{verdict.notes}”
      </p>
      <p className="faint small" style={{ marginTop: 8 }}>
        {verdict.source === "openai" ? "Judged by the OpenAI vision model." : "No vision model configured, so a person decides."}
      </p>
    </section>
  );
}

function Check2({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`check ${ok ? "yes" : "no"}`}>
      <span className="faint">{label}</span>
      <b>
        {ok ? <Check size={15} strokeWidth={3} /> : <X size={15} strokeWidth={3} />}
        {ok ? "Yes" : "No"}
      </b>
    </div>
  );
}

/** Where the money is right now: held, captured, split into payout and fee. */
export function MoneyFlow({ job }: { job: JobView }) {
  const { money, hold, payout, status } = job;
  const held = status !== "scoped";
  const captured = status === "released";
  const voided = status === "voided";
  const mode = hold?.mode ?? "demo";
  const rows = [
    {
      icon: <Lock size={16} />,
      title: voided ? "Hold returned" : "Authorized on PayPal",
      note: voided
        ? "Authorization voided, nothing charged"
        : captured
          ? `${mode === "demo" ? "Demo hold" : `PayPal ${mode} authorization`} held until the proof passed`
          : held
            ? `${mode === "demo" ? "Demo hold" : `PayPal ${mode}`}, not charged yet`
            : "Waiting for the customer",
      amount: money.priceUsd,
      on: held && !voided,
      now: !held,
    },
    {
      icon: <Hand size={16} />,
      title: "Captured",
      note: captured ? (hold?.captureId ? `Capture ${hold.captureId}` : "Demo capture") : "Only after the fix is proven",
      amount: money.priceUsd,
      on: captured,
      now: held && !captured && !voided,
    },
    {
      icon: <ArrowDownToLine size={16} />,
      title: "Technician payout",
      note: payout ? (payout.status === "failed" ? `Failed: ${payout.error ?? "unknown"}` : payout.batchId ? `PayPal Payouts ${payout.batchId}` : "Demo payout") : "PayPal Payouts",
      amount: money.payoutUsd,
      on: payout?.status === "sent" || payout?.status === "demo",
      now: payout?.status === "failed",
    },
    {
      icon: <Landmark size={16} />,
      title: "Platform fee",
      note: "Kept by the marketplace",
      amount: money.feeUsd,
      on: captured,
      now: false,
    },
  ];
  return (
    <section className="card">
      <div className="card-title">
        <h3>Money flow</h3>
        <span className="pill plain pill-dark">
          <CircleDollarSign size={13} /> {mode === "demo" ? "Demo mode" : `PayPal ${mode}`}
        </span>
      </div>
      <div className="flow">
        {rows.map((row) => (
          <div key={row.title} className={`flow-row${row.on ? " on" : ""}${row.now ? " now" : ""}`}>
            <span className="flow-icon">{row.icon}</span>
            <span>
              <b>{row.title}</b>
              <small>{row.note}</small>
            </span>
            <span className="flow-amount">{formatUsd(row.amount)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const EVENT_ICON: Record<string, React.ReactNode> = {
  scoped: <Sparkles size={14} />,
  funded: <Lock size={14} />,
  checked: <Camera size={14} />,
  released: <BadgeCheck size={14} />,
  voided: <Undo2 size={14} />,
};

export function Timeline({ job }: { job: JobView }) {
  return (
    <section className="card">
      <div className="card-title">
        <h3>Timeline</h3>
        <span className="sub">{job.events.length} events</span>
      </div>
      <ol className="timeline">
        {[...job.events].reverse().map((item, index) => (
          <li key={`${item.at}-${index}`}>
            <div>
              <div className="row" style={{ gap: 6 }}>
                <span className="faint">{EVENT_ICON[item.type]}</span>
                <span className="when">{formatWhen(item.at)}</span>
              </div>
              <p>{item.message}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
