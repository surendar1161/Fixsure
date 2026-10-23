"use client";

import { AlertTriangle, CalendarDays, Check, ExternalLink, Loader2, Pencil, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { CopyLink } from "@/components/Forms";
import { api, fieldErrors } from "@/lib/client";
import { CREW_COLORS } from "@/lib/crew-input";
import { formatUsd, formatWhen } from "@/lib/types";
import type { CrewRosterRow, CrewView } from "@/lib/views";

type Draft = { name: string; trade: string; email: string; color: string };

const PLACEHOLDER_EMAIL = /@example\.(com|org|net)$/i;

function CrewFields({
  draft,
  setDraft,
  errors,
  trades,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  errors: Record<string, string>;
  trades: string[];
}) {
  const id = useId();
  const field = (name: keyof Draft, label: string, input: React.ReactNode) => (
    <div className="field">
      {name === "color" ? <span className="label">{label}</span> : <label htmlFor={`${id}-${name}`}>{label}</label>}
      {input}
      {errors[name] ? <span className="field-error">{errors[name]}</span> : null}
    </div>
  );
  return (
    <div className="crew-fields">
      {field(
        "name",
        "Name",
        <input id={`${id}-name`} className="input" value={draft.name} maxLength={60} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />,
      )}
      {field(
        "trade",
        "Trade",
        <>
          <input
            id={`${id}-trade`}
            className="input"
            list={`${id}-trades`}
            value={draft.trade}
            maxLength={40}
            onChange={(event) => setDraft({ ...draft, trade: event.target.value })}
          />
          <datalist id={`${id}-trades`}>
            {trades.map((trade) => (
              <option key={trade} value={trade} />
            ))}
          </datalist>
        </>,
      )}
      {field(
        "email",
        "PayPal email for payouts",
        <input
          id={`${id}-email`}
          className="input"
          type="email"
          value={draft.email}
          onChange={(event) => setDraft({ ...draft, email: event.target.value })}
        />,
      )}
      {field(
        "color",
        "Schedule color",
        <div className="color-picks" role="radiogroup" aria-label="Schedule color">
          {CREW_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={draft.color === color}
              aria-label={color}
              className={`color-pick c-${color}${draft.color === color ? " on" : ""}`}
              onClick={() => setDraft({ ...draft, color })}
            />
          ))}
        </div>,
      )}
    </div>
  );
}

function useCrewSave(onDone: (member: CrewView) => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(path: string, method: "POST" | "PATCH", body: Partial<Draft>) {
    setBusy(true);
    setError("");
    setErrors({});
    try {
      const { data } = await api<CrewView>(path, { method, json: body });
      onDone(data);
      router.refresh();
    } catch (problem) {
      setErrors(fieldErrors(problem));
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
    }
    setBusy(false);
  }

  return { busy, error, errors, save };
}

function CrewRow({ row, trades, paypalLive }: { row: CrewRosterRow; trades: string[]; paypalLive: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({ name: row.name, trade: row.trade, email: row.email, color: row.color });
  const { busy, error, errors, save } = useCrewSave(() => setEditing(false));
  const load = row.workload;
  const placeholder = PLACEHOLDER_EMAIL.test(row.email);

  function submit() {
    const changes: Partial<Draft> = {};
    for (const key of ["name", "trade", "email", "color"] as const) if (draft[key].trim() !== row[key]) changes[key] = draft[key].trim();
    if (!Object.keys(changes).length) {
      setEditing(false);
      return;
    }
    save(`/api/v1/crew/${row.id}`, "PATCH", changes);
  }

  return (
    <article className="crew-row">
      <div className="crew-row-main">
        <div className="crew-who">
          <i className={`crew-dot big c-${row.color}`} />
          <div>
            <b>{row.name}</b>
            <small>
              {row.trade} · <span className={placeholder && paypalLive ? "warn-text" : undefined}>{row.email}</span>
            </small>
          </div>
        </div>
        <div className="crew-earned">
          <b>{formatUsd(load.earnedUsd)}</b>
          <small>
            paid · {load.paid} milestone{load.paid === 1 ? "" : "s"}
          </small>
        </div>
      </div>

      <div className="crew-stats">
        <span className={load.readyForProof ? "crew-stat on" : "crew-stat"}>
          <b>{load.readyForProof}</b> ready for proof
        </span>
        <span className={load.inReview ? "crew-stat warn" : "crew-stat"}>
          <b>{load.inReview}</b> with a reviewer
        </span>
        <span className="crew-stat">
          <b>{load.awaitingHold}</b> awaiting the customer&apos;s hold
        </span>
        <span className="crew-stat">
          <b>{load.bookedDays}</b> day{load.bookedDays === 1 ? "" : "s"} booked
        </span>
      </div>

      <div className="crew-row-meta">
        {load.next ? (
          <span className="muted small">
            <CalendarDays size={14} /> Next: <b>{load.next.milestone}</b> on {load.next.project}, {formatWhen(load.next.startsAt)}
            {load.next.funded ? "" : " (waiting for the customer's hold)"}
          </span>
        ) : (
          <span className="faint small">Nothing booked.</span>
        )}
        {load.failedPayouts ? (
          <span className="warn-text small">
            <AlertTriangle size={14} /> {load.failedPayouts} payout{load.failedPayouts === 1 ? "" : "s"} failed. Fix the email, then retry from the review desk.
          </span>
        ) : null}
        {placeholder && paypalLive ? (
          <span className="warn-text small">
            <AlertTriangle size={14} /> Placeholder email. PayPal payouts to it will fail; use a sandbox account email.
          </span>
        ) : null}
      </div>

      <div className="crew-row-actions">
        <CopyLink path={row.portalUrl} label="Copy portal link" />
        <Link href={row.portalUrl} target="_blank" className="btn btn-sm btn-ghost">
          <ExternalLink size={14} /> Open portal
        </Link>
        {!editing ? (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="crew-edit">
          <CrewFields draft={draft} setDraft={setDraft} errors={errors} trades={trades} />
          {error && !Object.keys(errors).length ? <span className="field-error">{error}</span> : null}
          <div className="row">
            <button type="button" className="btn btn-dark btn-sm" disabled={busy} onClick={submit}>
              {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Save
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setDraft({ name: row.name, trade: row.trade, email: row.email, color: row.color });
                setEditing(false);
              }}
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function AddCrew({ trades, nextColor }: { trades: string[]; nextColor: string }) {
  const empty: Draft = { name: "", trade: "", email: "", color: nextColor };
  const [draft, setDraft] = useState<Draft>(empty);
  const [added, setAdded] = useState<CrewView | null>(null);
  const { busy, error, errors, save } = useCrewSave((member) => {
    setAdded(member);
    setDraft({ ...empty, color: CREW_COLORS[(CREW_COLORS.indexOf(member.color as (typeof CREW_COLORS)[number]) + 1) % CREW_COLORS.length] });
  });

  return (
    <section className="card">
      <div className="card-title">
        <h3>Add a crew member</h3>
        <UserPlus size={18} className="faint" />
      </div>
      <p className="muted small" style={{ marginBottom: 14 }}>
        New crew can be booked by the planning agent straight away. Send them their portal link; it is their sign-in.
      </p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          save("/api/v1/crew", "POST", { name: draft.name.trim(), trade: draft.trade.trim(), email: draft.email.trim(), color: draft.color });
        }}
      >
        <CrewFields draft={draft} setDraft={setDraft} errors={errors} trades={trades} />
        {error && !Object.keys(errors).length ? <span className="field-error">{error}</span> : null}
        <button className="btn btn-dark" disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />} Add crew member
        </button>
      </form>
      {added ? (
        <div className="banner banner-ok" style={{ marginTop: 14, display: "grid", gap: 8 }}>
          <span>
            <Check size={16} /> {added.name} added. Send them this link:
          </span>
          <CopyLink path={added.portalUrl} label="Copy portal link" />
        </div>
      ) : null}
    </section>
  );
}

export function CrewRoster({ rows, paypalLive }: { rows: CrewRosterRow[]; paypalLive: boolean }) {
  const trades = [...new Set(rows.map((row) => row.trade))].sort();
  return (
    <div className="layout">
      <section className="card flush crew-list">
        {rows.map((row) => (
          <CrewRow key={`${row.id}-${row.name}-${row.trade}-${row.email}-${row.color}`} row={row} trades={trades} paypalLive={paypalLive} />
        ))}
      </section>
      <aside className="stack">
        <AddCrew trades={trades} nextColor={CREW_COLORS[rows.length % CREW_COLORS.length]} />
        <section className="card">
          <div className="card-title">
            <h3>How crew sign in</h3>
          </div>
          <p className="muted small">
            There are no passwords. Each portal link carries that person&apos;s crew key, which only reaches milestones booked to them. Treat it like a password:
            send it to them directly, and anyone they forward it to can act as them.
          </p>
        </section>
      </aside>
    </div>
  );
}
