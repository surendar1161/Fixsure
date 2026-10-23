import { BadgeCheck, CircleDollarSign, Lock, Search } from "lucide-react";
import type { Metadata } from "next";
import { JobsGrid } from "@/components/JobsGrid";
import { SignOut } from "@/components/SignOut";
import { requireStaffPage } from "@/lib/staff-page";
import { listJobs } from "@/lib/store";
import { formatUsd } from "@/lib/types";
import { viewRow } from "@/lib/views";

export const metadata: Metadata = { title: "Review desk" };

export default async function ReviewDeskPage() {
  await requireStaffPage("/review");
  const rows = (await listJobs()).map(viewRow);
  const sum = (status: string) => rows.filter((row) => row.status === status).reduce((total, row) => total + row.priceUsd, 0);
  const autoReleased = rows.filter((row) => row.status === "released" && row.decision === "release").length;
  const released = rows.filter((row) => row.status === "released").length;

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">Staff</div>
          <h1>Review desk</h1>
          <p>Every job the model could not clear on its own lands here. Click a row to compare the photos and decide.</p>
        </div>
        <SignOut />
      </div>
      <div className="kpis">
        <div className="kpi">
          <small>
            <Search size={14} /> Needs a person
          </small>
          <b>{rows.filter((row) => row.status === "review").length}</b>
        </div>
        <div className="kpi">
          <small>
            <Lock size={14} /> Held on PayPal
          </small>
          <b>{formatUsd(sum("funded") + sum("review"))}</b>
        </div>
        <div className="kpi">
          <small>
            <CircleDollarSign size={14} /> Captured
          </small>
          <b>{formatUsd(sum("released"))}</b>
        </div>
        <div className="kpi">
          <small>
            <BadgeCheck size={14} /> Auto-released
          </small>
          <b>{released ? `${Math.round((autoReleased / released) * 100)}%` : "—"}</b>
        </div>
      </div>
      <JobsGrid initialRows={rows} />
    </div>
  );
}
