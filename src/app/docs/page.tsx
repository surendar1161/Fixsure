import { Download, FileJson, Network } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import spec from "../../../openapi/openapi.json";

export const metadata: Metadata = { title: "API reference" };

type Operation = { summary?: string; security?: unknown[] };

const ROLE: Record<string, string> = {
  createJob: "Public",
  createSampleJob: "Public",
  getHealth: "Public",
  getOpenApi: "Public",
  paypalReturn: "PayPal",
  createStaffSession: "Public",
  deleteStaffSession: "Public",
  getJob: "Any job key",
  getPhoto: "Any job key",
  placeHold: "Customer",
  cancelHold: "Customer",
  submitProof: "Technician",
  submitSampleProof: "Technician",
  createProject: "Public",
  createSampleProject: "Public",
  listMilestones: "Customer",
  getMilestone: "Customer or crew",
  getMilestonePhoto: "Customer or crew",
  submitMilestoneProof: "Crew",
  submitSampleMilestoneProof: "Crew",
  getMyAssignments: "Crew",
};

const PROBLEMS = [
  ["bad-request", 400, "Malformed body or query."],
  ["unauthorized", 401, "No credential was sent."],
  ["forbidden", 403, "The credential's role cannot do this."],
  ["not-found", 404, "No such job, or the key does not belong to it."],
  ["conflict", 409, "The job is in the wrong state for this action."],
  ["payload-too-large", 413, "Photo over 5 MB."],
  ["unsupported-media-type", 415, "Wrong content type or image format."],
  ["validation", 422, "Field errors, listed in errors[]."],
  ["upstream", 502, "PayPal or another provider failed."],
  ["unavailable", 503, "The feature needs a key this server does not have, like the copilot without OPENAI_API_KEY."],
] as const;

export default function DocsPage() {
  const rows = Object.entries(spec.paths).flatMap(([path, item]) =>
    Object.entries(item as Record<string, unknown>)
      .filter(([method]) => ["get", "post", "patch", "delete"].includes(method))
      .map(([method, op]) => {
        const operation = op as Operation & { operationId: string };
        return { path, method, summary: operation.summary ?? "", role: ROLE[operation.operationId] ?? "Staff" };
      }),
  );

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">Developers</div>
          <h1>Fixsure API v1</h1>
          <p>{spec.info.summary} REST over JSON, versioned under /api/v1, described by OpenAPI 3.1, with RFC 9457 problem responses.</p>
        </div>
        <div className="row">
          <a className="btn btn-dark" href="/api/v1/openapi.json">
            <FileJson size={16} /> OpenAPI 3.1
          </a>
          <a className="btn btn-ghost" href="/postman/fixsure.postman_collection.json" download>
            <Download size={16} /> Postman collection
          </a>
          <Link className="btn btn-ghost" href="/docs/design/hld">
            <Network size={16} /> Design docs
          </Link>
        </div>
      </div>

      <div className="layout">
        <section className="card flush">
          {rows.map((row) => (
            <div key={`${row.method}-${row.path}`} className="endpoint">
              <span className={`method ${row.method}`}>{row.method.toUpperCase()}</span>
              <code>{row.path}</code>
              <span className="muted">{row.summary}</span>
              <span className="pill plain pill-voided" style={{ justifySelf: "end" }}>
                {row.role}
              </span>
            </div>
          ))}
        </section>

        <aside className="stack">
          <section className="card">
            <div className="card-title">
              <h3>Authentication</h3>
            </div>
            <p className="muted small" style={{ marginBottom: 12 }}>
              Each job has a customer key and a technician key. Send one as a Bearer token. Staff endpoints take the server&apos;s staff key. A key for another job gets
              a 404.
            </p>
            <pre className="codeblock">{`curl -X POST $BASE/api/v1/jobs/sample

curl -X POST $BASE/api/v1/jobs/$JOB/hold \\
  -H "Authorization: Bearer $CUSTOMER_KEY"

curl $BASE/api/v1/jobs?status=review \\
  -H "Authorization: Bearer $STAFF_KEY"`}</pre>
          </section>
          <section className="card" id="problems">
            <div className="card-title">
              <h3>Errors</h3>
              <span className="sub">application/problem+json</span>
            </div>
            <pre className="codeblock" style={{ marginBottom: 14 }}>{`{
  "type": "/docs#problem-conflict",
  "title": "Job is in the wrong state",
  "status": 409,
  "detail": "This job is not waiting for a hold.",
  "instance": "/api/v1/jobs/…/hold"
}`}</pre>
            <ul className="similar">
              {PROBLEMS.map(([slug, status, text]) => (
                <li key={slug} id={`problem-${slug}`}>
                  <b className="mono">{slug}</b>
                  <span className="price-tag">{status}</span>
                  <span className="faint small" style={{ gridColumn: "1 / -1" }}>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <div className="card-title">
              <h3>SDKs and portal with APIMatic</h3>
            </div>
            <p className="muted small" style={{ marginBottom: 10 }}>
              The repo&apos;s <code>apimatic/</code> folder is a ready build: this spec plus the{" "}
              <Link href="/docs/design/hld">high-level</Link> and <Link href="/docs/design/lld">low-level</Link> design as portal guides. Run{" "}
              <code>apimatic portal serve</code> inside it.
            </p>
            <p className="muted small">The same spec imports into Postman as a collection.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
