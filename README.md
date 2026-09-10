# QA Review Tool

Weekly quality review of L1 support tickets. Samples solved Zendesk tickets per
agent, shows the conversation alongside a scorecard, and appends each review to
a Google Sheet.

## How it works

**Sampling** (`src/services/sampling.js`) — for each agent, within the selected
date range:

- every **Low CSAT** ticket (never filtered by tag)
- one **High CSAT** ticket per week
- one **Random** ticket per week
- one **High Replies** ticket per week

Random and High Replies draw from a "clean pool" that excludes noise tags:
activations/deactivations, OTA activations, billing questions, feature requests,
generic feedback, merge-closed tickets, and Aircall.

Only the `smartpms l1` and `smartpricing l1` groups are considered, and only
tickets assigned to a member of those groups.

**Scoring** (`src/components/ReviewPanel.jsx`) — five criteria, 1–3 each, out of
15: correct resolution, tone & professionalism, followed process, response time,
clarity & grammar. All five must be scored before saving.

**Persistence** — the sampled queue and the set of reviewed ticket IDs live in
`localStorage`. Reviews go to Google Sheets (see `SHEETS_SETUP.md`).

## Architecture

The browser never holds Zendesk credentials. All Zendesk calls go to
`/api/zendesk/*`, which is handled by:

- **production** — `worker.js`, a Cloudflare Worker that also serves the built
  SPA from `dist/`
- **development** — the Vite dev proxy in `vite.config.js`

The Worker allowlists a fixed set of read-only Zendesk endpoints and rejects
anything else. Sheets writes go through `/api/sheets` for the same reason, and
so that a failed write surfaces as an actual error.

```
src/
  App.jsx                  state, data loading, queue orchestration
  components/
    TicketQueue.jsx        sidebar: filters, per-agent groups, ticket cards
    ReviewPanel.jsx        conversation thread + scorecard
  services/
    zendesk.js             API calls through the proxy
    sampling.js            queue construction + localStorage
    sheets.js              review submission
worker.js                  Cloudflare Worker: proxy + static assets
```

## Setup

```bash
npm install
cp .env.example .env    # then fill it in
npm run dev
```

## Deploy

```bash
npm run build
npx wrangler deploy
```

Worker secrets, set once:

```bash
npx wrangler secret put ZENDESK_SUBDOMAIN
npx wrangler secret put ZENDESK_EMAIL
npx wrangler secret put ZENDESK_API_TOKEN
npx wrangler secret put GOOGLE_SHEETS_WEBHOOK_URL
```

## Known gaps

- **The deployment has no authentication.** Put Cloudflare Access in front of it
  before sharing the URL — see below.
- Zendesk's search API caps at 1000 results, so very wide date ranges will
  silently truncate.
- Reviewed-ticket tracking is keyed to the *current* ISO week, so reviewing
  older date ranges tracks under today's week.
- `isoWeekKey()` is an approximation and can misgroup tickets near year
  boundaries.
