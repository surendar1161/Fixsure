# Fixsure

**Pay for the fix, not the promise.** Home-repair escrow on PayPal, where an AI vision model decides when the money moves.

1. The customer uploads a photo of the problem. A vision model writes the scope and a price.
2. The customer approves a **PayPal hold**: an Orders v2 order with `intent: AUTHORIZE`. Nothing is charged yet.
3. The technician uploads an after photo. The model checks three things: it is the same job, the issue is fixed, and confidence is at least 82%.
4. If all three pass, the hold is **captured** and the technician is paid with **PayPal Payouts**, minus the platform fee. Anything else goes to a human reviewer, who can release the money, ask for a new photo, or void the hold.

**Projects** extend the same idea to bigger jobs. A planning agent splits a renovation into paid milestones and books crew for each one on a schedule board. The customer approves one PayPal hold for the total. Each milestone is released by a **partial capture** when its proof photo passes, and the crew member who did it gets a payout. How a milestone is checked depends on its size:

| Mode | When | What happens |
| --- | --- | --- |
| AI can release | Up to `MILESTONE_HUMAN_REVIEW_ABOVE_USD` (default $400) | A passing AI check captures and pays at once. |
| AI checks, person approves | Above that amount | The model checks the photo; a reviewer approves the payout. |
| Person only | Steps a photo cannot prove, like a leak test | A reviewer decides. |

Staff can change any milestone's mode on the schedule board.

Built for the PayPal AI Hackathon. MIT licensed.

## How each tool is used

| Tool | What it does here | Where |
| --- | --- | --- |
| PayPal REST | Orders v2 AUTHORIZE, authorization capture and void, Payouts. Projects use partial captures (`final_capture: false`, then `true` on the last milestone) and one payout per milestone. A fixed `PayPal-Request-Id` per operation makes retries safe. | `src/lib/paypal.ts`, `src/lib/projects.ts` |
| PayPal Agent Toolkit | The dispatch copilot (Vercel AI SDK `generateText`) gets the toolkit's `get_order`, `list_transactions`, and invoice tools for change orders, next to board tools that move, reassign, and re-verify milestones. | `src/lib/copilot.ts` |
| Vercel AI SDK | The planning agent uses `generateObject` with a zod schema and the site photo to write priced milestones. | `src/lib/planner.ts` |
| Bryntum Scheduler | The `/schedule` board: crew as rows, milestones as bars. Drag or stretch a bar and it saves through `PATCH /api/v1/jobs/{id}/milestones/{mid}`. Uses the public trial package, so it shows a trial watermark. | `src/components/schedule/` |
| OpenAI vision | Prices the before photo, compares before and after, and checks each milestone's proof photo. Text inside photos is treated as part of the scene, never as instructions. | `src/lib/vision.ts` |
| AG Grid | Review and dispatch desks: status tabs, quick search, sorting, custom cell renderers, pagination. | `src/components/JobsGrid.tsx` |
| Elastic | Each job is indexed on change. Reviewers see similar jobs from a `more_like_this` query and the median paid price. | `src/lib/elastic.ts` |
| Zapier | Each state change posts a flat JSON event to a catch hook. `job.funded` carries the technician link for dispatch by SMS or email. | `src/lib/zapier.ts` |
| Postman | A collection that runs the whole loop and asserts status codes, roles, and problem bodies. | `public/postman/` |
| APIMatic | A ready build directory: API reference, playground, TypeScript and Python SDKs, and the HLD and LLD as portal guides. | `apimatic/` |
| Render | One-click Blueprint deploy on the free plan, with a health check. | `render.yaml` |

Every integration is optional. Without a key, that part runs in demo or fallback mode, and `GET /api/v1/health` reports which mode is live.

## Design

- [High-level design](docs/HLD.md): actors, system context, both flows, state machines, verification policy, money model, tools, decisions, and risks.
- [Low-level design](docs/LLD.md): modules, data model, storage, auth, every endpoint, transition rules, PayPal calls with idempotency keys, AI prompts and guardrails, the schedule board contract, and events.

The diagrams are Mermaid, so they render on GitHub. The same files are rendered by the app at `/docs/design/hld` and `/docs/design/lld`, and published as guides in the APIMatic portal (see below).

## Run it locally

Requires Node 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # fill in only the keys you have
npm run dev
```

Open http://localhost:3000 and click **Try the sample job**. The staff desks (`/review`, `/dispatch`) ask for `FIXSURE_STAFF_KEY`, which is `local-staff-key` in the example file.

The demo loop takes about a minute:

1. Click **Try the sample job**, then **Place a demo hold** (or **Authorize with PayPal** when sandbox keys are set).
2. Click **Demo: open the technician view**, then **Use the sample after photo**.
3. Without an OpenAI key, the job goes to review. Open the **Review desk**, click the row, and click **Release**.

The project loop:

1. Click **Try the sample project** on the home page or at `/projects/new`, then **Place a demo hold**.
2. Open a crew member's portal and click **Use a sample photo** on a milestone. On sample projects use **Demo: play the crew**; for any project, staff copy the link from **Crew** (`/crew`) or from the project's **Links** card on the review desk.
3. Open the project in the **Review desk** and approve or send back each milestone. Watch the bars change on `/schedule`, and drag a scheduled one to another day or crew member.

Without an OpenAI key, the plan comes from a template, every milestone goes to a person, and the copilot is off.

### PayPal sandbox

1. At [developer.paypal.com](https://developer.paypal.com), open Apps & Credentials, switch to Sandbox, and create an app. Enable **Payouts** on it.
2. Put the client ID and secret into `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
3. Approve holds with a sandbox **personal** account. Enter a sandbox account email as the technician's payout email.
4. For projects, set each crew member's email to a sandbox account on the **Crew** page (or with `PATCH /api/v1/crew/{id}`). The demo roster uses `example.com` addresses. PayPal honors an authorization for 3 days and keeps it valid for 29, so long projects may need a reauthorization.

## API

REST over JSON at `/api/v1`, described by OpenAPI 3.1 at `/api/v1/openapi.json`, with a human-readable summary at `/docs`.

- **Auth**: `Authorization: Bearer <key>`. Each job has a customer key and a technician key, and staff use `FIXSURE_STAFF_KEY`. A key that belongs to a different job gets a 404, so job ids cannot be probed. The browser desks use an httpOnly cookie, and writes with it must come from the same origin.
- **Crew keys**: each crew member has a portal key. It can post proof and read photos only on milestones booked to that crew member; any other milestone is a 404. Staff hand out the portal link (`/crew/{id}?k=...`) from the **Crew** page.
- **Errors**: RFC 9457 `application/problem+json`, with `errors[]` for field validation. The status codes are 400, 401, 403, 404, 409 (wrong job state), 413, 415, 422, 502 (PayPal failed), and 503 (the copilot without an OpenAI key).
- **Creates**: return `201 Created` with a `Location` header. `POST /jobs/{id}/hold` returns `202 Accepted` while PayPal approval is pending.

```bash
BASE=http://localhost:3000
curl -X POST $BASE/api/v1/jobs/sample                      # 201, the response carries the customer link
curl -X POST $BASE/api/v1/jobs/$JOB/hold -H "Authorization: Bearer $CUSTOMER_KEY"
curl "$BASE/api/v1/jobs?status=review" -H "Authorization: Bearer $STAFF_KEY"

curl -X POST $BASE/api/v1/projects/sample                  # 201, a project with milestones
curl -X POST $BASE/api/v1/jobs/$JOB/milestones/$MID/proof -H "Authorization: Bearer $CREW_KEY" -F photo=@done.jpg
curl -X POST $BASE/api/v1/jobs/$JOB/milestones/$MID/approve -H "Authorization: Bearer $STAFF_KEY"
curl -X PATCH $BASE/api/v1/jobs/$JOB/milestones/$MID -H "Authorization: Bearer $STAFF_KEY" \
  -H "Content-Type: application/json" -d '{"startsAt":"2026-11-02T09:00:00Z","endsAt":"2026-11-02T17:00:00Z"}'
curl $BASE/api/v1/schedule -H "Authorization: Bearer $STAFF_KEY"   # Bryntum resources and events
```

**Postman**: import `public/postman/fixsure.postman_collection.json`, set `baseUrl` and `staffKey`, and run the collection. Each step saves the ids and keys that the next step needs.

**APIMatic**: `apimatic/` is a build directory with the spec and the design guides. With the APIMatic CLI signed in, run `cd apimatic && apimatic portal serve --open`. After editing `docs/` or the spec, run `npm run docs:apimatic` to refresh it. See [apimatic/README.md](apimatic/README.md). You can also import `openapi/openapi.json`, or the live `/api/v1/openapi.json`, in the APIMatic web app.

## Deploy to Render (free)

1. Push this repo to GitHub.
2. In Render, choose New, then Blueprint, and pick the repo. Render reads `render.yaml`, creates a free Node web service, and generates `FIXSURE_STAFF_KEY`.
3. Fill in the secret env vars you have: the PayPal, OpenAI, Elastic, and Zapier keys.
4. After the first deploy, read `FIXSURE_STAFF_KEY` in the service's Environment tab and use it to sign in at `/review`.

`APP_URL` falls back to Render's `RENDER_EXTERNAL_URL`, so PayPal return links work without extra setup.

**Free plan limits**: the service sleeps after about 15 idle minutes, so the first request takes around a minute. There is also no persistent disk, so jobs and photos reset on every restart or deploy. That is fine for a demo. To keep data, add a disk on a paid plan and set `DATA_DIR` to its mount path.

## Zapier

1. Create a Zap with **Webhooks by Zapier → Catch Hook** and copy the URL into `ZAPIER_HOOK_URL`.
2. Filter on `event`. Useful Zaps: on `job.funded`, send `technician_url` to the technician by SMS or email; on `job.review`, post `review_url` to Slack; on `payout.failed`, alert ops.

Events: `job.scoped`, `job.funded`, `job.review`, `job.released`, `job.voided`, `job.reopened`, `payout.sent`, `payout.failed`, `project.planned`, `milestone.review`, `milestone.paid`, `milestone.rejected`. Milestone events add `milestone_id`, `milestone_title`, `milestone_amount_usd`, `milestone_status`, and `milestone_verification`.

## Elastic

Create an Elastic Cloud or Serverless project and an API key with write access. Then set `ELASTIC_URL`, `ELASTIC_API_KEY`, and optionally `ELASTIC_INDEX`. The index uses dynamic mapping. Without Elastic, similar jobs are ranked from the local ledger.

## Project layout

```
src/app/api/v1/      REST route handlers
src/app/             pages: /, /jobs/new, /jobs/[id], /jobs/[id]/repair, /review, /dispatch, /docs,
                     /projects/new, /crew, /crew/[crewId], /schedule
src/lib/jobs.ts      domain: every repair state change happens here
src/lib/projects.ts  domain: milestones, partial captures, crew payouts
src/lib/planner.ts   planning agent and crew assignment
src/lib/copilot.ts   dispatch copilot with PayPal Agent Toolkit tools
src/lib/auth.ts      Bearer keys, staff cookie, and the Origin check
src/lib/views.ts     role-specific JSON views
openapi/openapi.json the API contract
docs/                HLD.md and LLD.md
apimatic/            APIMatic portal build (generated guides and spec)
render.yaml          Render Blueprint
```

The job store is a JSON file guarded by an in-process lock. It assumes a single instance, which matches the Render free plan.
