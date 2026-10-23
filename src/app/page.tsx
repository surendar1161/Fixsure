import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarRange,
  Camera,
  ClipboardList,
  Cloud,
  Code2,
  Database,
  FileText,
  Lock,
  ScanEye,
  Sheet,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { CompareSlider } from "@/components/CompareSlider";
import { humanReviewAboveUsd, RELEASE_CONFIDENCE } from "@/lib/config";
import { formatUsd } from "@/lib/types";

const RELEASE_PERCENT = Math.round(RELEASE_CONFIDENCE * 100);

const STEPS = [
  {
    icon: <Camera size={22} />,
    tone: ["#eeecff", "#5b4bff"],
    title: "Snap the problem",
    body: "The customer uploads one photo. A vision model writes the scope and a fair price with line items.",
  },
  {
    icon: <Lock size={22} />,
    tone: ["#e8f1ff", "#2e7cf6"],
    title: "Hold, don't charge",
    body: "PayPal authorizes the price with an Orders v2 AUTHORIZE intent. The customer is not charged yet.",
  },
  {
    icon: <ScanEye size={22} />,
    tone: ["#fff4e0", "#d97706"],
    title: "Prove the fix",
    body: `The technician uploads an after photo. The model checks it is the same job, the issue is fixed, and it is at least ${RELEASE_PERCENT}% sure.`,
  },
  {
    icon: <BadgeCheck size={22} />,
    tone: ["#e3f8ef", "#0f9f6e"],
    title: "Capture and pay",
    body: "A pass captures the hold and pays the technician with PayPal Payouts. Anything unclear goes to a person.",
  },
];

const KINDS = [
  {
    label: "Single repair",
    title: "One fix, one technician",
    tag: "1 job · 1 payment",
    tagClass: "pill-scoped",
    body: "A leak, a broken socket, a door that sticks: anything one person finishes in one visit.",
    flow: ["Photo", "Hold the price", "After photo", "Paid"],
    href: "/jobs/new",
    cta: "Book a repair",
  },
  {
    label: "Project",
    title: "One job, several milestones",
    tag: "1 job · paid per milestone",
    tagClass: "pill-funded",
    body: "Renovations and multi-trade work. Each milestone is proven and paid like its own small repair.",
    flow: ["Photo", "Hold the total", "Proof per step", "Paid per step"],
    href: "/projects/new",
    cta: "Plan a project",
  },
];

const KIND_FACTS: { label: string; repair: string; project: string }[] = [
  { label: "Who does it", repair: "One technician", project: "A crew member per milestone, booked on the schedule board" },
  { label: "Price", repair: "One price from the photo", project: "A price per milestone; the total is their sum" },
  { label: "PayPal hold", repair: "One hold for the price", project: "One hold for the whole total, approved once" },
  { label: "Proof", repair: "One after photo", project: "One photo per milestone, from the crew member who did it" },
  { label: "Payment", repair: "Paid in full when the photo passes", project: "Each milestone is paid as soon as it is proven" },
  { label: "If it stops", repair: "The whole hold goes back", project: "Finished milestones stay paid; the rest goes back" },
];

const SAMPLE_MILESTONES = [
  { title: "Old sink removed", crew: "Ravi · Plumbing", amount: 140, state: "paid", label: "Paid" },
  { title: "New sink and faucet fitted", crew: "Ravi · Plumbing", amount: 460, state: "review", label: "AI 91% · person approves" },
  { title: "Leak check under the sink", crew: "Ravi · Plumbing", amount: 90, state: "scheduled", label: "Person only" },
  { title: "Splash wall painted", crew: "Sam · Painting", amount: 180, state: "scheduled", label: "Scheduled Fri" },
];

const TOOLS = [
  {
    icon: <ShieldCheck size={18} />,
    name: "PayPal",
    role: "Money movement",
    body: "Orders v2 AUTHORIZE holds the money. A repair is captured in full; a project is captured one milestone at a time, and the rest is voided if it stops. Payouts pay whoever did the work. A fixed PayPal-Request-Id on every call means a retry never double-charges.",
    where: "src/lib/paypal.ts · src/lib/projects.ts",
  },
  {
    icon: <Sparkles size={18} />,
    name: "OpenAI + Vercel AI SDK",
    role: "AI models",
    body: "Vision prices the photo and checks every proof photo. The planning agent uses generateObject with a zod schema to split a project into priced milestones. Text inside photos is treated as scenery, so a sign saying “approved” cannot release money.",
    where: "src/lib/vision.ts · src/lib/planner.ts",
  },
  {
    icon: <Bot size={18} />,
    name: "PayPal Agent Toolkit",
    role: "Dispatch copilot",
    body: "Staff ask the copilot to move or reassign milestones in plain language. It also gets the toolkit's order, transaction, and invoice tools for change orders.",
    where: "src/lib/copilot.ts · POST /api/v1/copilot",
  },
  {
    icon: <CalendarRange size={18} />,
    name: "Bryntum Scheduler",
    role: "Crew schedule",
    body: "Every milestone is a bar on a crew member's row. Dragging or stretching a bar saves through the REST API, and paid or in-review milestones are locked in place.",
    where: "/schedule · GET /api/v1/schedule",
  },
  {
    icon: <Sheet size={18} />,
    name: "AG Grid",
    role: "Staff desks",
    body: "The review and dispatch desks are AG Grid tables with status tabs, quick search, a repair or project column, a confidence bar, and click-through to each job.",
    where: "/review · /dispatch",
  },
  {
    icon: <Database size={18} />,
    name: "Elastic",
    role: "Price sanity check",
    body: "Every job is indexed on change. Reviewers see similar past jobs of the same kind and their median paid price, which flags quotes that look off.",
    where: "src/lib/elastic.ts · GET /api/v1/jobs/{id}/similar",
  },
  {
    icon: <Zap size={18} />,
    name: "Zapier",
    role: "Notifications",
    body: "Every job, milestone, and payout change posts a flat event to a catch hook: text the technician on job.funded, or post milestone.review to Slack.",
    where: "src/lib/zapier.ts",
  },
  {
    icon: <Code2 size={18} />,
    name: "Postman + APIMatic",
    role: "Developer surface",
    body: "A versioned REST API with an OpenAPI 3.1 spec and RFC 9457 errors. A Postman collection runs both loops, and APIMatic builds SDKs and a portal that includes the design docs.",
    where: "/api/v1/openapi.json · apimatic/",
  },
  {
    icon: <Cloud size={18} />,
    name: "Render",
    role: "Hosting",
    body: "A one-click Blueprint on the free plan. Render generates the staff key, and the health check reports which integrations are live on the deployed demo.",
    where: "render.yaml · GET /api/v1/health",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">
              <b>PAYPAL</b> Photo-verified escrow for home repairs
            </span>
            <h1>
              Pay for the <em>fix</em>,<br />
              not the promise.
            </h1>
            <p className="hero-lede">
              Book a single repair or a bigger project split into milestones. AI prices the work from one photo, PayPal holds the money, and whoever did the work is
              paid the moment a photo proves it. A person steps in only when the proof is unclear.
            </p>
            <div className="hero-actions">
              <ActionButton label="Try a sample repair" icon={<ArrowRight size={18} />} path="/api/v1/jobs/sample" then="customer" variant="paypal" size="lg" />
              <ActionButton label="Try a sample project" icon={<ClipboardList size={18} />} path="/api/v1/projects/sample" then="customer" variant="glass" size="lg" />
            </div>
            <div className="hero-meta">
              <div>
                <strong>$0</strong>charged until proof
              </div>
              <div>
                <strong>{RELEASE_PERCENT}%</strong>sure before AI releases money
              </div>
              <div>
                <strong>1 hold</strong>even for a whole project
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <CompareSlider before="/proof/before.png" after="/proof/after.png" start={52} />
            <div className="float-card two">
              <div className="float-row">
                <span className="float-icon" style={{ background: "#e8f1ff", color: "#2e7cf6" }}>
                  <Lock size={16} />
                </span>
                <span>
                  <small>Held on PayPal</small>
                  <b>$128.00</b>
                </span>
              </div>
            </div>
            <div className="float-card one">
              <div className="float-row">
                <span className="float-icon" style={{ background: "#e3f8ef", color: "#0f9f6e" }}>
                  <BadgeCheck size={16} />
                </span>
                <span>
                  <small>AI verdict · 94% confident</small>
                  <b>Leak fixed, released</b>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="kinds">
        <div className="wrap">
          <div className="section-head center">
            <span className="kicker">Repair or project</span>
            <h2>One job, or one job in steps</h2>
            <p>
              Everything you book is a job. A small fix is a <b>single repair</b>. Bigger work is a <b>project</b>: still one job, split into milestones that
              different crew members prove and get paid for one at a time.
            </p>
          </div>

          <div className="kinds">
            {KINDS.map((kind) => (
              <article key={kind.label} className="kind">
                <div className="kind-head">
                  <div>
                    <span className="kind-label">{kind.label}</span>
                    <h3>{kind.title}</h3>
                  </div>
                  <span className={`pill plain ${kind.tagClass}`}>{kind.tag}</span>
                </div>
                <p className="muted">{kind.body}</p>
                <div className="kind-flow">
                  {kind.flow.map((step, index) => (
                    <span key={step} className="kind-flow-step">
                      {index > 0 ? <ArrowRight size={14} /> : null}
                      <span className={index === kind.flow.length - 1 ? "kind-paid" : undefined}>{step}</span>
                    </span>
                  ))}
                </div>
                <Link href={kind.href} className="btn btn-ghost kind-cta">
                  {kind.cta} <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>

          <div className="card flush kind-compare">
            <div className="kind-compare-row head">
              <span />
              <span>Single repair</span>
              <span>Project</span>
            </div>
            {KIND_FACTS.map((fact) => (
              <div key={fact.label} className="kind-compare-row">
                <span>{fact.label}</span>
                <span>{fact.repair}</span>
                <span>{fact.project}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }} id="how">
        <div className="wrap">
          <div className="section-head center">
            <span className="kicker">How a repair works</span>
            <h2>Money moves when the photo says so</h2>
            <p>Four steps and one PayPal authorization. A project runs the same steps once for every milestone.</p>
          </div>
          <div className="steps">
            {STEPS.map((step) => (
              <article key={step.title} className="step">
                <span className="step-icon" style={{ background: step.tone[0], color: step.tone[1] }}>
                  {step.icon}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }} id="projects">
        <div className="wrap projects-band">
          <div>
            <span className="kicker">How a project works</span>
            <h2>Paid one proven milestone at a time</h2>
            <p className="muted" style={{ margin: "12px 0 20px" }}>
              A planning agent splits the request into milestones and books the right crew for each. When a crew member proves their milestone, only that amount is
              captured from the hold and paid to them. How a milestone is checked depends on its size:
            </p>
            <ul className="modes">
              <li>
                <span className="chip verify verify-ai">
                  <Bot size={13} /> AI can release
                </span>
                Up to {formatUsd(humanReviewAboveUsd())}, a passing photo pays at once.
              </li>
              <li>
                <span className="chip verify verify-ai_then_human">
                  <ShieldCheck size={13} /> AI checks, person approves
                </span>
                Above that, the model checks and a reviewer signs off.
              </li>
              <li>
                <span className="chip verify verify-human">
                  <UserCheck size={13} /> Person only
                </span>
                For steps a photo cannot prove, like a leak test.
              </li>
            </ul>
            <Link href="/schedule" className="btn btn-ghost" style={{ marginTop: 22 }}>
              <CalendarRange size={16} /> See the crew schedule board
            </Link>
          </div>
          <div className="ms-preview">
            <div className="ms-preview-head">
              <b>Kitchen sink and faucet replacement</b>
              <small>{formatUsd(870)} held once on PayPal</small>
            </div>
            {SAMPLE_MILESTONES.map((item, index) => (
              <div key={item.title} className={`ms-preview-row ms-${item.state}`}>
                <span className="ms-step">{item.state === "paid" ? <BadgeCheck size={16} /> : index + 1}</span>
                <span>
                  <b>{item.title}</b>
                  <small>{item.crew}</small>
                </span>
                <span className="ms-preview-amount">
                  <b>{formatUsd(item.amount)}</b>
                  <small>{item.label}</small>
                </span>
              </div>
            ))}
            <div className="progress" style={{ marginTop: 6 }}>
              <div className="progress-paid" style={{ width: "16%" }} />
            </div>
            <small className="faint">$140 of $870 released · $730 still held</small>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }} id="tools">
        <div className="wrap">
          <div className="section-head">
            <span className="kicker">Under the hood</span>
            <h2>Every hackathon tool has a job to do</h2>
            <p>Each tool owns one part of the flow, and every one is optional: without its key, that part runs in demo mode.</p>
          </div>
          <div className="tools">
            {TOOLS.map((tool) => (
              <article key={tool.name} className="tool">
                <div className="tool-head">
                  <h3 className="row" style={{ gap: 8 }}>
                    {tool.icon} {tool.name}
                  </h3>
                  <span className="pill plain pill-scoped">{tool.role}</span>
                </div>
                <p>{tool.body}</p>
                <span className="where mono">{tool.where}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="band">
            <div>
              <h2>Build on the same API</h2>
              <p>Every screen here runs on the public REST API. Read the reference, import the Postman collection, or see how it all fits together in the design docs.</p>
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <Link href="/docs" className="btn btn-paypal btn-lg">
                <Code2 size={18} /> Read the API
              </Link>
              <Link href="/docs/design/hld" className="btn btn-glass btn-lg">
                <FileText size={18} /> Design docs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
