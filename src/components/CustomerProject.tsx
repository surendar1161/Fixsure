import { AlertTriangle, BadgeCheck, ExternalLink, HardHat, Info, Lock, Undo2 } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { SinglePhoto } from "@/components/CompareSlider";
import { StatusPill, Timeline } from "@/components/JobParts";
import { MilestonePlan, ProjectProgress } from "@/components/Milestones";
import { paypalConfigured } from "@/lib/config";
import { links } from "@/lib/links";
import { listCrew } from "@/lib/store";
import { formatUsd, formatWhen, type Job } from "@/lib/types";
import type { JobView } from "@/lib/views";

export async function CustomerProject({
  job,
  view,
  customerKey,
  error,
  paypalCancelled,
}: {
  job: Job;
  view: JobView;
  customerKey: string;
  error?: string;
  paypalCancelled: boolean;
}) {
  const project = view.project!;
  const paypal = paypalConfigured();
  const api = `/api/v1/jobs/${job.id}`;
  const held = view.status === "funded" || view.status === "review";
  const started = project.milestones.some((m) => m.status !== "scheduled");
  // Sample projects link straight to the crew portals so one person can play every role.
  const crewIds = new Set(project.milestones.map((m) => m.crew?.id));
  const demoCrew = job.sample ? (await listCrew()).filter((member) => crewIds.has(member.id)) : [];

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link href="/">Home</Link> / Project {job.id.slice(0, 8)}
          </div>
          <div className="row">
            <h1>{view.scope.title}</h1>
            <StatusPill status={view.status} label={view.statusLabel} />
          </div>
          <p>
            For {view.customerName} in {view.city} · {project.milestones.length} milestones · created {formatWhen(view.createdAt)}
          </p>
        </div>
      </div>

      {error ? (
        <div className="banner banner-error">
          <AlertTriangle size={16} /> {error}
        </div>
      ) : null}
      {paypalCancelled && view.status === "scoped" ? (
        <div className="banner banner-warn">
          <Info size={16} /> You left PayPal before approving. Nothing was held. You can try again.
        </div>
      ) : null}

      <div className="layout">
        <div className="stack">
          <MilestonePlan project={project} />
          <Timeline job={view} />
        </div>

        <aside className="stack">
          <section className="card">
            {view.status === "scoped" ? (
              <>
                <div className="card-title">
                  <h3>Hold the project total</h3>
                </div>
                <p className="price">{formatUsd(view.money.priceUsd)}</p>
                <p className="muted" style={{ margin: "10px 0 18px" }}>
                  One PayPal authorization covers every milestone. Each milestone is captured only when its proof passes, and whatever is not used is returned.
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
                    token={customerKey}
                    then="approve"
                    variant="paypal"
                    size="lg"
                    block
                  />
                )}
              </>
            ) : null}

            {held ? (
              <>
                <div className="card-title">
                  <h3>{view.status === "review" ? "A milestone is with a reviewer" : "The crew is at work"}</h3>
                  <HardHat size={18} className="faint" />
                </div>
                <p className="muted" style={{ marginBottom: 16 }}>
                  {formatUsd(project.progress.heldUsd)} is still held{view.hold?.authorizationExpiresAt ? ` until ${formatWhen(view.hold.authorizationExpiresAt)}` : ""}. You
                  are charged one milestone at a time, as each one is proven.
                </p>
                {!started ? (
                  <ActionButton
                    label="Cancel and return the hold"
                    icon={<Undo2 size={16} />}
                    path={`${api}/hold`}
                    method="DELETE"
                    token={customerKey}
                    variant="danger"
                    confirm="Cancel this project and void the PayPal hold?"
                    block
                  />
                ) : null}
              </>
            ) : null}

            {view.status === "released" ? (
              <div className="banner banner-ok" style={{ margin: 0 }}>
                <BadgeCheck size={18} />
                <span>
                  <b>Every milestone proven and paid.</b> {formatUsd(project.progress.paidUsd)} was captured across {project.progress.paidCount} milestones.
                </span>
              </div>
            ) : null}

            {view.status === "voided" ? (
              <div className="banner banner-info" style={{ margin: 0 }}>
                <Undo2 size={18} />
                <span>
                  The project was stopped. {project.progress.paidUsd ? `${formatUsd(project.progress.paidUsd)} was paid for finished milestones; the rest of the hold was returned.` : "You were not charged."}
                </span>
              </div>
            ) : null}
          </section>

          <ProjectProgress project={project} held={held} />
          <SinglePhoto src={view.photos.before} label="Before" />

          {demoCrew.length && held ? (
            <section className="card">
              <div className="card-title">
                <h3>Demo: play the crew</h3>
              </div>
              <p className="muted small" style={{ marginBottom: 12 }}>
                Sample project only. Each crew member has a private portal link where they post proof for their milestones.
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                {demoCrew.map((member) => (
                  <Link key={member.id} href={links.crew(member)} className="btn btn-ghost" style={{ justifyContent: "flex-start" }}>
                    <i className={`crew-dot c-${member.color}`} /> {member.name} · {member.trade}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
