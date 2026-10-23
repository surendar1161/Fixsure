import { BadgeCheck, CalendarRange, Database, RefreshCw, RotateCcw, Send, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { CompareSlider, SinglePhoto } from "@/components/CompareSlider";
import { CopyLink } from "@/components/Forms";
import { MoneyFlow, ScopeCard, StatusPill, StatusRail, Timeline, VerdictCard } from "@/components/JobParts";
import { MilestonePlan, ProjectProgress } from "@/components/Milestones";
import { RejectMilestone } from "@/components/ProjectForms";
import { RetryPayout } from "@/components/RetryPayout";
import { similarJobs } from "@/lib/elastic";
import { requireStaffPage } from "@/lib/staff-page";
import { links } from "@/lib/links";
import { getJob, listCrew } from "@/lib/store";
import { formatUsd, formatWhen, STATUS_LABEL } from "@/lib/types";
import { presentJob } from "@/lib/views";

export const metadata: Metadata = { title: "Review job" };

export default async function ReviewJobPage({ params }: PageProps<"/review/[id]">) {
  const { id } = await params;
  await requireStaffPage(`/review/${id}`);
  const job = await getJob(id);
  if (!job) notFound();

  const view = await presentJob(job, "staff");
  const project = view.project;
  const similar = await similarJobs(job);
  const bookedIds = new Set((job.milestones ?? []).filter((m) => m.status !== "cancelled").map((m) => m.crewId));
  const projectCrew = (await listCrew()).filter((member) => bookedIds.has(member.id));
  const api = `/api/v1/jobs/${job.id}`;
  const delta = similar.medianPaidUsd ? Math.round(((view.money.priceUsd - similar.medianPaidUsd) / similar.medianPaidUsd) * 100) : null;

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link href="/review">Review desk</Link> / {job.id.slice(0, 8)}
          </div>
          <div className="row">
            <h1>{view.scope.title}</h1>
            <StatusPill status={view.status} label={view.payout?.status === "failed" && view.status === "released" ? "Captured" : view.statusLabel} />
          </div>
          <p>
            {view.customerName} · {view.city} · updated {formatWhen(view.updatedAt)}
          </p>
        </div>
      </div>

      {project ? null : <StatusRail job={view} />}

      <div className="layout">
        {project ? (
          <div className="stack">
            <MilestonePlan
              project={project}
              title="Milestones"
              actions={(milestone) => {
                const base = `${api}/milestones/${milestone.id}`;
                if (milestone.status === "review") {
                  return (
                    <>
                      <ActionButton label={`Approve and pay ${formatUsd(milestone.amountUsd)}`} icon={<BadgeCheck size={16} />} path={`${base}/approve`} variant="ok" />
                      {milestone.captureId ? null : <RejectMilestone jobId={job.id} milestoneId={milestone.id} />}
                    </>
                  );
                }
                if (milestone.status === "paid" && milestone.payout?.status === "failed") {
                  return <ActionButton label="Retry payout" icon={<RefreshCw size={16} />} path={`${base}/payout/retry`} variant="ghost" />;
                }
                return null;
              }}
            />
            <SinglePhoto src={view.photos.before} label="Before" />
            <Timeline job={view} />
          </div>
        ) : (
          <div className="stack">
            {view.photos.after ? <CompareSlider before={view.photos.before} after={view.photos.after} /> : <SinglePhoto src={view.photos.before} label="Before" />}
            <VerdictCard job={view} />
            <ScopeCard job={view} />
            <Timeline job={view} />
          </div>
        )}

        <aside className="stack">
          <section className="card">
            <div className="card-title">
              <h3>Decision</h3>
            </div>
            {project ? (
              <div style={{ display: "grid", gap: 10 }}>
                <p className="muted small">
                  {project.milestones.filter((m) => m.status === "review").length
                    ? "Approve or send back each milestone on the left. Approving captures that slice of the hold and pays the crew member."
                    : view.status === "funded"
                      ? "No milestone is waiting on a person."
                      : `This project is ${STATUS_LABEL[view.status].toLowerCase()}.`}
                </p>
                <Link href="/schedule" className="btn btn-dark" style={{ width: "100%" }}>
                  <CalendarRange size={16} /> Open the schedule board
                </Link>
                {view.status === "funded" || view.status === "review" ? (
                  <ActionButton
                    label={project.progress.paidUsd ? "Stop and return the rest" : "Return the hold"}
                    icon={<Undo2 size={16} />}
                    path={`${api}/void`}
                    variant="danger"
                    confirm="Stop this project? Paid milestones stay paid; the rest of the PayPal hold is voided."
                    block
                  />
                ) : null}
              </div>
            ) : view.status === "review" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <ActionButton label={`Release ${formatUsd(view.money.priceUsd)}`} icon={<BadgeCheck size={18} />} path={`${api}/release`} variant="ok" size="lg" block />
                {view.photos.after ? (
                  <ActionButton label="Ask for a clearer photo" icon={<RotateCcw size={16} />} path={`${api}/reopen`} variant="ghost" block />
                ) : null}
                <ActionButton
                  label="Return the hold"
                  icon={<Undo2 size={16} />}
                  path={`${api}/void`}
                  variant="danger"
                  confirm="Void the PayPal authorization and return the hold to the customer?"
                  block
                />
              </div>
            ) : view.status === "funded" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <p className="muted small">Waiting for the technician&apos;s after photo.</p>
                <ActionButton label="Return the hold" icon={<Undo2 size={16} />} path={`${api}/void`} variant="danger" confirm="Void the PayPal authorization?" block />
              </div>
            ) : view.status === "released" && view.payout?.status === "failed" ? (
              <RetryPayout jobId={job.id} email={view.technicianEmail ?? ""} />
            ) : (
              <p className="muted small">Nothing to decide. This job is {STATUS_LABEL[view.status].toLowerCase()}.</p>
            )}
          </section>

          <section className="card">
            <div className="card-title">
              <h3>Similar jobs</h3>
              <span className="pill plain pill-scoped">
                <Database size={12} /> {similar.source === "elastic" ? "Elastic" : "Local ledger"}
              </span>
            </div>
            {similar.medianPaidUsd ? (
              <p className="small" style={{ marginBottom: 12 }}>
                Median paid price <b>{formatUsd(similar.medianPaidUsd)}</b>
                {delta !== null ? (
                  <span className={Math.abs(delta) > 25 ? "" : "faint"} style={Math.abs(delta) > 25 ? { color: "var(--warn)", fontWeight: 600 } : undefined}>
                    {" "}
                    · {delta === 0 ? "this quote is in line" : `this quote is ${Math.abs(delta)}% ${delta > 0 ? "above" : "below"}`}
                  </span>
                ) : null}
              </p>
            ) : null}
            {similar.jobs.length ? (
              <ul className="similar">
                {similar.jobs.map((item) => (
                  <li key={item.id}>
                    <b>
                      <Link href={`/review/${item.id}`}>{item.title}</Link>
                    </b>
                    <span className="price-tag">{formatUsd(item.priceUsd)}</span>
                    <span className="faint small">
                      {item.trade} · {item.city}
                    </span>
                    <span className={`pill pill-${item.status}`}>{STATUS_LABEL[item.status]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="faint small">No similar jobs yet. Prices get a benchmark as more jobs are paid.</p>
            )}
          </section>

          {project ? <ProjectProgress project={project} held={view.status === "funded" || view.status === "review"} /> : <MoneyFlow job={view} />}

          <section className="card">
            <div className="card-title">
              <h3>Links</h3>
              <Send size={16} className="faint" />
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <span className="small faint">Customer</span>
              <CopyLink path={view.links.customer!} />
              {view.links.technician ? (
                <>
                  <span className="small faint">Technician</span>
                  <CopyLink path={view.links.technician} />
                </>
              ) : null}
              {projectCrew.map((member) => (
                <div key={member.id} style={{ display: "contents" }}>
                  <span className="small faint">
                    <i className={`crew-dot c-${member.color}`} /> {member.name}, {member.trade}
                  </span>
                  <CopyLink path={links.crew(member)} label="Copy portal link" />
                </div>
              ))}
              {project ? (
                <Link href="/crew" className="small">
                  All crew and their links
                </Link>
              ) : null}
              <span className="small faint">API</span>
              <CopyLink path={view.links.self} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
