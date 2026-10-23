import { Zap } from "lucide-react";
import type { Metadata } from "next";
import { JobsGrid } from "@/components/JobsGrid";
import { zapierConfigured } from "@/lib/config";
import { requireStaffPage } from "@/lib/staff-page";
import { listJobs } from "@/lib/store";
import { viewRow } from "@/lib/views";

export const metadata: Metadata = { title: "Dispatch" };

export default async function DispatchPage() {
  await requireStaffPage("/dispatch");
  const rows = (await listJobs()).map(viewRow);

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">Staff</div>
          <h1>Dispatch</h1>
          <p>Funded jobs are ready for a technician. Each technician link is that technician&apos;s access to one job.</p>
        </div>
      </div>
      <div className={`banner ${zapierConfigured() ? "banner-ok" : "banner-info"}`}>
        <Zap size={16} />
        <span>
          {zapierConfigured()
            ? "Zapier is connected. Each job.funded event already carries the technician link, so your Zap can text or email it."
            : "Set ZAPIER_HOOK_URL to send the technician link automatically on job.funded. Until then, copy it from here."}
        </span>
      </div>
      <JobsGrid initialRows={rows} mode="dispatch" />
    </div>
  );
}
