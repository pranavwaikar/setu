# open setu Tunnel Platform - Technical Specification

## Overview

Setu Tunnel is a self-hosted, multi-tenant tunneling platform similar to Expose, ngrok, and Cloudflare Tunnel.

The platform allows users to:

- Sign up and log in through a web dashboard
- Claim up to 10 free subdomains
- Expose local services to the internet
- Create persistent tunnels from localhost to public URLs
- Manage active tunnels
- View tunnel analytics
- Upgrade to paid plans in the future
- Bring custom domains

Example:

```text
127.0.0.1:3000
      ↓
setu expose 3000
      ↓
https://abc.free.dev.example.com
```

The entire stack should be deployable using Docker Compose and run directly on a Coolify server.

---

# Goals

## MVP Goals

- User authentication
- Dashboard
- Tunnel CLI
- Tunnel gateway
- Wildcard subdomains
- Free tier (10 subdomains)
- Docker Compose deployment
- Coolify compatibility

## Future Goals

- Paid plans
- Custom domains
- Team workspaces
- Access control
- Password-protected tunnels
- Webhook forwarding
- Traffic analytics
- Request inspection
- API keys
- Regional tunnel gateways

---

# High-Level Architecture

```text
                    ┌─────────────┐
                    │ Dashboard   │
                    │ Next.js     │
                    └──────┬──────┘
                           │
                           ▼

                    ┌─────────────┐
                    │ API Server  │
                    │ NestJS      │
                    └──────┬──────┘

               ┌───────────┼───────────┐
               ▼           ▼           ▼

          PostgreSQL     Redis      Workers

                           │
                           ▼

                    Tunnel Registry

                           │

                           ▼

                 *.free.dev.setu.com

                           │

                           ▼

                      Traefik

                           │

                           ▼

                     Tunnel Gateway

                           │

                 ┌──────────┴──────────┐
                 ▼                     ▼

            User Tunnel A         User Tunnel B
```

---

# Technology Stack

## Frontend

- Next.js
- TailwindCSS
- shadcn/ui
- TanStack Query

## Backend

- NestJS
- TypeScript
- PostgreSQL
- Redis

## Gateway

- Go
- WebSockets or QUIC
- Reverse proxy layer

## Infrastructure

- Docker Compose
- Coolify
- Traefik
- Let's Encrypt

---

# Domain Structure

## Root Domain

```text
setu.com
```

## Tunnel Domains

```text
free.dev.setu.com
```

Wildcard:

```text
*.free.dev.setu.com
```

Examples:

```text
abc.free.dev.setu.com
demo.free.dev.setu.com
staging.free.dev.setu.com
```

---

# User Flow

## Registration

User registers:

```text
Email + Password
```

or

```text
GitHub OAuth
Google OAuth
```

---

## Claim Subdomain

Dashboard:

```text
Claim Subdomain
```

User enters:

```text
abc
```

System creates:

```text
abc.free.dev.setu.com
```

Validation:

- Unique
- Reserved words blocked
- User quota check

---

## Tunnel Creation

CLI:

```bash
setu login
```

Stores JWT.

Expose service:

```bash
setu expose 3000
```

Response:

```text
Tunnel created

https://abc.free.dev.setu.com
```

---

# Authentication

## JWT

Access token:

```text
15 minutes
```

Refresh token:

```text
30 days
```

Storage:

```text
HTTP-only cookies
```

---

# Subscription System

## Free Plan

Limits:

```text
10 subdomains
3 active tunnels
1 GB/day traffic
```

## Pro Plan (Future)

```text
100 subdomains
Unlimited tunnels
Custom domains
Analytics
```

---

# Database Schema

## users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMP NOT NULL
);
```

---

## subdomains

```sql
CREATE TABLE subdomains (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  hostname TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

---

## tunnels

```sql
CREATE TABLE tunnels (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  subdomain_id UUID REFERENCES subdomains(id),
  local_port INTEGER,
  status TEXT,
  connected_at TIMESTAMP
);
```

---

## api_keys

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  key_hash TEXT NOT NULL,
  created_at TIMESTAMP
);
```

---

# Gateway Design

## Responsibilities

- Accept tunnel connections
- Register active tunnels
- Route requests
- Maintain heartbeats
- Disconnect stale clients

---

## Registry

In-memory:

```go
map[string]*Tunnel
```

Example:

```text
abc.free.dev.setu.com
       ↓
Tunnel ID
       ↓
Connection
```

---

# Tunnel Protocol

## Connection Flow

```text
CLI
 ↓
Gateway
 ↓
Authentication
 ↓
Tunnel Registration
 ↓
Heartbeat Loop
```

Heartbeat:

```text
Every 30 seconds
```

Timeout:

```text
90 seconds
```

---

# Request Routing

Incoming:

```text
Host: abc.free.dev.setu.com
```

Flow:

```text
Traefik
 ↓
Gateway
 ↓
Tunnel Lookup
 ↓
Tunnel Connection
 ↓
127.0.0.1:3000
```

---

# CLI Design

## Commands

Login

```bash
setu login
```

Expose

```bash
setu expose 3000
```

Status

```bash
setu status
```

List tunnels

```bash
setu tunnels
```

Logout

```bash
setu logout
```

---

# Security

## TLS

All traffic encrypted.

```text
HTTPS only
```

Certificates:

```text
Let's Encrypt wildcard
```

---

## Abuse Protection

Rate limits:

```text
100 req/min/user
```

Reserved names:

```text
admin
api
root
support
www
mail
```

Blocked content:

- Malware
- Phishing
- Spam tunnels

---

# Analytics

Store:

```text
Requests
Bandwidth
Response time
Tunnel uptime
```

Future dashboard charts:

- Daily requests
- Traffic
- Top tunnels

---

# Docker Compose Services

```yaml
services:
  postgres:
  redis:
  api:
  dashboard:
  gateway:
  worker:
  traefik:
```

---

# Coolify Deployment

Environment variables:

```env
TUNNEL_DOMAIN=setu.yourdomain.com
PUBLIC_DOMAIN=https://setu.yourdomain.com
GATEWAY_API_TOKEN=your-secret-token
JWT_SECRET=your-jwt-secret
```

> [!IMPORTANT]
> **Build-Time Compilation:** The dashboard utilizes `NEXT_PUBLIC_TUNNEL_DOMAIN` and `NEXT_PUBLIC_PUBLIC_DOMAIN` build arguments. When deploying via Coolify, ensure `TUNNEL_DOMAIN` and `PUBLIC_DOMAIN` are defined in your Coolify service environment variables **before** triggering the build/deployment, as Next.js bakes these variables into the static bundle at build time.

Deployment steps:

1. Push repository.
2. Connect repository in Coolify.
3. Configure environment variables (`TUNNEL_DOMAIN`, `PUBLIC_DOMAIN`, `GATEWAY_API_TOKEN`, `JWT_SECRET`, etc.).
4. Assign your public domain (e.g. `https://setu.yourdomain.com`) **only to the `gateway` service** in the Coolify domain configuration. Keep the domain configuration for the `dashboard` and `api` services **empty**.
5. Configure wildcard DNS.
6. Deploy stack (rebuild is required if domains change).
7. Verify TLS.
8. Create first admin account.

---

# Development Phases

## Phase 1

Foundation

- Auth
- Dashboard
- PostgreSQL
- Redis
- Docker Compose

Estimated: 1 week

---

## Phase 2

Tunnel Infrastructure

- Gateway
- Tunnel registration
- Request routing
- CLI

Estimated: 2 weeks

---

## Phase 3

Production Readiness

- Analytics
- Rate limiting
- Logging
- Monitoring

Estimated: 1 week

---

## Phase 4

Commercial Features

- Billing
- Custom domains
- Teams
- API access

Estimated: 2–4 weeks

---

# Monitoring

Recommended stack:

```text
Prometheus
Grafana
Loki
OpenTelemetry
```

Metrics:

- Active tunnels
- Connected users
- Requests/sec
- Gateway latency
- Error rate

---

# Long-Term Vision

Setu Tunnel becomes a self-hostable developer platform providing:

- Public tunnels
- Webhook inspection
- Team collaboration
- Custom domains
- Secure ingress
- Edge routing
- API gateway capabilities

while remaining deployable through a single Docker Compose stack and manageable through Coolify.
