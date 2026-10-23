import { BadgeCheck, Clock, Lock, Search, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareSlider, SinglePhoto } from "@/components/CompareSlider";
import { ProofForm } from "@/components/Forms";
import { StatusPill, VerdictCard } from "@/components/JobParts";
import { roleForKey } from "@/lib/auth";
import { paypalConfigured } from "@/lib/config";
import { getJob } from "@/lib/store";
import { formatUsd } from "@/lib/types";
import { viewJob } from "@/lib/views";

export const metadata: Metadata = { title: "Technician job" };

export default async function TechnicianJobPage({ params, searchParams }: PageProps<"/jobs/[id]/repair">) {
  const { id } = await params;
  const query = await searchParams;
  const key = typeof query.k === "string" ? query.k : undefined;

  const job = await getJob(id);
  if (!job || roleForKey(job, key) !== "technician") notFound();
  const view = viewJob(job, "technician", key);

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">Technician · job {job.id.slice(0, 8)}</div>
          <div className="row">
            <h1>{view.scope.title}</h1>
            <StatusPill status={view.status} label={view.statusLabel} />
          </div>
          <p>
            {view.scope.trade} in {view.city}
          </p>
        </div>
        <div className="kpi" style={{ minWidth: 220 }}>
          <small>
            <Lock size={14} /> Your payout when the proof passes
          </small>
          <b>{formatUsd(view.money.payoutUsd)}</b>
        </div>
      </div>

      <div className="layout">
        <div className="stack">
          {view.photos.after ? <CompareSlider before={view.photos.before} after={view.photos.after} /> : <SinglePhoto src={view.photos.before} label="Before" />}
          <section className="card">
            <div className="card-title">
              <h3>The brief</h3>
            </div>
            <p>{view.scope.summary}</p>
            <p className="muted small" style={{ marginTop: 10 }}>
              Customer note: “{view.description}”
            </p>
          </section>
        </div>

        <aside className="stack">
          <section className="card">
            {view.status === "scoped" ? (
              <div className="banner banner-info" style={{ margin: 0 }}>
                <Clock size={16} /> The customer has not placed the PayPal hold yet. Hold off until they do.
              </div>
            ) : null}
            {view.status === "funded" && !view.photos.after ? (
              <>
                <div className="card-title">
                  <h3>Submit proof of the fix</h3>
                </div>
                <p className="muted small" style={{ marginBottom: 16 }}>
                  Shoot the same spot from the same angle. A clear match releases {formatUsd(view.money.payoutUsd)} to your PayPal right away.
                </p>
                <ProofForm jobId={job.id} token={key!} emailRequired={paypalConfigured()} sample={view.sample} />
              </>
            ) : null}
            {view.status === "review" ? (
              <div className="banner banner-warn" style={{ margin: 0 }}>
                <Search size={16} /> A reviewer is checking your photo. If they need a clearer one, this page will ask for it again.
              </div>
            ) : null}
            {view.status === "released" ? (
              <div className="banner banner-ok" style={{ margin: 0 }}>
                <BadgeCheck size={16} />
                <span>
                  Paid. {formatUsd(view.payout?.amountUsd ?? view.money.payoutUsd)}{" "}
                  {view.payout?.status === "demo" ? "in demo mode." : view.payout?.status === "failed" ? "is waiting on a payout retry." : `sent to ${view.technicianEmail}.`}
                </span>
              </div>
            ) : null}
            {view.status === "voided" ? (
              <div className="banner banner-info" style={{ margin: 0 }}>
                <Undo2 size={16} /> This job was cancelled and the hold returned.
              </div>
            ) : null}
          </section>
          <VerdictCard job={view} />
          {view.sample ? (
            <Link className="btn btn-ghost" href="/review">
              Demo: open the review desk
            </Link>
          ) : null}
          <p className="faint small">This link is your access to the job. Do not share it.</p>
        </aside>
      </div>
    </div>
  );
}
