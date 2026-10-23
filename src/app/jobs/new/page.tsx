import { Lock, ScanEye, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { NewJobForm } from "@/components/Forms";
import { visionConfigured } from "@/lib/config";

export const metadata: Metadata = { title: "Start a job" };

export default async function NewJobPage() {
  await connection();
  const vision = visionConfigured();
  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">New job</div>
          <h1>Show us what is broken</h1>
          <p>One photo and a sentence. You will get a priced scope before anything is held on PayPal.</p>
        </div>
      </div>
      <div className="layout">
        <section className="card">
          <NewJobForm />
        </section>
        <aside className="stack">
          <section className="card">
            <div className="card-title">
              <h3>What happens next</h3>
            </div>
            <div className="flow">
              <div className="flow-row now">
                <span className="flow-icon">
                  <Sparkles size={16} />
                </span>
                <span>
                  <b>AI writes the scope</b>
                  <small>{vision ? "The vision model reads your photo." : "Demo mode: priced from your description."}</small>
                </span>
                <span />
              </div>
              <div className="flow-row">
                <span className="flow-icon">
                  <Lock size={16} />
                </span>
                <span>
                  <b>You approve a PayPal hold</b>
                  <small>Authorized, not charged.</small>
                </span>
                <span />
              </div>
              <div className="flow-row">
                <span className="flow-icon">
                  <ScanEye size={16} />
                </span>
                <span>
                  <b>Charged only on proof</b>
                  <small>Or the hold is returned.</small>
                </span>
                <span />
              </div>
            </div>
          </section>
          <div className="banner banner-info" style={{ margin: 0 }}>
            <ScanEye size={16} />
            <span>Photos are private to this job. Only you, your technician, and a reviewer can open them, using the link keys for this job.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
