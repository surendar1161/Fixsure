"use client";

import { Bot, ExternalLink, Loader2, RefreshCw, Send, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { BoardMove } from "@/components/schedule/ScheduleBoard";
import { api } from "@/lib/client";
import { VERIFICATION_LABEL, VERIFICATION_MODES, formatUsd, type VerificationMode } from "@/lib/types";
import type { ScheduleData } from "@/lib/views";

const ScheduleBoard = dynamic(() => import("@/components/schedule/ScheduleBoard"), {
  ssr: false,
  loading: () => (
    <div className="board-loading">
      <Loader2 size={18} className="spin" /> Loading the board…
    </div>
  ),
});

type Toast = { tone: "ok" | "error"; text: string } | null;

type ChatMessage = { role: "user" | "assistant"; content: string; actions?: { tool: string; ok: boolean; summary: string }[] };

function startOfWeek(date: Date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

export function ScheduleWorkspace({ initial, now, copilot }: { initial: ScheduleData; now: string; copilot: { enabled: boolean; paypalTools: boolean } }) {
  const [data, setData] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const range = useMemo(() => {
    const open = data.events.filter((item) => item.status !== "paid").map((item) => Date.parse(item.startDate));
    const start = new Date(open.length ? Math.min(...open) : Date.parse(now));
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 1);
    const end = startOfWeek(start);
    end.setDate(end.getDate() + 28);
    return { start, end };
    // The visible window is fixed on first load so the board does not jump after each drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = useCallback((next: Toast) => {
    setToast(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: next } = await api<ScheduleData>("/api/v1/schedule");
      setData(next);
    } finally {
      setLoading(false);
    }
  }, []);

  const move = useCallback(
    async (change: BoardMove) => {
      try {
        await api(`/api/v1/jobs/${change.jobId}/milestones/${change.milestoneId}`, {
          method: "PATCH",
          json: { crewId: change.crewId, startsAt: change.startsAt, endsAt: change.endsAt },
        });
        flash({ tone: "ok", text: "Saved. The crew portal shows the new booking." });
      } catch (problem) {
        flash({ tone: "error", text: problem instanceof Error ? problem.message : "Could not save that move." });
      }
      await refresh();
    },
    [flash, refresh],
  );

  async function setVerification(jobId: string, milestoneId: string, verification: VerificationMode) {
    try {
      await api(`/api/v1/jobs/${jobId}/milestones/${milestoneId}`, { method: "PATCH", json: { verification } });
      flash({ tone: "ok", text: `Verification set to "${VERIFICATION_LABEL[verification]}".` });
    } catch (problem) {
      flash({ tone: "error", text: problem instanceof Error ? problem.message : "Could not change verification." });
    }
    await refresh();
  }

  const event = data.events.find((item) => item.id === selected) ?? null;
  const crew = event ? data.resources.find((item) => item.id === event.resourceId) : null;
  const counts = {
    scheduled: data.events.filter((item) => item.status === "scheduled").length,
    review: data.events.filter((item) => item.status === "review").length,
    paid: data.events.filter((item) => item.status === "paid").length,
  };

  return (
    <div className="schedule-layout">
      <div className="stack" style={{ minWidth: 0 }}>
        <div className="board-toolbar">
          <div className="chips">
            <span className="chip">
              <i className="legend ms-scheduled" /> Scheduled {counts.scheduled}
            </span>
            <span className="chip">
              <i className="legend ms-review" /> Needs a person {counts.review}
            </span>
            <span className="chip">
              <i className="legend ms-paid" /> Paid {counts.paid}
            </span>
          </div>
          <div className="row">
            {toast ? <span className={`toast toast-${toast.tone}`}>{toast.text}</span> : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
              {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Refresh
            </button>
          </div>
        </div>
        <div className="board-host">
          <ScheduleBoard data={data} start={range.start} end={range.end} onMove={move} onSelect={setSelected} />
        </div>
        <p className="faint small">Drag a scheduled milestone to another day or crew member, or stretch it to change its length. Paid and in-review milestones are locked.</p>
      </div>

      <aside className="stack">
        {event ? (
          <section className="card">
            <div className="card-title">
              <h3>{event.name}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} aria-label="Close">
                <X size={14} />
              </button>
            </div>
            <p className="muted small">
              {event.project} · {event.city}
            </p>
            {event.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated API image, sent with the staff cookie
              <img className="board-photo" src={event.photo} alt={`Proof for ${event.name}`} />
            ) : null}
            <ul className="lines" style={{ marginTop: 12 }}>
              <li>
                <span>Crew</span>
                <span>{crew?.name ?? "Unassigned"}</span>
              </li>
              <li>
                <span>Amount</span>
                <span>{formatUsd(event.amountUsd)}</span>
              </li>
              <li>
                <span>Status</span>
                <span>{event.statusLabel}</span>
              </li>
              {event.confidence !== null ? (
                <li>
                  <span>AI confidence</span>
                  <span>{Math.round(event.confidence * 100)}%</span>
                </li>
              ) : null}
            </ul>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="verification">How it is verified</label>
              <select
                id="verification"
                className="input"
                value={event.verification}
                disabled={event.status !== "scheduled"}
                onChange={(change) => setVerification(event.jobId, event.milestoneId, change.target.value as VerificationMode)}
              >
                {VERIFICATION_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {VERIFICATION_LABEL[mode]}
                  </option>
                ))}
              </select>
            </div>
            <Link href={event.review} className="btn btn-dark" style={{ width: "100%", marginTop: 12 }}>
              <ExternalLink size={16} /> Open in the review desk
            </Link>
          </section>
        ) : null}
        <Copilot enabled={copilot.enabled} paypalTools={copilot.paypalTools} onChanged={refresh} />
      </aside>
    </div>
  );
}

const SUGGESTIONS = ["Who has the lightest week?", "Move every scheduled painting job one working day later.", "Which milestones need a person, and why?"];

function Copilot({ enabled, paypalTools, onChanged }: { enabled: boolean; paypalTools: boolean; onChanged: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError("");
    try {
      const { data } = await api<{ reply: string; actions: ChatMessage["actions"]; changedSchedule: boolean }>("/api/v1/copilot", {
        method: "POST",
        json: { messages: next.slice(-12).map(({ role, content: body }) => ({ role, content: body })) },
      });
      setMessages([...next, { role: "assistant", content: data.reply, actions: data.actions }]);
      if (data.changedSchedule) onChanged();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The copilot did not answer.");
    }
    setBusy(false);
  }

  return (
    <section className="card copilot">
      <div className="card-title">
        <h3>
          <Bot size={18} /> Dispatch copilot
        </h3>
        <span className="sub">{paypalTools ? "Board + PayPal Agent Toolkit" : "Board tools"}</span>
      </div>
      {!enabled ? (
        <p className="muted small">Add OPENAI_API_KEY to turn on the copilot. It can move and reassign milestones, and with PayPal keys it can look up orders and raise change-order invoices.</p>
      ) : (
        <>
          <div className="chat">
            {messages.length === 0 ? (
              <div className="chips">
                {SUGGESTIONS.map((item) => (
                  <button key={item} type="button" className="chip chip-button" onClick={() => send(item)}>
                    <Sparkles size={12} /> {item}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={`bubble bubble-${message.role}`}>
                  <p>{message.content}</p>
                  {message.actions?.length ? (
                    <ul>
                      {message.actions.map((action, actionIndex) => (
                        <li key={actionIndex} className={action.ok ? "ok" : "bad"}>
                          {action.summary}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            )}
            {busy ? (
              <div className="bubble bubble-assistant">
                <Loader2 size={14} className="spin" /> Working…
              </div>
            ) : null}
          </div>
          {error ? <span className="field-error">{error}</span> : null}
          <form
            className="chat-input"
            onSubmit={(change) => {
              change.preventDefault();
              send(draft);
            }}
          >
            <input className="input" placeholder="Ask or tell the copilot…" value={draft} maxLength={2000} onChange={(change) => setDraft(change.target.value)} />
            <button className="btn btn-primary" disabled={busy || !draft.trim()} aria-label="Send">
              <Send size={16} />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
