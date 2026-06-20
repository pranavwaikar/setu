# Setu Tunnel Architecture Document

This document outlines the production-grade architecture for **Setu**, a developer tunnel platform routing control plane and wildcard user subdomains.

---

## 1. Domain & URL Structure

### Control Plane
- **URL**: `https://setu.helios-logic.com`
- **Scope**: Sign up, log in, dashboard, tunnel management, billing, settings, documentation, and REST API calls (under `/api/*`).

### User Tunnel Domains
- **Format**: `https://<subdomain>.setu.helios-logic.com`
- **Examples**:
  - `https://myapp.setu.helios-logic.com`
  - `https://demo.setu.helios-logic.com`
  - `https://preview-42.setu.helios-logic.com`

---

## 2. System Architecture

```text
                  Internet
                      │
                      ▼
            Gateway (Port 8080/443)
                      │
      ┌───────────────┴───────────────┐
      │ Host: setu.helios-logic.com   │ Host: *.setu.helios-logic.com
      ▼                               ▼
Standard Mux                    Tunnel Registry
  ├── /api/* → api:4000           └── Lookup Active Tunnel
  └── /*     → dashboard:3000          └── Proxy to client stream (Yamux)
```

---

## 3. Gateway Host-Routing Logic

The gateway serves as a single entrypoint and separates control-plane traffic from tunnel-routing traffic based on the HTTP `Host` header.

### Routing Algorithm
1. **Normalize Host**: Extract host without port.
2. **Control Plane Match**:
   If host is exactly `setu.helios-logic.com`:
   - `/tunnel/connect` -> Handle CLI control-plane connections (WebSocket upgrade).
   - `/health` -> Return gateway health check `{"status":"ok"}`.
   - `/api/` -> Proxy to NestJS API container (`http://api:4000`), stripping `/api` prefix.
   - `/` -> Proxy to Next.js Dashboard container (`http://dashboard:3000`).
3. **Subdomain Match**:
   If host ends with `.setu.helios-logic.com` (e.g., `<subdomain>.setu.helios-logic.com`):
   - Extract `<subdomain>`.
   - Check if `<subdomain>` is in the **Reserved Subdomains List**. If so, return `404 Not Found`.
   - Look up the active connection session in the in-memory **Tunnel Registry**.
   - If session found: proxy stream over Yamux multiplexer.
   - If not found: return `404 Not Found` (Tunnel Offline status page).
4. **Fallback**: Any other host returns `404 Not Found`.

---

## 4. DNS & Wildcard Certificate Requirements

To host this in production, the following infrastructure setup is required:

### DNS Configuration
Two DNS records must point to the public IP address of the Setu gateway instance:
1. **A Record / CNAME**:
   - Name: `setu.helios-logic.com`
   - Target: Gateway Public IP / Load Balancer
2. **Wildcard A Record / CNAME**:
   - Name: `*.setu.helios-logic.com`
   - Target: Gateway Public IP / Load Balancer

### Wildcard Certificates (SSL/TLS)
To support secure HTTPS/WSS on all user subdomains, the reverse proxy/ingress layer (e.g. Traefik, Nginx, or Coolify's built-in Let's Encrypt engine) must acquire a wildcard certificate covering:
- `setu.helios-logic.com`
- `*.setu.helios-logic.com`

This requires Let's Encrypt with **DNS-01 challenge validation** (to prove ownership of the domain for wildcard issuance).

---

## 5. Database Schema & Registry Design

### Database Schema (Prisma/PostgreSQL)
The database keeps track of user registration, API keys, claimed subdomains, and historical tunnels:

```prisma
enum Plan {
  FREE
  PRO
  ENTERPRISE
}

model User {
  id           String      @id @default(uuid()) @db.Uuid
  email        String      @unique
  passwordHash String?     @map("password_hash")
  plan         Plan        @default(FREE)
  createdAt    DateTime    @default(now()) @map("created_at")
  subdomains   Subdomain[]
  tunnels      Tunnel[]
  apiKeys      ApiKey[]
  paymentLogs  PaymentLog[]
}

model Subdomain {
  id        String          @id @default(uuid()) @db.Uuid
  userId    String          @map("user_id") @db.Uuid
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  hostname  String          @unique
  status    SubdomainStatus @default(ACTIVE)
  createdAt DateTime        @default(now()) @map("created_at")
  tunnels   Tunnel[]
}

model Tunnel {
  id          String       @id @default(uuid()) @db.Uuid
  userId      String       @map("user_id") @db.Uuid
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  subdomainId String       @map("subdomain_id") @db.Uuid
  subdomain   Subdomain    @relation(fields: [subdomainId], references: [id], onDelete: Cascade)
  localPort   Int          @map("local_port")
  status      TunnelStatus @default(OFFLINE)
  connectedAt DateTime?    @map("connected_at")
}

model PaymentLog {
  id            String   @id @default(uuid()) @db.Uuid
  userId        String   @map("user_id") @db.Uuid
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactionId String   @unique @map("transaction_id")
  amount        Int      
  currency      String   @default("USD")
  status        String   
  plan          Plan
  createdAt     DateTime @default(now()) @map("created_at")
}
```

### Tunnel Registry Design
The active tunnels are kept in an in-memory thread-safe registry in the Go gateway:
- **Registry Structure**:
  - `tunnels`: `map[subdomainName]*yamux.Session`
  - `lock`: `sync.RWMutex` to prevent race conditions during concurrent connections and requests.

---

## 6. Reserved Subdomains Strategy

To prevent users from hijacking administrative or core system subdomains, a strict list of reserved subdomains is maintained at both the API registration layer and the gateway routing layer.

### Reserved Word List
- `admin`, `api`, `root`, `support`, `www`, `mail`, `dns`, `gateway`, `dashboard`, `helios`, `setu`, `auth`, `status`, `docs`

### Handling Policy
1. **API Layer**: The `SubdomainsService` validates subdomain claims against the reserved set and rejects the POST request if matched.
2. **Gateway Layer**: When parsing the incoming hostname, the gateway checks if the extracted subdomain matches any of the reserved subdomains. If matched, it immediately rejects the request with a `404 Not Found` response instead of querying the registry map.

---

## 7. Future Extension Points: Custom Domains

To support custom domains in the future (e.g. `demo.customer.com` mapping to an active tunnel `testsubdomain`), the following architecture points are established:

1. **Subdomain Resolution Helper**:
   - The gateway code implements a helper function `resolveSubdomainFromHost(host string)`.
   - Currently, this function extracts the subdomain from the `<subdomain>.setu.helios-logic.com` suffix.
   - For custom domains, this helper can be expanded to check an in-memory cache (synced with a custom domain DB table) that maps arbitrary hosts (e.g. `demo.customer.com`) to their registered subdomains (e.g. `testsubdomain`).

2. **Registry Lookup**:
   - Once the subdomain is resolved from the custom host, it looks up the same `yamux.Session` as usual, requiring no changes to the streaming/multiplexing core.
