import { BadgeCheck, Camera, Search, Users } from "lucide-react";
import type { Metadata } from "next";
import { CrewRoster } from "@/components/CrewRoster";
import { SignOut } from "@/components/SignOut";
import { paypalConfigured } from "@/lib/config";
import { requireStaffPage } from "@/lib/staff-page";
import { formatUsd } from "@/lib/types";
import { crewRoster } from "@/lib/views";

export const metadata: Metadata = { title: "Crew" };

export default async function CrewPage() {
  await requireStaffPage("/crew");
  const rows = await crewRoster();
  const total = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((sum, row) => sum + pick(row), 0);

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">Staff</div>
          <h1>Crew</h1>
          <p>Everyone the planning agent can book. Copy a crew member&apos;s portal link to send it to them, or fix the PayPal email they are paid at.</p>
        </div>
        <SignOut />
      </div>
      <div className="kpis">
        <div className="kpi">
          <small>
            <Users size={14} /> Crew members
          </small>
          <b>{rows.length}</b>
        </div>
        <div className="kpi">
          <small>
            <Camera size={14} /> Milestones ready for proof
          </small>
          <b>{total((row) => row.workload.readyForProof)}</b>
        </div>
        <div className="kpi">
          <small>
            <Search size={14} /> With a reviewer
          </small>
          <b>{total((row) => row.workload.inReview)}</b>
        </div>
        <div className="kpi">
          <small>
            <BadgeCheck size={14} /> Paid to crew
          </small>
          <b>{formatUsd(total((row) => row.workload.earnedUsd))}</b>
        </div>
      </div>
      <CrewRoster rows={rows} paypalLive={paypalConfigured()} />
    </div>
  );
}
