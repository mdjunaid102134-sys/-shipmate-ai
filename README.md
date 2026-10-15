# ShipMate AI Agent Workspace

Node.js/Express dashboard for Render + OpenRouter + PostgreSQL. Optional Brave Search provides live web results. Saved companies, saved clients, application drafts, explicit human approval, activity log, and optional SMTP email are included.

## Safety and limitations
- Every application starts `pending`.
- Approve only changes the status; it never sends anything.
- An approved email needs a separate Send action and explicit confirmation.
- A generic service cannot reliably submit arbitrary third-party web forms. Open the official form and submit manually where required; only then mark it submitted.
- Search results may be incomplete or stale. Verify agent terms, public contact information and the official company website.
- SMTP acceptance is not proof that the recipient received or read an email.
- Never give this app your Google password or one-time codes.

## Local setup
Requires Node.js 20+ and PostgreSQL.
1. `npm install`
2. Copy `.env.example` to `.env` and fill required variables.
3. `npm start`
4. Open `http://localhost:3000` and enter `APPROVAL_ADMIN_TOKEN` under Settings.

Required environment variables: `DATABASE_URL`, `APPROVAL_ADMIN_TOKEN` (random secret, 24+ chars), `OPENROUTER_API_KEY`.
Optional: `OPENROUTER_MODEL`, `BRAVE_SEARCH_API_KEY`, and SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).

## Render deployment
1. Push this project to GitHub and create a Render Web Service from that repository.
2. Create/use a Render PostgreSQL database. Prefer its internal connection string when same-region.
3. Build command: `npm install`; Start command: `npm start`.
4. Set required environment variables in Render. Optional keys enable search and SMTP email.
5. Deploy, then check `/api/status`.

## Brave Search
Set `BRAVE_SEARCH_API_KEY` from the Brave Search API account. Search quotas and billing depend on the current provider plan.

## Endpoints
`GET /api/status`; `POST /api/chat`; `POST /api/alternative-chat`; `GET /api/research/search?q=...`; `GET|POST|DELETE /api/companies`; `GET|POST|DELETE /api/clients`; `GET|POST /api/applications`; `PATCH /api/applications/:id/decision`; `POST /api/applications/:id/send`; `POST /api/applications/:id/mark-submitted`; `GET /api/activity`.

All endpoints except `/api/status` and static assets require `x-approval-token`. The dashboard stores the token in browser sessionStorage only. For public production use, add real login/session management, backups, stronger authorization and audit/retention policies. Never commit `.env` or expose the admin token.
