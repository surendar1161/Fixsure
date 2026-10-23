import { AlertTriangle, BadgeCheck, Clock, ExternalLink, Info, Lock, Undo2, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { CompareSlider, SinglePhoto } from "@/components/CompareSlider";
import { MoneyFlow, ScopeCard, StatusPill, StatusRail, Timeline, VerdictCard } from "@/components/JobParts";
import { hasStaffSession, roleForKey } from "@/lib/auth";
import { paypalConfigured } from "@/lib/config";
import { links } from "@/lib/links";
import { getJob } from "@/lib/store";
import { formatUsd, formatWhen } from "@/lib/types";
import { presentJob } from "@/lib/views";
import { CustomerProject } from "@/components/CustomerProject";

export const metadata: Metadata = { title: "Your repair" };

export default async function CustomerJobPage({ params, searchParams }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const key = typeof query.k === "string" ? query.k : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;

  const job = await getJob(id);
  if (!job) notFound();
  const role = roleForKey(job, key);
  if (role === "technician") redirect(links.technician(job));
  if (role !== "customer") {
    if (await hasStaffSession()) redirect(links.review(job.id));
    notFound();
  }

  const view = await presentJob(job, "customer", key);
  const paypal = paypalConfigured();
  if (view.project) return <CustomerProject job={job} view={view} customerKey={key!} error={error} paypalCancelled={query.paypal === "cancelled"} />;
  const api = `/api/v1/jobs/${job.id}`;

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link href="/">Home</Link> / Job {job.id.slice(0, 8)}
          </div>
          <div className="row">
            <h1>{view.scope.title}</h1>
            <StatusPill status={view.status} label={view.payout?.status === "failed" && view.status === "released" ? "Captured" : view.statusLabel} />
          </div>
          <p>
            For {view.customerName} in {view.city} · created {formatWhen(view.createdAt)}
          </p>
        </div>
      </div>

      {error ? (
        <div className="banner banner-error">
          <AlertTriangle size={16} /> {error}
        </div>
      ) : null}
      {query.paypal === "cancelled" && view.status === "scoped" ? (
        <div className="banner banner-warn">
          <Info size={16} /> You left PayPal before approving. Nothing was held. You can try again below.
        </div>
      ) : null}

      <StatusRail job={view} />

      <div className="layout">
        <div className="stack">
          {view.photos.after ? <CompareSlider before={view.photos.before} after={view.photos.after} /> : <SinglePhoto src={view.photos.before} label="Before" />}
          <ScopeCard job={view} />
          <Timeline job={view} />
        </div>

        <aside className="stack">
          <section className="card">
            {view.status === "scoped" ? (
              <>
                <div className="card-title">
                  <h3>Hold the payment</h3>
                </div>
                <p className="price">{formatUsd(view.money.priceUsd)}</p>
                <p className="muted" style={{ margin: "10px 0 18px" }}>
                  PayPal authorizes this amount now and only captures it once the after photo proves the fix. If the work is not done, the hold is returned.
                </p>
                {view.hold?.approveUrl ? (
                  <a className="btn btn-paypal btn-lg" style={{ width: "100%" }} href={view.hold.approveUrl}>
                    <ExternalLink size={18} /> Continue to PayPal
                  </a>
                ) : (
                  <ActionButton
                    label={paypal ? "Authorize with PayPal" : "Place a demo hold"}
                    icon={<Lock size={18} />}
                    path={`${api}/hold`}
                    token={key}
                    then="approve"
                    variant="paypal"
                    size="lg"
                    block
                  />
                )}
                {!paypal ? <p className="faint small" style={{ marginTop: 10 }}>Demo mode. Add PayPal sandbox keys to authorize a real order.</p> : null}
              </>
            ) : null}

            {view.status === "funded" ? (
              <>
                <div className="card-title">
                  <h3>Waiting for the technician</h3>
                  <Clock size={18} className="faint" />
                </div>
                <p className="muted" style={{ marginBottom: 16 }}>
                  {formatUsd(view.money.priceUsd)} is held{view.hold?.authorizationExpiresAt ? ` until ${formatWhen(view.hold.authorizationExpiresAt)}` : ""}. You are charged
                  only when the after photo passes the check.
                </p>
                {job.sample ? (
                  <Link href={links.technician(job)} className="btn btn-dark" style={{ width: "100%", marginBottom: 10 }}>
                    <Wrench size={16} /> Demo: open the technician view
                  </Link>
                ) : null}
                {!job.afterImage ? (
                  <ActionButton
                    label="Cancel and return the hold"
                    icon={<Undo2 size={16} />}
                    path={`${api}/hold`}
                    method="DELETE"
                    token={key}
                    variant="danger"
                    confirm="Cancel this job and void the PayPal hold?"
                    block
                  />
                ) : null}
              </>
            ) : null}

            {view.status === "review" ? (
              <>
                <div className="card-title">
                  <h3>A person is checking the photos</h3>
                </div>
                <p className="muted">The model was not sure enough to release the money on its own. A reviewer will release it, ask for a better photo, or return the hold.</p>
              </>
            ) : null}

            {view.status === "released" && view.payout?.status === "failed" ? (
              <div className="banner banner-warn" style={{ margin: 0 }}>
                <AlertTriangle size={18} />
                <span>
                  <b>Repair verified and captured.</b> {formatUsd(view.money.priceUsd)} was taken from the hold. The {formatUsd(view.money.payoutUsd)} payout to the technician did not go through.
                </span>
              </div>
            ) : null}

            {view.status === "released" && view.payout?.status !== "failed" ? (
              <div className="banner banner-ok" style={{ margin: 0 }}>
                <BadgeCheck size={18} />
                <span>
                  <b>Repair verified and paid.</b> {formatUsd(view.money.priceUsd)} was captured and the technician received {formatUsd(view.money.payoutUsd)}.
                </span>
              </div>
            ) : null}

            {view.status === "voided" ? (
              <div className="banner banner-info" style={{ margin: 0 }}>
                <Undo2 size={18} />
                <span>The hold was returned. You were not charged.</span>
              </div>
            ) : null}
          </section>
          <MoneyFlow job={view} />
          <VerdictCard job={view} />
        </aside>
      </div>
    </div>
  );
}
