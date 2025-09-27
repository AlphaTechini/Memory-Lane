<div align="center">
	<h1>Sensay Memory Care Platform</h1>
	<p><strong>AI-assisted memory support</strong> combining caregiver-managed replicas, simplified patient access, conversational history, and secure gallery sharing.</p>
	<p>
		Backend: Fastify + MongoDB (Mongoose) · Frontend: SvelteKit · Auth: JWT (Caretaker & Patient) · External: Sensay API, Cloudinary, Nodemailer
	</p>
	<hr/>
</div>

## 1. Core Concept
Caretakers create and train AI "replicas" (persona-based conversational agents) that patients (often memory-impaired) can interact with using a frictionless, email-only login. Caretakers also manage a memory gallery (albums + photos) and whitelist patient emails for secure, read-focused access. The platform integrates with Sensay's API to provision replicas and optionally train them (multi-endpoint fallback). Cloudinary can store images; email is used for caretaker verification and passwordless support flows.

## 2. High-Level Architecture
```
┌───────────────────────────────┐
│           Frontend            │  SvelteKit (patient & caretaker flows)
│  - Login / Signup             │
│  - Patient email-only access  │
│  - Replica & chat UI          │
│  - Gallery & albums           │
└───────▲───────────────────┬───┘
				│                   │
				│ HTTP (JSON, JWT)  │
				│                   │
┌───────┴───────────────────▼────┐
│            Fastify API          │
│  Auth Routes (caretaker/patient)│
│  Replica Routes (Sensay proxy)  │
│  Gallery Routes (albums/photos) │
│  Chat + Conversation storage    │
│  Middleware (auth, gallery ACL) │
└───────▲──────────────┬─────────┘
				│              │
				│ Mongoose     │
				│              │
┌───────┴──────────────▼─────────┐
│            MongoDB              │
│  Users (caretakers)             │
│  Patients (email + caretaker)   │
│  Conversations (message logs)   │
│  (Photos/Albums embedded in User)│
└─────────────────────────────────┘

External Services:
	• Sensay API (replica lifecycle)
	• Cloudinary (image hosting, optional)
	• Nodemailer / SMTP (OTP + notifications)
```

## 3. Key Features
- Caretaker signup (email + password + verification via OTP)
- Patient email-only access (no OTP, token issuance if pre-whitelisted)
- Dual JWT strategy (payload includes role `caretaker` or `patient`)
- Replica creation & synchronization with Sensay (fallback parsing)
- Training attempts with multiple endpoint patterns (resilient to API changes)
- Per-replica whitelisting of patient emails
- Gallery: albums + photos, patient read-only logic (via `galleryAuth` middleware)
- Conversation logging (message arrays per conversation)
- Cloudinary integration (if configured) for image storage
- Structured logging with graceful degradation when external APIs misbehave

## 4. Technology Stack
| Layer        | Tech |
|--------------|------|
| Runtime      | Node.js (ES Modules) |
| Framework    | Fastify v5 |
| DB           | MongoDB Atlas / Local (Mongoose 8) |
| Frontend     | SvelteKit + Tailwind CSS |
| Auth         | JWT + Email OTP (caretakers) + Simple email (patients) |
| External     | Sensay API, Cloudinary, Nodemailer |
| Deployment   | (User-defined) |

## 5. Environment Variables
Create a `.env` file at project root. Only include what you need; missing optional values gracefully degrade.

```
# Server
PORT=4000
NODE_ENV=development
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d

# Sensay API (external service)
# Keep these secrets out of source control and store them in your host's secret manager
SENSAY_API_KEY=
SENSAY_BASE_URL=https://api.sensay.ai/v1
SENSAY_ORGANIZATION_SECRET=
SENSAY_OWNER_ID=

# External / 3rd-party keys
LLAMA_API_KEY=

# MongoDB (Atlas recommended)
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/sensay-ai?retryWrites=true&w=majority

# Email (Nodemailer) – for caretaker OTP / notifications
EMAIL_FROM=noreply@example.com
EMAIL_SMTP_HOST=smtp.example.com
EMAIL_SMTP_PORT=465
EMAIL_SMTP_USER=your-smtp-user
EMAIL_SMTP_PASS=your-smtp-pass

# Cloudinary (optional)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Frontend (CORS / links)
FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=

# Admin (simple email list auth)
ADMIN_EMAILS=admin1@example.com,admin2@example.com

# Security / misc
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOGIN_WINDOW_MS=900000
ORIGIN_REGISTRATION_SECRET=

# Logging
LOG_LEVEL=info
```

Notes:
- Collections create automatically on first write (Mongoose) — no manual provisioning needed.
- Unique indexes (e.g., `User.email`) enforced at insert time.
- If running in production, consider disabling `autoIndex` (add `{ autoIndex: false }`) and running a migration script for predictable startup.

## 6. Data Models (Schemas)
### User (Caretaker)
Key fields:
```
email (unique, required)
password (hashed via bcrypt pre-save)
role: 'caretaker' | 'patient' (defaults caretaker for legacy users)
isVerified (email verification state)
sensayUserId (linked external Sensay user id)
replicas[] (embedded: id, name, description, whitelistEmails[], status, etc.)
albums[] (memory albums with photos refs)
photos[] (standalone photos)
whitelistedPatients[] (raw email list for gallery access)
OTP + password reset fields
timestamps
```

### Patient
Simplified access identity tied to a caretaker (email-only login path):
```
email (required, lowercase)
caretaker (ObjectId -> User)
userId (optional link if patient eventually upgrades to full user)
allowedReplicas[] (list of replica ids they can chat with)
timestamps
unique compound index: { email, caretaker }
```

Currently the service layer references additional patient convenience fields (`firstName`, `lastName`, `caretakerEmail`, `isActive`, `updateLastLogin()`) — add them if you choose to extend patient experience. (See “Future Enhancements” section.)

### Conversation
```
userId (ObjectId -> User)
replicaId (string)
title (auto-derived from first user message)
messages[]: { id, text, sender: 'user'|'bot', timestamp }
lastMessageAt (updated pre-save)
timestamps
Index: { userId, replicaId, lastMessageAt: -1 }
```

## 7. Authentication Flows
### Caretaker
1. POST /auth/signup → creates user, sends OTP
2. User verifies email (OTP) → `isVerified = true`
3. POST /auth/login with email/password → JWT issued

### Patient (Memory-Friendly)
1. Caretaker adds patient email to a replica (whitelisting) → Patient document upserted
2. Patient visits login, selects “Patient” and enters email only
3. System verifies patient exists & caretaker association → issues patient JWT (no OTP, no password)
4. Token includes `type: 'patient'` and `allowedReplicas`

Middleware checks token payload; patient role paths restrict write/delete capabilities. Gallery middleware enforces read-mostly semantics.

## 8. API Route Overview (Representative)
Auth:
```
POST /auth/signup
POST /auth/login
POST /auth/patient-signup (alias: email-only)  
POST /auth/patient-login (same logic)
```

Replicas / Sensay Integration (examples – actual file: `routes/replicaApi.js` & `services/sensayService.js`):
```
POST /replicas            (create + Sensay API)
GET  /replicas            (list from Sensay)
GET  /replicas/:id        (fetch one)
POST /replicas/:id/train  (attempt training – multi-endpoint fallback)
```

Gallery (see `routes/galleryRoutes.js` plus sub-routes):
```
GET/POST /gallery/albums
GET/POST /gallery/photos
ACL enforced via caretaker ownership or patient whitelist
```

Conversations (representative – actual code may evolve):
```
POST /chat/:replicaId/messages
GET  /chat/:replicaId/history
```

## 9. Development Setup
```
git clone <repo>
cd Built-with-Sensay-API
cp .env.example .env   # or create .env from section above
pnpm|npm|yarn install  # (package.json currently minimal; choose a manager)
npm run start          # fastify server with nodemon
```

Frontend (Svelte) path: `Frontend/Frontend/` — start separately (adjust if you simplify directory nesting):
```
cd Frontend/Frontend
npm install
npm run dev
```

Access API: http://localhost:4000
Access App: http://localhost:5173 (default Vite dev port)

## 10. Replica Lifecycle Summary
1. Caretaker signup → auto-create Sensay user (best-effort; non-blocking)
2. Create replica locally + via Sensay API
3. Store replica metadata under `user.replicas[]`
4. Whitelist patient emails at replica-level; update Sensay whitelist (if supported) + local Patient doc
5. Training attempts (multiple endpoints) – logs outcome, non-fatal if unsupported

## 11. Error Handling & Resilience
- Sensay failures are logged and wrapped; user operations degrade gracefully
- Email sending wrapped in try/catch (OTP flow continues even if email fails, with flags)
- Database connection errors logged; app can start with limited functionality (though most routes need DB)
- Fallback parsing for unpredictable Sensay response shapes

## 12. Security Considerations
- JWT secret must be strong in production (`JWT_SECRET`)
- Patient tokens intentionally simpler; restrict their routes to read-only or limited write according to spec
- Avoid logging full JWT or secrets; current logger usage is high-level
- Add rate limiting to auth endpoints (basic map included; consider @fastify/rate-limit in prod)
- Sanitize replica input (basic sanitization in `sensayService` for names)

## 13. Testing (Current State)
Basic test files exist in `tests/` (e.g., caretaking, chatbot). Expand with:
- Patient flow tests (whitelist → patient login → access restrictions)
- Gallery read vs write permission matrix
- Sensay API mock tests (simulate failure and fallback)

## 14. Future Enhancements
- Extend `Patient` schema with: `firstName`, `lastName`, `caretakerEmail`, `isActive`, `lastLogin`, static `findByEmail`, instance `updateLastLogin()`
- Centralize role-based authorization guard
- Add pagination to conversations & gallery
- Introduce soft-delete for replicas and photos
- Add WebSocket/SSE streaming for live chat
- Formalize training pipeline once correct endpoint stabilized
- Improve frontend directory flattening (remove duplicate Frontend/ nesting)

## 14.1 Frontend Directory Cleanup (Planned)
Current nesting: `Frontend/Frontend/`.
Suggested refactor:
```
root/
	backend/ (current src/)
	frontend/ (move inner Frontend contents here)
```
Update README + deployment scripts after move. Adjust import paths if any backend serves static assets (currently none tightly coupled).

## 15. Docker (Backend Only)
Containerizes only the API (excludes Svelte frontend). Frontend can be deployed separately (Netlify/Vercel/static host) or added later via multi-stage build.

### 15.1 Build Image
```
docker build -t sensay-backend .
```

### 15.2 Run Container
```
docker run -d \
	--name sensay-api \
	-p 4000:4000 \
	--env-file .env \
	sensay-backend
```

Ensure your `.env` does NOT contain placeholder values. For production mount secrets via orchestrator (Kubernetes secrets, ECS secrets, etc.) rather than baking into image.

### 15.3 Minimal Health Check
Once running:
```
curl http://localhost:4000/health
```

### 15.4 Development vs Production Notes
- Nodemon not included in container (production focus). For live-reload bind-mount and install dev deps or create a `Dockerfile.dev`.
- If you later add TypeScript/build steps: introduce a build stage compiling to `dist/` then copy only runtime artifacts.

### 15.5 Common Pitfalls
| Issue | Cause | Fix |
|-------|-------|-----|
| App exits immediately | DB connection failure (and unhandled flows) | Check logs: `docker logs sensay-api` |
| ECONNREFUSED Mongo | Local Mongo not reachable from container | Use Atlas or host.docker.internal (on Mac/Win) |
| 401 on all routes | Missing `JWT_SECRET` in container | Add to `.env` or pass `-e JWT_SECRET=...` |
| Sensay failures | Missing secret or network egress blocked | Verify `SENSAY_ORGANIZATION_SECRET` and outbound firewall |

- Implement structured metrics (Prometheus / OpenTelemetry)

## 15.6 Internal URL Strategy (No Changes Needed)
The backend listens on `0.0.0.0:4000` internally and logs `http://localhost:4000` for developer clarity. You do NOT need to modify these internal URLs when deploying behind a reverse proxy, load balancer, or ingress. External routing maps public traffic to the container; internal binding remains stable.

Deployment patterns:
- Container + Load Balancer: Public `https://api.example.com` → target group → container :4000
- NGINX / Caddy / Traefik: `location / { proxy_pass http://backend:4000; }`
- Path prefix `/api`: Proxy only `/api` routes to backend; keep frontend static hosting separate

Why keeping hardcoded localhost references in dev code is acceptable:
1. Transparent local DX (no need for env juggling).
2. Infrastructure handles translation of public hostnames → internal service.
3. Avoids premature abstraction and scattered environment lookups in UI components.

Optional (future) abstraction: Introduce a single frontend constant (e.g. `API_BASE = import.meta.env.VITE_API_BASE || '/api';`) if you later consolidate frontend + backend under one domain with a path proxy.

## 15.7 CORS & Origin Registration
Current behavior (see `src/index.js`):
- Allowed origins seeded from `FRONTEND_URLS` (comma-separated) or `FRONTEND_URL`.
- Always whitelists common localhost dev ports (3000, 5173, 5174) and dynamically trusts other loopback origins.
- Supports runtime addition via `POST /internal/register-origin` guarded by `ORIGIN_REGISTRATION_SECRET`.

Example environment:
```
FRONTEND_URLS=https://app.example.com,https://admin.example.com
ORIGIN_REGISTRATION_SECRET=super-secret-token
```

Register a temporary preview origin:
```
curl -X POST https://api.example.com/internal/register-origin \
	-H "x-origin-secret: super-secret-token" \
	-H "Content-Type: application/json" \
	-d '{"origin":"https://pr-482.preview.example.dev"}'
```

List allowed origins:
```
curl -H "x-origin-secret: super-secret-token" https://api.example.com/internal/allowed-origins
```

Recommendations:
- Set `FRONTEND_URLS` for production; use dynamic registration only for ephemeral builds.
- Keep the secret server-side; never expose in public client bundles.
- If `ORIGIN_REGISTRATION_SECRET` is unset, registration endpoints remain effectively disabled (401).

## 15. Troubleshooting
| Symptom | Likely Cause | Action |
|---------|--------------|-------|
`MongoDB connection error` | Bad URI / network / IP not whitelisted | Verify `MONGODB_URI`, Atlas IP access list |
`OTP not received` | SMTP misconfig | Check SMTP creds; test with a simple nodemailer script |
`Replica creation failed` | Missing Sensay secret or invalid model payload | Confirm `SENSAY_ORGANIZATION_SECRET`; inspect logs |
`Patient login fails` | Email not whitelisted / Patient doc absent | Ensure caretaker added email to a replica |
`Training 404` | Endpoint mismatch (Sensay evolving) | Accept fallback; monitor docs; update service |

## 16. Contributing
1. Fork & branch: `feature/<name>`
2. Add/modify tests for new behavior
3. Run lint/tests locally
4. PR with concise summary + screenshots/log excerpts if API-related

## 17. License
Project currently unlicensed (private/hackathon context). Add a LICENSE file before public distribution.

## 18. Quick Reference Commands
```
npm run start          # Start API (nodemon)
node --check file.js   # Syntax check a file (fast sanity)
curl -X POST http://localhost:4000/auth/patient-login -d '{"email":"patient@example.com"}' -H "Content-Type: application/json"
```

## 19. Glossary
- Replica: AI persona instance managed via Sensay
- Whitelisting: Associating a patient email with caretaker resources for scoped access
- Patient: Lightweight identity (email only) mapped to caretaker & allowed replicas
- Caretaker: Full verified account managing replicas, gallery, and patients

## 20. Rate Limiting
Implemented with `@fastify/rate-limit` (global + per-route overrides):

Global defaults (in `src/index.js`):
```
RATE_LIMIT_MAX=120            # requests per window per IP (default if unset)
RATE_LIMIT_WINDOW=1 minute    # human-readable or ms (e.g. '60000')
RATE_LIMIT_SKIP_LIST=127.0.0.1,::1  # optional comma-separated IP allowlist
```
Route-level overrides on sensitive auth endpoints:
| Route | Limit | Window |
|-------|-------|--------|
| POST /auth/signup | 20 | 10 minutes |
| POST /auth/login | 40 | 5 minutes |
| POST /auth/patient-signup | 30 | 10 minutes |
| POST /auth/patient-login | 60 | 5 minutes |
| POST /auth/verify-otp | 25 | 10 minutes |
| POST /auth/resend-otp | 5 | 10 minutes |

Headers exposed on success:
```
X-RateLimit-Limit: <max>
X-RateLimit-Remaining: <remaining>

## Latest changes (2025-09-27)

This project was recently updated to improve deployment readiness and developer ergonomics. Highlights:

- Deployment & Fly.io
	- Added `fly.toml` and adjusted the Docker build context so the remote builder can successfully build the backend image.
	- Moved `Dockerfile` and `.dockerignore` into the repository root to match Fly's build expectations.
	- Machines are configured to avoid automatic scale-to-zero during development (`auto_stop_machines=false` in `fly.toml`).
	- Backend now binds to `0.0.0.0:4000` (satisfies platform proxies).

- Secrets & configuration
	- All runtime secrets should be stored in your platform's secret manager (e.g. Fly secrets). Use `flyctl secrets set KEY="value" -a <app>` or `flyctl secrets import` from a sanitized `.env` to avoid committing secrets.
	- `.env.example` updated to include all known environment keys (placeholders only).

- Server & code changes
	- Removed deprecated Mongo driver options and tightened database connection configuration.
	- Added per-route rate limits on sensitive auth endpoints; global defaults remain configurable via environment variables.
	- Added a root landing route (`GET /`) and a health endpoint (`GET /health`).
	- CORS handling improved: allowed origins seeded from `FRONTEND_URL(S)` and dynamic runtime origin registration via `POST /internal/register-origin` (guarded by `ORIGIN_REGISTRATION_SECRET`).

- Frontend updates
	- Frontend switched to a configurable API base URL via `VITE_API_BASE_URL` and now uses a central `apiUrl()` helper in the Svelte app.
	- Integrated `@vercel/speed-insights` injection in layout for lightweight performance monitoring.

- Misc
	- Added README documentation for environment variables and deployment notes.
	- Rate limiting headers added so clients can observe remaining quota.

If you use a different host (e.g., Vercel, Netlify), keep secrets in their provided secret/storage mechanism and configure the frontend `VITE_API_BASE_URL` accordingly.
X-RateLimit-Reset: <unix_epoch_seconds>
```

429 Response body (example):
```
{
	"statusCode": 429,
	"error": "Too Many Requests",
	"message": "Rate limit exceeded, retry in 60 seconds"
}
```

Adjustment Strategy:
- Increase login limits for high-traffic, but keep signup & resend conservative.
- Add separate bucket (future) using `keyGenerator` if you want user-based vs IP.
- For clustered deployments behind a load balancer, adopt a shared store (e.g. Redis) — current config is in-memory (per-instance) and not synchronized.

Future Enhancement:
- Provide environment var to disable globally: `RATE_LIMIT_DISABLED=true` (not yet implemented; add conditional around plugin registration if needed).

---
If you’d like me to also patch the `Patient` schema to align with referenced fields or generate an OpenAPI spec, just ask.
