"use client";

import { ImagePlus, Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoDrop } from "@/components/Forms";
import { api, fieldErrors } from "@/lib/client";
import type { JobView } from "@/lib/views";

export function NewProjectForm({ defaultStart }: { defaultStart: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      const { data } = await api<JobView>("/api/v1/projects", { method: "POST", form: new FormData(event.currentTarget) });
      router.push(data.links.customer!);
    } catch (problem) {
      setFields(fieldErrors(problem));
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <PhotoDrop name="photo" label="Photo of the space before work starts" error={fields.photo} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="customerName">Your name</label>
          <input id="customerName" name="customerName" className="input" placeholder="Jordan Lee" maxLength={80} />
          {fields.customerName ? <span className="field-error">{fields.customerName}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="city">City</label>
          <input id="city" name="city" className="input" placeholder="Austin" maxLength={80} />
          {fields.city ? <span className="field-error">{fields.city}</span> : null}
        </div>
      </div>
      <div className="field">
        <label htmlFor="description">What should the crew do?</label>
        <textarea
          id="description"
          name="description"
          className="textarea"
          placeholder="Redo the bathroom: strip the old tiles, replace the supply lines, retile the walls and floor, and refit the shower."
          maxLength={800}
        />
        {fields.description ? <span className="field-error">{fields.description}</span> : null}
      </div>
      <div className="field" style={{ maxWidth: 240 }}>
        <label htmlFor="startDate">Earliest start</label>
        <input id="startDate" name="startDate" type="date" className="input" defaultValue={defaultStart} />
        {fields.startDate ? <span className="field-error">{fields.startDate}</span> : null}
      </div>
      {error && Object.keys(fields).length === 0 ? <div className="banner banner-error">{error}</div> : null}
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
        {busy ? "Planning milestones and booking crew…" : "Plan my project"}
      </button>
    </form>
  );
}

export function MilestoneProofForm({ jobId, milestoneId, token, sample }: { jobId: string; milestoneId: string; token: string; sample: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "upload" | "sample">("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const base = `/api/v1/jobs/${jobId}/milestones/${milestoneId}`;
  const input = `photo-${milestoneId}`;

  async function send(kind: "upload" | "sample", form?: FormData) {
    setBusy(kind);
    setError("");
    setFields({});
    try {
      if (kind === "upload") {
        const body = new FormData();
        const file = form?.get(input);
        if (file) body.set("photo", file);
        await api(`${base}/proof`, { method: "POST", token, form: body });
      } else {
        await api(`${base}/proof/sample`, { method: "POST", token });
      }
      router.refresh();
    } catch (problem) {
      const errors = fieldErrors(problem);
      setFields(errors.photo ? { [input]: errors.photo } : errors);
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
    }
    setBusy("");
  }

  return (
    <form
      className="form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        send("upload", new FormData(event.currentTarget));
      }}
    >
      <PhotoDrop name={input} label="Photo that shows this step is done" error={fields[input]} />
      {error && !fields[input] ? <div className="banner banner-error">{error}</div> : null}
      <div className="row">
        <button className="btn btn-primary" disabled={Boolean(busy)}>
          {busy === "upload" ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          {busy === "upload" ? "Checking the photo…" : "Submit proof"}
        </button>
        {sample ? (
          <button type="button" className="btn btn-ghost" disabled={Boolean(busy)} onClick={() => send("sample")}>
            {busy === "sample" ? <Loader2 size={16} className="spin" /> : <ImagePlus size={16} />}
            Use a sample photo
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function RejectMilestone({ jobId, milestoneId }: { jobId: string; milestoneId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <RotateCcw size={16} /> Send back
      </button>
    );
  }

  async function send() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/jobs/${jobId}/milestones/${milestoneId}/reject`, { method: "POST", json: { note } });
      setOpen(false);
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
    }
    setBusy(false);
  }

  return (
    <div className="reject-box">
      <input className="input" autoFocus placeholder="What should the crew fix or reshoot?" value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />
      <div className="row">
        <button type="button" className="btn btn-danger btn-sm" disabled={busy || note.trim().length < 4} onClick={send}>
          {busy ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />} Send back
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}
