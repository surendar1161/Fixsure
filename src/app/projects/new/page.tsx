import { Bot, CalendarRange, Camera, Lock, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ActionButton } from "@/components/ActionButton";
import { NewProjectForm } from "@/components/ProjectForms";
import { humanReviewAboveUsd, visionConfigured } from "@/lib/config";
import { formatUsd } from "@/lib/types";

export const metadata: Metadata = { title: "Plan a project" };

function nextWorkingDay() {
  const day = new Date(Date.now() + 86_400_000);
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1);
  return day.toISOString().slice(0, 10);
}

export default async function NewProjectPage() {
  await connection();
  const vision = visionConfigured();
  const limit = humanReviewAboveUsd();
  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link href="/">Home</Link> / New project
          </div>
          <h1>A bigger job, paid step by step</h1>
          <p>The planning agent splits your project into milestones, books the right crew for each one, and pays them only when a photo proves the step is done.</p>
        </div>
        <ActionButton label="Try the sample project" icon={<Sparkles size={16} />} path="/api/v1/projects/sample" then="customer" variant="dark" />
      </div>
      <div className="layout">
        <section className="card">
          <NewProjectForm defaultStart={nextWorkingDay()} />
        </section>
        <aside className="stack">
          <section className="card">
            <div className="card-title">
              <h3>How a project runs</h3>
            </div>
            <div className="flow">
              <div className="flow-row now">
                <span className="flow-icon">
                  <Bot size={16} />
                </span>
                <span>
                  <b>The agent plans it</b>
                  <small>{vision ? "Milestones and prices from your photo." : "Demo mode: milestones from a template."}</small>
                </span>
                <span />
              </div>
              <div className="flow-row">
                <span className="flow-icon">
                  <CalendarRange size={16} />
                </span>
                <span>
                  <b>Crew booked by trade</b>
                  <small>On the dispatch board, by least load.</small>
                </span>
                <span />
              </div>
              <div className="flow-row">
                <span className="flow-icon">
                  <Lock size={16} />
                </span>
                <span>
                  <b>One PayPal hold</b>
                  <small>For the whole project, not charged yet.</small>
                </span>
                <span />
              </div>
              <div className="flow-row">
                <span className="flow-icon">
                  <Camera size={16} />
                </span>
                <span>
                  <b>Paid per proven milestone</b>
                  <small>A partial capture and a payout each time.</small>
                </span>
                <span />
              </div>
            </div>
          </section>
          <div className="banner banner-info" style={{ margin: 0 }}>
            <Bot size={16} />
            <span>
              Milestones up to {formatUsd(limit)} can be released by the AI check alone. Above that, the AI checks and a person approves. Steps a photo cannot prove, like a leak
              test, go to a person.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
