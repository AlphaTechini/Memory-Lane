<div align="center">
	<h1>Supavec Memory Care Platform</h1>
	<p><strong>AI-assisted memory support</strong> combining caregiver-managed replicas, simplified patient access, conversational history, and secure gallery sharing.</p>
	<p>
		Backend: Fastify + Firestore · Frontend: SvelteKit · Auth: JWT (Caretaker & Patient) · External: Supavec API, Cloudinary, Nodemailer
	</p>
	<hr/>
</div>

## 1. Core Concept
Caretakers create and train AI "replicas" (persona-based conversational agents) that patients (often memory-impaired) can interact with using a frictionless, email-only login. Caretakers also manage a memory gallery (albums + photos) and whitelist patient emails for secure, read-focused access. The platform integrates with Supavec's API to manage the knowledge base for the replicas. Cloudinary can store images; email is used for caretaker verification and passwordless support flows.

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
│  Replica Routes (Supavec proxy) │
│  Gallery Routes (albums/photos) │
│  Chat + Conversation storage    │
│  Middleware (auth, gallery ACL) │
└───────▲──────────────┬─────────┘
				│              │
				│ Firestore    │
				│              │
┌───────┴──────────────▼─────────┐
│            Firestore            │
│  Users (caretakers)             │
│  Patients (email + caretaker)   │
│  Conversations (message logs)   │
│  (Photos/Albums embedded in User)│
└─────────────────────────────────┘

External Services:
	• Supavec API (replica lifecycle)
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
| DB           | Firestore (Google Cloud) |
| Frontend     | SvelteKit + Tailwind CSS |
| Auth         | JWT + Email OTP (caretakers) + Simple email (patients) |
| External     | Supavec API, Cloudinary, Nodemailer |
| Deployment   | (User-defined) |

## 5. Environment Variables
Create a `.env` file at project root. Only include what you need; missing optional values gracefully degrade.

```
# Server
PORT=4000
NODE_ENV=development
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d

# Supavec API (external service)
# Keep these secrets out of source control and store them in your host's secret manager
SUPAVEC_API_KEY=
SUPAVEC_BASE_URL=https://api.supavec.com
SUPAVEC_TIMEOUT=30000

# Firestore Configuration
# Service account key file path (for server-side Firebase Admin SDK)
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# Email (Nodemailer) – for caretaker OTP / notifications
EMAIL_FROM=noreply@memorylane.cyberpunk.work
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
- Set up Firebase/Firestore project and download service account key to `serviceAccountKey.json`
- Unique constraints (e.g., `User.email`) are enforced at the application level
- Firestore automatically scales and handles connection pooling

## 6. Enhanced Sensay User Management

The platform now includes comprehensive Sensay user management that follows the official Sensay API documentation exactly. This ensures proper user creation, linking, and synchronization between the local database and Sensay's service.

### Key Features
- **Automatic User Creation**: When users sign up, a corresponding Sensay user is automatically created
- **Proper Error Handling**: Handles all documented Sensay API response codes (400, 401, 404, 409, 415, 500)
- **User Linking**: Links local users with their Sensay counterparts using `sensayUserId`
- **Sync Functionality**: Keeps user data synchronized between local database and Sensay
- **Middleware Protection**: Routes requiring Sensay functionality are protected with middleware
- **Conflict Resolution**: Gracefully handles cases where users already exist in Sensay

### Sensay API Integration
The implementation includes functions for all documented Sensay user endpoints:

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `createSensayUser()` | `POST /v1/users` | Create new users in Sensay |
| `getCurrentSensayUser()` | `GET /v1/users/me` | Get current user info |
| `updateCurrentSensayUser()` | `PUT /v1/users/me` | Update user information |
| `deleteCurrentSensayUser()` | `DELETE /v1/users/me` | Delete user account |
| `getSensayUser()` | `GET /v1/users/{userID}` | Get user by ID |
| `ensureSensayUser()` | Helper function | Create user or handle conflicts |
| `syncUserWithSensay()` | Helper function | Sync local/remote user data |

### Authentication Middleware
Three new middleware functions protect Sensay-dependent routes:

- **`ensureSensayUser()`**: Ensures user has valid Sensay account (creates if needed)
- **`validateSensayLink()`**: Lightweight check that user is linked to Sensay
- **`addSensayUser()`**: Optionally adds Sensay user info to request

### API Endpoints
New authentication endpoints for Sensay management:

- `POST /auth/sync-sensay` - Sync user with Sensay service
- `POST /auth/ensure-sensay` - Ensure user exists in Sensay
- `GET /auth/sensay-status` - Get user's Sensay connection status

### Error Handling
The implementation properly handles all documented error scenarios:
- **409 Conflict**: User already exists (graceful conflict resolution)
- **400 Bad Request**: Invalid input data with specific error messages
- **401 Unauthorized**: API credential issues
- **404 Not Found**: User doesn't exist
- **500 Internal Server Error**: Sensay service issues

### Usage Example
```javascript
import { ensureSensayUser } from '../services/sensayService.js';

// Create or find existing Sensay user
const result = await ensureSensayUser({
  email: 'user@example.com',
  name: 'John Doe',
  id: 'preferred-user-id'
});

if (result.success) {
  console.log('User ready:', result.user.id);
} else if (result.conflict) {
  console.log('User exists but cannot be auto-linked');
}
```

### Testing
Run the test suite to verify Sensay integration:
```bash
node test-sensay-users.js
```

## 7. Data Models (Schemas)
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
caretakerId (UUID -> User)
userId (optional link if patient eventually upgrades to full user)
allowedReplicas[] (list of replica ids they can chat with)
timestamps
unique compound index: { email, caretakerId }
```

Currently the service layer references additional patient convenience fields (`firstName`, `lastName`, `caretakerEmail`, `isActive`, `updateLastLogin()`) — add them if you choose to extend patient experience. (See “Future Enhancements” section.)

### Conversation
```
userId (UUID -> User)
replicaId (string)
title (auto-derived from first user message)
messages[]: { id, text, sender: 'user'|'bot', timestamp }
lastMessageAt (updated pre-save)
timestamps
Index: { userId, replicaId, lastMessageAt desc }
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
| ECONNREFUSED Postgres | Database not reachable (wrong host/port or local service down) | Verify `DATABASE_URL`, ensure Postgres is listening and accessible |
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

## 15.8 Fly.io Postgres Integration
Deploying on Fly with a managed Postgres instance is a three-step flow: provision the database, attach it to the app (which seeds `DATABASE_URL`), then sync the schema with Prisma. The project’s `fly.toml` already wires a `release_command` (`npx prisma db push`) so every deploy reapplies the current schema automatically once the secret exists.

1. Create a dedicated Fly Postgres cluster (pick a region close to your app):
```powershell
flyctl postgres create --name built-with-sensay-db --region fra --vm-size shared-cpu-1x --initial-cluster-size 1
```

2. Attach the database to this app so Fly injects `DATABASE_URL` (and connection pool secrets) automatically:
```powershell
flyctl postgres attach built-with-sensay-db --app built-with-sensay-api
```

3. (Optional) Inspect secrets to confirm the URL is present:
```powershell
flyctl secrets list --app built-with-sensay-api
```

4. Deploy; the release phase now runs `prisma db push` inside the image before traffic shifts:
```powershell
flyctl deploy
```

5. To run manual migrations or Prisma commands against Fly from your laptop, proxy a local port and reuse `DATABASE_URL`:
```powershell
flyctl proxy 15432:5432 --app built-with-sensay-db
$env:DATABASE_URL="postgresql://flycast:<password>@127.0.0.1:15432/<database>?sslmode=disable"
npx prisma studio
```

If you later switch back to Prisma migrations, add `SHADOW_DATABASE_URL` via `flyctl secrets set` so `prisma migrate dev` has an isolated database. The current workflow keeps production credentials off developer machines while ensuring schema updates ship with `prisma db push`.

## 15. Troubleshooting
| Symptom | Likely Cause | Action |
|---------|--------------|-------|
`Firestore connection error` | Bad credentials / network | Verify `GOOGLE_APPLICATION_CREDENTIALS` and service account key |
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
	- Using Firestore for data persistence with Firebase Admin SDK.
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
