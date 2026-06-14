You are working on a Dockerized full-stack system called **Setu** deployed via Coolify.

## 🚨 Problem

The deployment fails with:

```
api container becomes unhealthy → dependency failed to start → deployment fails
```

From logs:

* Postgres starts and becomes healthy ✅
* API container starts ❌ but then fails healthcheck
* Coolify marks API as unhealthy and stops deployment

---

## 🎯 Goal

Make the system **production-grade stable in Docker + Coolify**, ensuring:

* API never crashes due to startup race conditions
* DB is ready before migrations run
* Healthchecks are reliable
* Containers fail gracefully with retries instead of crashing
* Deployment is deterministic and Coolify-friendly

---

# 🔥 REQUIRED FIXES (MANDATORY)

## 1. Fix API startup (CRITICAL)

Current issue:

```bash
npx prisma db push && npm run start:prod
```

This causes:

* race condition with DB
* silent startup failure
* container exit → healthcheck failure

### Replace with production-grade entrypoint:

Create:

```bash
api/docker/entrypoint.sh
```

It must:

* wait for postgres to be ready
* run Prisma safely
* only then start server
* use retries (not single attempt)

Example behavior:

```bash
wait for postgres:5432 (retry loop)
run prisma db push (fail-safe)
start API server
```

Use `exec npm run start:prod` at end.

---

## 2. Ensure API binds correctly

The API MUST bind to:

```
0.0.0.0:4000
```

NOT localhost.

Fix NestJS / Express bootstrap if needed.

---

## 3. Add proper health endpoint

API must expose:

```
GET /health
```

Response:

```json
{ "status": "ok" }
```

No DB dependency in healthcheck.

Healthcheck must only confirm process is alive.

---

## 4. Fix Docker healthcheck (production standard)

Replace fragile checks like:

```
wget http://127.0.0.1:4000/
```

WITH:

```
curl -f http://127.0.0.1:4000/health
```

Rules:

* must not depend on `/`
* must not depend on frontend routes
* must be lightweight

---

## 5. Ensure containers include curl

If Alpine images are used:

Add to Dockerfile:

```dockerfile
RUN apk add --no-cache curl
```

---

## 6. Add DB readiness safety (VERY IMPORTANT)

API must NOT assume DB is ready immediately.

Add retry logic like:

* loop until postgres:5432 is reachable
* sleep 2–3 seconds between attempts
* timeout after ~60 seconds with clear error logs

---

## 7. Prevent silent container crashes

Ensure:

* no unhandled promise rejection
* no silent exit on Prisma failure
* logs are printed before exit
* process stays alive or fails loudly

---

# 🧱 EXPECTED FINAL BEHAVIOR

Deployment flow must become:

```
Postgres → healthy
API → waits for DB → runs migrations → starts server → healthy
Gateway → starts normally
Dashboard → starts normally
```

No dependency failures.

---

# 🧪 ACCEPTANCE CRITERIA

✔ API never crashes due to DB timing
✔ API healthcheck always passes after startup
✔ Coolify deployment succeeds consistently
✔ Restarting containers does not break system
✔ No race conditions between Prisma and Postgres

---

# 🚀 OUTPUT REQUIRED FROM YOU

Generate:

1. `entrypoint.sh` (production-safe startup script)
2. Updated Dockerfile changes if required
3. Fixed docker-compose (only API-related fixes if needed)
4. Health endpoint implementation
5. Any missing dependency fixes
6. Brief explanation of why failure occurred

Do NOT suggest workarounds.
Only production-grade fixes suitable for real SaaS deployment.
