import { BadgeCheck, CalendarDays, Clock, Hourglass, MapPin, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MilestoneCard } from "@/components/Milestones";
import { MilestoneProofForm } from "@/components/ProjectForms";
import { crewForKey } from "@/lib/auth";
import { getJob } from "@/lib/store";
import { formatUsd } from "@/lib/types";
import { crewAssignments, type CrewAssignments } from "@/lib/views";

export const metadata: Metadata = { title: "Crew portal", robots: { index: false } };

type Assignment = CrewAssignments["data"][number];

function Group({ title, icon, items, empty, children }: { title: string; icon: React.ReactNode; items: Assignment[]; empty: string; children: (item: Assignment) => React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-title">
        <h3>{title}</h3>
        <span className="faint">{icon}</span>
      </div>
      {items.length ? <div className="milestones">{items.map(children)}</div> : <p className="faint small">{empty}</p>}
    </section>
  );
}

export default async function CrewPortalPage({ params, searchParams }: PageProps<"/crew/[crewId]">) {
  const { crewId } = await params;
  const query = await searchParams;
  const key = typeof query.k === "string" ? query.k : undefined;
  const member = await crewForKey(key);
  if (!member || member.id !== crewId) notFound();

  const { crew, data, earnedUsd } = await crewAssignments(member);
  const samples = new Set(
    (await Promise.all([...new Set(data.map((item) => item.job.id))].map((id) => getJob(id)))).filter((job) => job?.sample).map((job) => job!.id),
  );
  const ready = data.filter((item) => item.status === "scheduled" && item.job.funded);
  const waiting = data.filter((item) => item.status === "scheduled" && !item.job.funded);
  const review = data.filter((item) => item.status === "review");
  const paid = data.filter((item) => item.status === "paid");

  const project = (item: Assignment) => (
    <p className="small faint ms-project">
      <MapPin size={12} /> {item.job.title} · {item.job.city}
    </p>
  );

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">Crew portal</div>
          <div className="row">
            <h1>
              <i className={`crew-dot big c-${crew.color}`} /> {crew.name}
            </h1>
            <span className="pill pill-dark plain">{crew.trade}</span>
          </div>
          <p>Post one photo when a milestone is done. Small steps can be paid by the AI check straight away; bigger ones wait for a person.</p>
        </div>
        <div className="kpi" style={{ minWidth: 200 }}>
          <span className="faint small">
            <Wallet size={14} /> Paid to you
          </span>
          <b>{formatUsd(earnedUsd)}</b>
        </div>
      </div>

      <div className="layout">
        <div className="stack">
          <Group title="Ready for proof" icon={<CalendarDays size={18} />} items={ready} empty="Nothing to prove right now.">
            {(item) => (
              <div key={item.id}>
                {project(item)}
                <MilestoneCard milestone={item} index={item.step}>
                  <div className="crew-proof">
                    {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
                    <img src={item.job.sitePhoto} alt="Site before work" />
                    <MilestoneProofForm jobId={item.job.id} milestoneId={item.id} token={key!} sample={samples.has(item.job.id)} />
                  </div>
                </MilestoneCard>
              </div>
            )}
          </Group>
          <Group title="Waiting on a person" icon={<Hourglass size={18} />} items={review} empty="Nothing is waiting on a reviewer.">
            {(item) => (
              <div key={item.id}>
                {project(item)}
                <MilestoneCard milestone={item} index={item.step} />
              </div>
            )}
          </Group>
        </div>
        <aside className="stack">
          <Group title="Booked, not funded yet" icon={<Clock size={18} />} items={waiting} empty="No upcoming bookings.">
            {(item) => (
              <div key={item.id}>
                {project(item)}
                <MilestoneCard milestone={item} index={item.step} />
              </div>
            )}
          </Group>
          <Group title="Paid" icon={<BadgeCheck size={18} />} items={paid} empty="No paid milestones yet.">
            {(item) => (
              <div key={item.id}>
                {project(item)}
                <MilestoneCard milestone={item} index={item.step} />
              </div>
            )}
          </Group>
        </aside>
      </div>
    </div>
  );
}
