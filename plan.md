# AI-Powered Insurance Assistant — Build Plan

A pragmatic, end-to-end plan to ship an AI customer-assistance platform with multi-agent orchestration, secure APIs, RAG over Postgres/pgvector, and a minimal but useful frontend. It’s split cleanly into **Backend** (NestJS services + Python orchestration + Postgres) and **Frontend** (React stub). No fluff—just what you need to implement, in order.

---

## 0) Repo & Project Layout (Monorepo)

```
ai-insurance-assistant/
├─ apps/
│  ├─ api/                 # NestJS (Auth, Chat, Admin, Swagger)
│  ├─ orchestrator/        # Python (LangGraph/LangChain agents)
│  └─ web/                 # React/Next or Streamlit
├─ packages/
│  ├─ schemas/             # Shared OpenAPI types / zod (optional)
│  └─ config/              # Config utils, .env loaders
├─ infra/
│  ├─ docker/              # Dockerfiles
│  ├─ migrations/          # SQL migrations (pg + pgvector)
│  └─ k8s/                 # (optional) Helm manifests
├─ tests/
│  ├─ integration/         # cross-service tests (Playwright/Supertest+PyTest)
│  └─ data/                # seed docs, policies, FAQs
├─ .env.example
├─ docker-compose.yml
├─ Makefile
└─ README.md
```

**Cursor setup tips**

* Add a `.cursorrules` guiding the AI agent on code style, stack choices, and file ownership (e.g., Python lives under `apps/orchestrator`, don’t rewrite generated migrations).
* Use Cursor “Edit” to generate DTOs, validators, and tests from the OpenAPI spec; use “Chat” to refactor repetitive guards or logging middleware.

---

# BACKEND

## 1) Postgres + pgvector

**1.1 Enable pgvector & base schema**

* Migration SQL (`infra/migrations/001_init.sql`):

  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE TABLE documents(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    embedding vector(1536),   -- match your embedding dim
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Optional: policies, claims as mock/reference tables for demos
  CREATE TABLE policies(
    policy_id TEXT PRIMARY KEY,
    plan TEXT,
    collision_coverage INT,
    roadside_assistance BOOLEAN,
    deductible INT
  );
  ```

**1.2 Seeders**

* `tests/data/` holds: FAQs, policy tiers, claim steps.
* `apps/orchestrator/scripts/ingest.py` creates embeddings & upserts.

**1.3 docker-compose**

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: insurance
    ports: [ "5432:5432" ]
    volumes:
      - ./infra/migrations:/docker-entrypoint-initdb.d
```

---

## 2) NestJS API (apps/api)

**Stack:** NestJS, TypeScript, TypeORM (or Prisma), `class-validator`, `@nestjs/swagger`, `pino` logger, `@nestjs/terminus` (optional), Prometheus middleware (optional).

**2.1 Modules**

* `AuthModule` — `/auth/login` (email/password → JWT). Roles: `user`, `admin`.
* `ChatModule` — `/chat` (POST message → orchestrator call, stream optional with SSE).
* `AdminModule` — `/admin/docs` (upload/delete documents; admin-only guard).
* `ClaimsModule` — `/claims` (GET status, POST submit) **(can proxy to mock service or implement in API)**.
* `PremiumModule` — `/premium` (POST calculate).

**2.2 DTOs & Validation**

* Claim status query: `claim_id` **required**, regex `^[A-Za-z0-9]{1,10}$`.
* Claim submit: `policy_id` (string), `damage_description` (min len 10), `vehicle` (string), `photos?: string[]`.
* Premium calc: `policy_id`, `current_coverage` (number), `new_coverage` (number, must be > current\_coverage).

**2.3 Auth**

* JWT issuance on `/auth/login` with role in payload.
* Guards: `JwtAuthGuard`, `RolesGuard` (`@Roles('admin')` for knowledge ops).
* Token refresh: optional `/auth/refresh`.

**2.4 Chat Route**

* `POST /chat`: `{ message: string, session_id?: string }`.
* API relays to Python Orchestrator (`/route`), returns structured response:

  ```json
  {
    "messages": [{ "from": "assistant", "text": "..." }],
    "actions": [{ "type": "confirm", "payload": {...} }],  // when confirmation needed
    "cards": { "policy": {...}, "claim_status": {...} },    // optional UI hints
    "state": { "pending_confirmation": true, "claim_id": "98765" }
  }
  ```

**2.5 Admin Docs**

* `POST /admin/docs` — multipart or JSON: `{title, content, source, metadata}`.
* `DELETE /admin/docs/:id`.
* Calls orchestrator ingestion or writes directly; keep **admin guard** enforced.

**2.6 Swagger & Config**

* Swagger at `/docs` with JWT auth.
* `.env` keys:

  ```
  NODE_ENV=dev
  PORT=3000
  JWT_SECRET=supersecret
  ORCHESTRATOR_URL=http://orchestrator:8000
  DB_URL=postgres://postgres:postgres@db:5432/insurance
  LOG_LEVEL=info
  ENABLE_PROMETHEUS=false
  ```
* Expose `/health`, `/metrics` (optional).

**2.7 Logging & Errors**

* Pino with request/response IDs. Consistent error payload:

  ```json
  { "code":"VALIDATION_ERROR", "message":"claim_id invalid", "details": {...} }
  ```
* Log routing decisions returned from orchestrator (intent, agent path, confirmation gates).

---

## 3) Python Orchestrator (apps/orchestrator)

**Stack:** Python 3.11, LangGraph (preferred) or LangChain, `psycopg`, `pgvector`, `pydantic`, `fastrapi` (FastAPI), `structlog`. Embeddings via OpenAI or local (HF).

**3.1 Service Endpoints**

* `POST /route` — main entry: `{ message, session_id, user_role, context? }`.
* `POST /ingest` — admin-only (shared secret or mTLS) for KB ingestion.
* Internal tools for **/claims**, **/premium** calls (hit Nest API or internal mocks).

**3.2 State Model**

```python
class SessionState(BaseModel):
    session_id: str
    last_intent: Literal["kb","api","both","fallback"] | None
    pending_confirmation: bool = False
    claim_id: str | None = None
    policy_id: str | None = None
    slots: dict[str, Any] = {}
```

**3.3 Agents (LangGraph nodes)**

* **Intent Router**: classify to `kb`, `api`, `both`, or `fallback`.
* **Validator**: enforce rules (e.g., claim\_id regex; premium new > current).
* **KB Agent (RAG)**:

  * Embed query → pgvector similarity search (`documents.embedding <-> query_vec`).
  * Synthesize policy/claim FAQs answer with citations (source, title).
* **API Agent**:

  * Before side effects: emit `confirm` action with compiled summary.
  * On confirmation, call NestJS endpoints:

    * `GET /claims?claim_id=...`
    * `POST /claims`
    * `POST /premium`
* **Fallback Agent**: general chat (gpt-style model).
* **Conversation Manager**: tracks state, merges outputs, emits UI hints.

**3.4 Confirmation Contract**

* When an action is about to hit `/claims` or `/premium`, respond:

  ```json
  {
    "actions":[
      {
        "type":"confirm",
        "id":"confirm-123",
        "summary":"Check status for claim ID 98765?",
        "payload": { "op":"GET_CLAIM", "claim_id":"98765" }
      }
    ],
    "state": { "pending_confirmation": true, "claim_id":"98765" }
  }
  ```
* Upon user “yes”, route resumes and executes API call; “no” cancels and resets flag.

**3.5 Ingestion Pipeline**

* `scripts/ingest.py`:

  * Load `tests/data/faqs/*.md`, `policy_tiers.json`, `claim_steps.md`.
  * Chunk (e.g., 500–800 tokens, overlap 100), embed, upsert into `documents`.
  * Store `metadata` (`{"section":"faq","tier":"gold"}`) for filtering.

**3.6 Env**

```
ORCH_PORT=8000
DB_URL=postgres://postgres:postgres@db:5432/insurance
EMBEDDING_MODEL=text-embedding-3-small
CHAT_MODEL=gpt-4o-mini
NEST_API_URL=http://api:3000
ADMIN_SHARED_SECRET=change-me
LOG_LEVEL=info
```

**3.7 Logging**

* `structlog` with `intent`, `agent_path`, `session_id`, `latency_ms`, `error`.

---

## 4) API Design (OpenAPI/Swagger)

**Auth**

* `POST /auth/login` → `{access_token, role, expires_in}`

**Chat**

* `POST /chat` → structured response (messages, actions, cards, state)
* `GET /chat/:sessionId/history` (optional, lazy-load)

**Admin**

* `POST /admin/docs` (admin)
* `DELETE /admin/docs/:id` (admin)

**Claims**

* `GET /claims?claim_id=...` → `{ claim_id, status, last_updated }`
* `POST /claims` → `{ claim_id, message }`

**Premium**

* `POST /premium` → `{ policy_id, current_premium, new_premium }`

All routes documented, with example payloads mirroring the assignment samples.

---

## 5) Observability & Middleware

* **Request IDs** (Nest interceptor + Python middleware).
* **Error normalization** across services.
* **Metrics** (optional): expose `/metrics` in Nest; instrument Python with Prometheus client.
* **Tracing** (optional): OpenTelemetry SDK in both services (trace orchestrator→API→DB).

---

## 6) Testing Strategy

**Unit (fast)**

* **Nest**: `Jest` for guards, DTO validation, controllers/services.
* **Python**: `PyTest` for validators, router classification, RAG ranker (mock DB).

**Integration (realistic)**

* Spin via `docker-compose`.
* **RAG flow**: ingest → query → expect grounded answer w/ citation.
* **Flow A** (Policy → Claim Status with confirmation).
* **Flow B** (Submit claim → Premium what-if) with validations.
* **Fallback**: out-of-scope small talk.

**E2E (optional)**

* Playwright for web stub (login, chat, confirmation banner).
* Supertest (Nest) + httpx (Python) for cross-service flows.

**Env switching**

* `.env` vs `.env.prod` with config modules in both services.

---

# FRONTEND

You can ship either **Next.js (recommended)** or **Streamlit**. Below assumes **Next.js** for JWT flow and components.

## 7) Frontend (apps/web)

**7.1 Pages**

* `/login` — email/password → calls `/auth/login`, stores JWT in `httpOnly` cookie (SSR friendly) or memory + silent refresh.
* `/chat` — chat thread, input box, lazy history load.

**7.2 Components**

* `PolicyCard` — display plan, coverage, deductible.
* `ClaimStatusTable` — claim\_id, status, last\_updated.
* `ConfirmAction` — banner with **Approve/Cancel**; on Approve, POST confirmation payload back to `/chat` (or a dedicated `/chat/confirm`).

**7.3 API Client**

* Axios with interceptor to attach JWT.
* `NEXT_PUBLIC_API_BASE_URL`, `FEATURE_FLAGS` via `.env.local`.

**7.4 Streaming (optional)**

* Server-Sent Events from `/chat/stream` for token streaming.

**7.5 Minimal UX Rules**

* Show **system messages** distinctly.
* When `actions.confirm` exists, **disable** new side-effecting inputs until user decides.
* Render `cards` if present (policy summary, claim status).

---

## 8) End-to-End Flows (Concrete)

**Flow A: Policy Info → Claim Status**

1. User: “Tell me about my car insurance policy.”
2. Orchestrator: `intent=kb` → RAG → policy summary (from KB/policies table).
3. Orchestrator: Asks: “Want me to check the status of your current claim?”
4. User: “Yes.” → Orchestrator requests `claim_id`.
5. User: “98765”.
6. **Validator** checks `claim_id` (`^[A-Za-z0-9]{1,10}$`).
7. Orchestrator emits `confirm` action summarizing the call.
8. Frontend shows `ConfirmAction`.
9. On Approve, orchestrator calls `GET /claims?claim_id=98765`.
10. Returns status; assistant posts final message + optional `ClaimStatusTable`.

**Flow B: New Claim → Premium What-If**

1. User: “I want to submit a new claim for vehicle damage.”
2. Orchestrator gathers slots: `policy_id`, `vehicle`, `damage_description`, `photos[]`.
3. Emits **summary + confirm**.
4. Approve → call `POST /claims` → `{ claim_id: "54321" }`.
5. User: “What if I increase collision coverage from 50k to 80k?”
6. **Validator**: `new_coverage > current_coverage`.
7. Approve → call `POST /premium` with body per spec.
8. Render delta: premium change \$500.00 → \$760.00.

---

## 9) Security & Hardening (no-nonsense)

* **JWT** with short TTL; optional refresh token.
* **Role guards** on admin routes. Don’t trust frontend flags.
* **CORS** locked to web origin; **Helmet** enabled.
* **Rate limiting** on `/chat`, `/claims`, `/premium`.
* Validate **every** external input in Nest **and** re-validate in Python before action.
* Keep model & API keys in `.env`; never log secrets. Redact PII in logs.
* Admin ingestion endpoint requires **shared secret** or mTLS.

---

## 10) CI/CD & Quality

* **CI** (GitHub Actions):

  * Lint & test for `apps/api` and `apps/orchestrator`.
  * Build images, run `docker compose up -d` + integration tests.
* **Artifacts**:

  * Publish OpenAPI JSON from Nest on each build.
  * Cache embeddings during CI (optional).
* **CD**:

  * Containerize all apps; version tags per commit.

---

## 11) Scripts & Make Targets

* `make up` — compose up all services.
* `make seed` — run `apps/orchestrator/scripts/ingest.py`.
* `make test` — run unit + integration.
* `make docs` — print Swagger URL and orchestrator routes.
* `make wipe` — drop & recreate DB (dev only).

---

## 12) Deliverables Checklist

* [ ] **GitHub repo** with clean structure, **README**, `.env.example`, scripts, seeders.
* [ ] **OpenAPI/Swagger** exposed in Nest.
* [ ] **Demo video (5–10 min)**: show both flows, confirmations, admin KB ops, code tour.
* [ ] **Slides**: problem → architecture → orchestration graph → logs → tests → roadmap.
* [ ] **Tests**: unit (guards/validators/routes) + integration (RAG, API flows, confirmations, fallback).
* [ ] **Logging** everywhere: request IDs, agent decisions, errors.

---

## 13) Thin but Realistic Implementations (starter specs)

**Claim ID Validation**

* Regex: `^[A-Za-z0-9]{1,10}$`.
* On fail: `400 { code:"VALIDATION_ERROR", field:"claim_id" }`.

**Premium Change Guard**

* `new_coverage > current_coverage` else `400 { code:"BUSINESS_RULE_VIOLATION" }`.

**RAG Retrieval**

* Cosine distance via pgvector:

  ```sql
  SELECT id, title, content, metadata
  FROM documents
  ORDER BY embedding <-> $1
  LIMIT 5;
  ```

**Logging Keys**

* `trace_id`, `session_id`, `intent`, `agent_path`, `latency_ms`, `error_code`.

---

## 14) Risks & How We Avoid Them

* **Hallucinations:** RAG answers must include top-k chunks + sources; set a high grounding threshold or fall back to “I don’t know”.
* **Silent side effects:** Block all external calls behind explicit `confirm` actions.
* **Schema drift:** Generate DTOs/types from OpenAPI; run contract tests in CI.
* **Embedding mismatch:** Keep embedding dimension consistent; assert at startup.
* **Token leakage:** Disable logging of headers/body on auth routes; scrub secrets.

---

## 15) Quickstart (dev)

1. `cp .env.example .env && cp .env.example apps/api/.env && cp .env.example apps/orchestrator/.env`
2. `docker compose up -d db`
3. `make up` (build api + orchestrator + web)
4. `make seed`
5. Open **Swagger** at `http://localhost:3000/docs` and **Web** at `http://localhost:3002` (if Next.js).
6. Run tests: `make test`.

---

### Final word

This plan prioritizes correctness, confirmations before side effects, and traceability. If you cut corners, start by shipping the **KB RAG + confirm gate** and one **/claims GET** path; then layer on submissions and premiums. Keep logs brutally detailed—reviewing agent paths is how you’ll debug 90% of issues.
