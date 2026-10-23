"use client";

import { Camera, Check, Copy, ImagePlus, KeyRound, Loader2, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, fieldErrors } from "@/lib/client";
import type { JobView } from "@/lib/views";

export function PhotoDrop({ name, label, error }: { name: string; label: string; error?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className={`drop${over ? " over" : ""}`} onDragEnter={() => setOver(true)} onDragLeave={() => setOver(false)} onDrop={() => setOver(false)}>
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img className="preview" src={preview} alt="Selected photo" />
            <span className="swap btn btn-sm btn-ghost">
              <ImagePlus size={14} /> Change photo
            </span>
          </>
        ) : (
          <div>
            <span className="drop-icon">
              <Camera size={24} />
            </span>
            <b>Drop a photo or click to choose</b>
            <p className="faint small">JPG, PNG, or WebP, up to 5 MB</p>
          </div>
        )}
        <input
          id={name}
          name={name}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
      </div>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

export function NewJobForm() {
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
      const { data } = await api<JobView>("/api/v1/jobs", { method: "POST", form: new FormData(event.currentTarget) });
      router.push(data.links.customer!);
    } catch (problem) {
      setFields(fieldErrors(problem));
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <PhotoDrop name="photo" label="Photo of the problem" error={fields.photo} />
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
        <label htmlFor="description">What is wrong?</label>
        <textarea id="description" name="description" className="textarea" placeholder="The bathroom tap drips all night, even when closed tight." maxLength={500} />
        {fields.description ? <span className="field-error">{fields.description}</span> : null}
      </div>
      {error && Object.keys(fields).length === 0 ? <div className="banner banner-error">{error}</div> : null}
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
        {busy ? "Reading your photo…" : "Get an AI price"}
      </button>
    </form>
  );
}

export function ProofForm({ jobId, token, emailRequired, sample }: { jobId: string; token: string; emailRequired: boolean; sample: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "upload" | "sample">("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");

  async function send(kind: "upload" | "sample", form?: FormData) {
    setBusy(kind);
    setError("");
    setFields({});
    try {
      if (kind === "upload") {
        await api(`/api/v1/jobs/${jobId}/proof`, { method: "POST", token, form });
      } else {
        await api(`/api/v1/jobs/${jobId}/proof/sample`, { method: "POST", token, json: email ? { email } : {} });
      }
      router.refresh();
    } catch (problem) {
      setFields(fieldErrors(problem));
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
      <PhotoDrop name="photo" label="After photo, same angle as the before photo" error={fields.photo} />
      <div className="field">
        <label htmlFor="email">PayPal email for your payout{emailRequired ? "" : " (optional in demo mode)"}</label>
        <input id="email" name="email" type="email" className="input" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        {fields.email ? <span className="field-error">{fields.email}</span> : null}
      </div>
      {error && !fields.photo && !fields.email ? <div className="banner banner-error">{error}</div> : null}
      <div className="row">
        <button className="btn btn-primary btn-lg" disabled={Boolean(busy)}>
          {busy === "upload" ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
          {busy === "upload" ? "Comparing photos…" : "Submit proof"}
        </button>
        {sample ? (
          <button type="button" className="btn btn-ghost btn-lg" disabled={Boolean(busy)} onClick={() => send("sample")}>
            {busy === "sample" ? <Loader2 size={18} className="spin" /> : <ImagePlus size={18} />}
            Use the sample after photo
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function StaffSignIn({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const key = String(new FormData(event.currentTarget).get("key") ?? "");
      await api("/api/v1/session", { method: "POST", json: { key } });
      router.replace(next);
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="key">Staff key</label>
        <input id="key" name="key" type="password" className="input" autoComplete="current-password" autoFocus />
        <span className="hint">The FIXSURE_STAFF_KEY set on the server.</span>
      </div>
      {error ? <div className="banner banner-error">{error}</div> : null}
      <button className="btn btn-dark btn-lg" disabled={busy}>
        {busy ? <Loader2 size={18} className="spin" /> : <KeyRound size={18} />} Sign in
      </button>
    </form>
  );
}

export function CopyLink({ path, label = "Copy" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-field">
      <code>{path}</code>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}
