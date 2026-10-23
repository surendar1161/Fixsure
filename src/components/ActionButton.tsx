"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api } from "@/lib/client";
import type { JobView } from "@/lib/views";

type Then = "refresh" | "customer" | "approve";

export function ActionButton({
  label,
  icon,
  path,
  method = "POST",
  token,
  json,
  then = "refresh",
  variant = "primary",
  size,
  confirm,
  block,
}: {
  label: string;
  icon?: React.ReactNode;
  path: string;
  method?: "POST" | "DELETE";
  token?: string;
  json?: unknown;
  then?: Then;
  variant?: "primary" | "paypal" | "dark" | "ghost" | "glass" | "ok" | "danger";
  size?: "sm" | "lg";
  confirm?: string;
  block?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError("");
    try {
      const { status, data } = await api<JobView>(path, { method, token, json });
      if (then === "customer" && data.links.customer) {
        router.push(data.links.customer);
        return;
      }
      if (then === "approve" && status === 202 && data.hold?.approveUrl) {
        window.location.assign(data.hold.approveUrl);
        return;
      }
      startTransition(() => router.refresh());
      setBusy(false);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const working = busy || pending;
  return (
    <div style={{ display: "grid", gap: 8, width: block ? "100%" : undefined }}>
      <button
        type="button"
        onClick={run}
        disabled={working}
        className={`btn btn-${variant}${size ? ` btn-${size}` : ""}`}
        style={block ? { width: "100%" } : undefined}
      >
        {working ? <Loader2 size={16} className="spin" /> : icon}
        {label}
      </button>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}
