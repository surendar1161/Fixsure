import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ScheduleWorkspace } from "@/components/schedule/ScheduleWorkspace";
import { paypalConfigured, visionConfigured } from "@/lib/config";
import { requireStaffPage } from "@/lib/staff-page";
import { scheduleData } from "@/lib/views";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  await requireStaffPage("/schedule");
  const data = await scheduleData();
  return (
    <div className="wrap page wide">
      <div className="page-head">
        <div>
          <div className="crumbs">Dispatch / Schedule</div>
          <h1>Crew schedule</h1>
          <p>Every milestone on every project, booked to a crew member. Each bar is paid from the customer&apos;s PayPal hold once its proof passes.</p>
        </div>
        <div className="row">
          <Link href="/crew" className="btn btn-ghost">
            <Users size={16} /> Crew and portal links
          </Link>
          <Link href="/projects/new" className="btn btn-primary">
            <Plus size={16} /> New project
          </Link>
        </div>
      </div>
      <ScheduleWorkspace initial={data} now={new Date().toISOString()} copilot={{ enabled: visionConfigured(), paypalTools: paypalConfigured() }} />
    </div>
  );
}
