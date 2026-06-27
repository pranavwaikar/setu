<div align="center">

<img src="./dashboard/public/setu-logo.png" alt="Setu Logo" width="100" height="100" style="border-radius: 24px; margin-bottom: 20px;" />

# Setu

**Expose local servers to the internet with secure, instant public URLs.**

**[Try Setu Live](https://setu.helios-logic.com) • [Claim a Free Subdomain](https://setu.helios-logic.com)**

[![Release](https://img.shields.io/github/v/release/pranavwaikar/setu?style=flat-square)](https://github.com/pranavwaikar/setu/releases/latest)
[![Go Version](https://img.shields.io/badge/go-1.24%2B-blue?style=flat-square)](https://go.dev/)
[![License](https://img.shields.io/badge/license-AGPL--3.0-orange?style=flat-square)](LICENSE)

<img src="./demos/Setu%20wide%20resolution.gif" alt="Setu Demo" width="100%" style="max-width: 800px; border-radius: 12px; border: 1px solid #30363d; box-shadow: 0 8px 24px rgba(0,0,0,0.5); margin-top: 20px;" />

</div>

```bash
curl -fsSL https://raw.githubusercontent.com/pranavwaikar/setu/main/scripts/install.sh | bash && setu expose 3000
```

```text
┌────────────────┐       ┌──────────────┐       ┌─────────────────────────────────────┐
│ localhost:3000 │  ───> │  Setu Agent  │  ───> │ https://myapp.setu.helios-logic.com │
└────────────────┘       └──────────────┘       └─────────────────────────────────────┘
```

---

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/pranavwaikar/setu/main/scripts/install.sh | bash
```

```bash
setu expose 3000
```

---

## Features

* **HTTP & TCP Tunneling**: Expose local web applications, HTTPS targets, or raw TCP sockets (databases, SSH).
* **Traffic Inspector UI**: View HTTP request/response payloads in real time and replay webhooks locally at `http://localhost:4500/inspect`.
* **Edge Authentication**: Guard public URLs with HTTP Basic Authentication before traffic reaches your machine.
* **Self-Hostable Gateway**: Deploy your own tunneling cluster on a VPS with Docker Compose, dynamic Traefik routing, and wildcard TLS.

---

## Why Setu?

Most tunneling tools charge high subscription fees for custom subdomains, wildcard certificates, and stable TCP ports. Setu provides a developer experience on par with commercial tools, while remaining fully open-source and easy to self-host on your own infrastructure.

---

## How It Works

1. **Start Server**: Launch your application locally on any port.
2. **Run CLI**: Start the agent using `setu expose <port>`.
3. **Connect Tunnel**: The agent opens a secure, multiplexed WebSocket connection to the gateway.
4. **Get URL**: The gateway routes incoming public requests to your local application.

---

## Use Cases

* **Webhook Testing**: Inspect and replay Stripe, GitHub, or Dodo Payments webhook payloads locally.
* **Client Demos**: Share a live public link to your work-in-progress codebase.
* **Mobile Development**: Connect physical devices directly to your local backend API.
* **OAuth Integrations**: Test third-party authentication flows that require valid redirect URLs.

---

## Architecture

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Client/Browser  │ ────> │  Setu Gateway   │ ────> │   Setu Agent    │ ───> Local App (Port 3000)
│ (Public Web)    │       │ (Public Server) │       │ (Local Machine) │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                   ▲                         │
                                   └────── Secure Tunnel ────┘
```

---

## Demo

Watch the setup and features walkthrough on YouTube:

<div align="center">
  <a href="https://youtu.be/ncev7-qbUWU" target="_blank">
    <img src="https://img.youtube.com/vi/ncev7-qbUWU/maxresdefault.jpg" alt="Setu Demo Video" width="100%" style="max-width: 800px; border-radius: 12px; border: 1px solid #30363d; box-shadow: 0 8px 24px rgba(0,0,0,0.5);" />
  </a>
</div>

---

## Try It Now

Expose your first local server in seconds:

```bash
# Install Setu CLI
curl -fsSL https://raw.githubusercontent.com/pranavwaikar/setu/main/scripts/install.sh | bash

# Expose a local port
setu expose 3000
```

---

<details>
<summary><b>🛠️ Self-Hosting Guide</b></summary>

You can run your own Setu gateway on any VPS. The stack is `docker-compose`-based and fronted by Traefik (managed via Coolify).

### Prerequisites

| Requirement | Exact Version | Notes |
|---|---|---|
| **Coolify** | **≥ 4.1.2** | Manages deployments, TLS, and Traefik |
| **Traefik** | **v3.x** (bundled with Coolify 4.x) | v2 uses different `HostRegexp` syntax — will silently break wildcard routing |
| **Docker** | ≥ 24.x | Required by Coolify |
| **Docker Compose** | ≥ 2.x (Compose V2) | Bundled with Docker Desktop / Coolify |
| **DNS provider** | **Cloudflare** | Required for wildcard TLS certificate issuance via DNS-01 challenge |
| **DNS records** | Wildcard `A` record | `*.yourdomain.com` → your server IP (required for tunnel subdomains) |

> [!IMPORTANT]
> **Traefik v3 is required.** The wildcard subdomain routing uses `HostRegexp` which changed syntax between Traefik v2 and v3. Coolify 4.x ships with Traefik v3 automatically — if you are on Coolify 3.x (which used Traefik v2), you must upgrade to Coolify 4.x before deploying Setu.

> [!IMPORTANT]
> **Your domain must be managed by Cloudflare.** Wildcard TLS certificates (`*.yourdomain.com`) require a DNS-01 challenge, which needs API access to your DNS provider. Setu's self-hosting setup is configured for Cloudflare. If your domain is with another provider (Namecheap, Route 53, etc.), you will need to swap the Traefik DNS provider accordingly.

> [!WARNING]
> **Wildcard DNS is mandatory.** Without a `*.yourdomain.com` A record pointing to your server, tunnel subdomains (e.g. `my-app.yourdomain.com`) will not resolve — the public URL shown by the CLI will be unreachable regardless of gateway configuration.

---

### Deployment Steps

#### 1. Install Coolify (≥ 4.1.2) on your VPS

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

#### 2. Add DNS records in Cloudflare

In your Cloudflare dashboard for `yourdomain.com`, add **two** A records:

| Type | Name | Value | Proxy status |
|---|---|---|---|
| A | `yourdomain.com` | `<your-server-IP>` | DNS only (grey cloud) |
| A | `*` | `<your-server-IP>` | DNS only (grey cloud) |

The `*` wildcard record covers all subdomains. Set both records to **"DNS only"** (grey cloud), not "Proxied" (orange cloud). Cloudflare's proxy intercepts WebSocket connections and will break tunnel sessions.

#### 3. Create a Cloudflare API Token

This token lets Traefik temporarily create a DNS TXT record to prove domain ownership to Let's Encrypt when issuing the wildcard certificate.

1. Log into [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click your **profile icon** (top right) → **"My Profile"**
3. Left sidebar → **"API Tokens"** → **"Create Token"**
4. Click **"Use template"** next to **"Edit zone DNS"**
5. Under **Zone Resources**: set to `Include → Specific zone → yourdomain.com`
6. Click **"Continue to summary"** → **"Create Token"**
7. **Copy the token shown** — it is only displayed once

#### 4. Add the DNS-01 certresolver to Traefik via Coolify

In the Coolify dashboard, navigate to:

**Dashboard → Servers → _your server name_ → Proxy → Configuration**

You will see the `coolify-proxy` Docker Compose file. Edit it to add an `environment:` section and five new `command:` lines:

**Add the `environment:` block** (place it after `extra_hosts:` and before `networks:`):

```yaml
    environment:
      - CF_DNS_API_TOKEN=PASTE_YOUR_CLOUDFLARE_TOKEN_HERE
```

**Add these 5 lines at the end of the `command:` block** (before `labels:`):

```yaml
      - '--certificatesresolvers.letsencrypt-dns.acme.dnschallenge=true'
      - '--certificatesresolvers.letsencrypt-dns.acme.dnschallenge.provider=cloudflare'
      - '--certificatesresolvers.letsencrypt-dns.acme.dnschallenge.resolvers=1.1.1.1:53,8.8.8.8:53'
      - '--certificatesresolvers.letsencrypt-dns.acme.storage=/traefik/acme-dns.json'
      - '--certificatesresolvers.letsencrypt-dns.acme.email=your-email@example.com'
```

After editing, click **"Save"** then click the **"Restart Proxy"** button on the same page. Traefik will restart with the new DNS certresolver active.

#### 5. Set the environment variables in your Coolify service

Before deploying, configure these environment variables in your Coolify service settings. Reference [.env.example](.env.example) for defaults.

##### Required Configuration

| Variable | Default Value | Description |
|---|---|---|
| `PUBLIC_DOMAIN` | `https://setu.helios-logic.com` | Public URL of your Setu instance |
| `TUNNEL_DOMAIN` | `setu.helios-logic.com` | Base domain used to derive tunnel subdomains |
| `GATEWAY_API_TOKEN` | `default-gateway-secret` | Shared secret between gateway and API |
| `JWT_SECRET` | `supersecretjwtkey` | Secret for signing user authentication JWTs |
| `NODE_ENV` | `production` | Running environment mode (enforces secure cookies & strict validation checks) |

##### Optional / Automatic Configuration

These are handled automatically by `docker-compose.yml`, but can be overridden:

| Variable | Default Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:password@postgres:5432/setu?schema=public` | Connection URL for PostgreSQL database |
| `INTERNAL_API_URL` | `http://api:4000` | Internal API server URL (for Next.js SSR requests) |
| `NEXT_PUBLIC_TUNNEL_DOMAIN` | *(Inherits `TUNNEL_DOMAIN`)* | Next.js build-time fallback tunnel domain |
| `NEXT_PUBLIC_PUBLIC_DOMAIN` | *(Inherits `PUBLIC_DOMAIN`)* | Next.js build-time fallback public URL |
| `ENABLE_EMAIL_VERFICATION` | `false` | Enable user email verification upon signup and forgot password flows (requires Resend API key) |
| `RESEND_API_KEY` | `re_placeholder_key` | API Key for Resend email service (required if `ENABLE_EMAIL_VERFICATION=true` or forgot password is used) |
| `EMAIL_FROM` | `onboarding@resend.dev` | Configurable sender address for outgoing verification/reset emails |
| `ADMIN_EMAIL` | `admin@setu.com` | Access email for the AdminJS admin panel |
| `ADMIN_PASSWORD` | `adminpassword123` | Access password for the AdminJS admin panel |
| `ADMIN_COOKIE_PASSWORD` | `sessionsecretcookiekey1234567890` | Encryption secret key used for session cookies (must be at least 32 characters) |
| `DODO_API_KEY` | `dp_test_d8f28c29188e7bcf5f1a` | API key for Dodo Payments (defaults to placeholder sandbox test mode key) |
| `DODO_TEST_MODE` | `true` | Enable test mode sandbox environment for Dodo Payments |
| `DODO_WEBHOOK_SECRET` | *(None)* | Webhook Secret Key for verifying signatures (required for secure production webhooks at `/api/payments/webhook`) |
| `DODO_PRO_PRODUCT_ID` | `prod_pro_123` | Product ID created in Dodo Payments dashboard for the PRO tier upgrades |

> [!IMPORTANT]
> **Build-Time Compilation:** Because Next.js compiles the dashboard's domain configuration (`NEXT_PUBLIC_TUNNEL_DOMAIN` and `NEXT_PUBLIC_PUBLIC_DOMAIN`) into the client-side JavaScript bundle during the Docker build process, the `TUNNEL_DOMAIN` and `PUBLIC_DOMAIN` environment variables **must be defined before deploying or building the service in Coolify**.
> If you update these environment variables later, you **must trigger a redeploy with a full rebuild** of the dashboard service for the new domains to take effect in the browser UI.

#### 6. Deploy Setu & Configure Service Domains

1. Point Coolify at this repository and select `docker-compose.yml` as the compose file.
2. **Configure Service Domains**:
   In the Coolify dashboard for your application services:
   * **`gateway`**: Configure the public domain/URL (e.g., `https://setu.yourdomain.com`). The gateway acts as the main entry point and multiplexes all public requests.
   * **`dashboard`**: **Keep the domain field empty**.
   * **`api`**: **Keep the domain field empty**.
   
   > [!IMPORTANT]
   > Do not assign public domains to the `dashboard` or `api` services in Coolify. The gateway handles routing internally (proxying `/` requests to the dashboard service and `/api/*` requests to the API service).

3. **Configure Wildcard Routing (Coolify Traefik Dynamic Config)**:
   Because Coolify's compose parser does not interpolate environment variables in `labels`, wildcard subdomain routing must be configured directly in Coolify's Traefik Proxy configuration editor:
   * Go to **Servers** -> **[Your Server]** -> **Proxy** tab.
   * Navigate to **Dynamic Configurations** (or edit the Proxy configuration file) and add/edit a file (e.g., `setu.yaml`).
   * Add the following YAML configuration (replace `setu.yourdomain.com` with your actual domain):
     ```yaml
     http:
       routers:
         setu-tunnel-https:
           rule: "HostRegexp(`^[a-z0-9-]+[.]setu.yourdomain.com$`)"
           entryPoints:
             - https
           service: setu-tunnel-svc
           tls:
             certResolver: letsencrypt-dns
             domains:
               - main: setu.yourdomain.com
                 sans:
                   - "*.setu.yourdomain.com"
         setu-tunnel-http:
           rule: "HostRegexp(`^[a-z0-9-]+[.]setu.yourdomain.com$`)"
           entryPoints:
             - http
           middlewares:
             - redirect-to-https
           service: setu-tunnel-svc
       services:
         setu-tunnel-svc:
           loadBalancer:
             servers:
               - url: "http://setu-gateway:8080"
     ```
     *(Note: We use `setu-gateway` as the backend service hostname because the gateway service is assigned the `setu-gateway` network alias in the `coolify` network, allowing Traefik to resolve it statically regardless of the dynamic container names generated by Coolify.)*

4. **Deploy the service**: Click **Deploy** in the Coolify UI.

#### 7. Verify everything is working

**Gateway health:**
```bash
curl https://setu.yourdomain.com/health
# Expected: {"status":"ok"}
```

**Wildcard TLS certificate** (run after ~60 seconds):
```bash
curl -v https://any-name.setu.yourdomain.com/health 2>&1 | grep "subject:"
# Expected: subject: CN=*.setu.yourdomain.com
# (not "TRAEFIK DEFAULT CERT")
```

Once the wildcard cert is issued, all tunnel subdomains will show the green padlock 🔒 in browsers with no warnings.

### How the wildcard TLS works (background)

Standard Let's Encrypt certificates are issued via **HTTP-01 challenge** — Let's Encrypt makes a request to your server to verify ownership. This only works for exact hostnames.

Wildcard certificates (`*.setu.yourdomain.com`) require **DNS-01 challenge** — Let's Encrypt asks you to create a specific `_acme-challenge` TXT record in your DNS zone. Traefik uses the Cloudflare API token to create and delete this TXT record automatically. After validation, a single certificate covers every tunnel subdomain.

</details>

<details>
<summary><b>💻 CLI Reference & Configuration</b></summary>

### Commands

| Command | Description |
|---|---|
| `setu login` | Save API key credentials |
| `setu logout` | Remove saved credentials |
| `setu expose <port> --subdomain foo` | Expose a local port via a claimed subdomain |
| `setu start` | Start all tunnels from saved config |
| `setu setup` | Open the visual configuration panel |
| `setu status` | Show current config and auth status |
| `setu update` | Update setu to the latest GitHub release |
| `setu doctor` | Run system diagnostics |
| `setu version` | Print version, commit, and build date |

### Visual Multi-Tunnel Configuration

For complex applications (like microservices or project structures with both a frontend and backend), running individual `setu expose` commands can become cumbersome. Setu provides a visual setup panel and a multi-tunnel starter to simplify this.

1. **Visual Configuration via `setu setup`**
   Run the following command to start a local configuration web UI:
   ```bash
   setu setup
   ```
   This launches a local web interface in your browser (usually at `http://localhost:4500`). In this interface, you can manage API keys and graphically assign local ports (e.g. `3000` or `8080`) to your claimed subdomains. Once you click "Save and Exit", your configurations are stored in `~/.setu/config.json` and the CLI returns control to your terminal.

2. **Run All Tunnels Concurrently via `setu start`**
   Once configured, you can launch all of your tunnels at once using a single command:
   ```bash
   setu start
   ```
   This reads your saved mappings from `~/.setu/config.json` and runs all tunnel processes concurrently in the background.

### Environment & Files

Setu stores its configuration at `~/.setu/config.json`.

| Variable | Description | Default |
|---|---|---|
| `GITHUB_OWNER` | GitHub repository owner | `pranavwaikar` |
| `GITHUB_REPO` | GitHub repository name | `setu` |
| `API_SERVER_URL` | Override the API server URL | inferred from config |

</details>

<details>
<summary><b>💳 Dodo Payments Integration</b></summary>

Setu integrates with [Dodo Payments](https://dodopayments.com/) to process Pro/Enterprise plan upgrades, handle recurring subscription payments, and manage webhook-driven subscription events.

### Setup Guide

#### 1. Create a Dodo Payments Account
Sign up on the [Dodo Payments Dashboard](https://dodopayments.com/).

#### 2. Create a Subscription Product
1. In the Dodo Payments dashboard, navigate to **Products**.
2. Click **Create Product**.
3. Set your product details:
   - **Name**: `Setu Pro`
   - **Billing Type**: `Subscription / Recurring`
   - **Price**: `$5.00 USD` per month
4. Copy the generated **Product ID** (e.g., `prod_pro_123`). This will be set as `DODO_PRO_PRODUCT_ID`.

#### 3. Retrieve your API Key
1. Navigate to **Developer Settings** -> **API Keys**.
2. Create a new API Key (Test Mode or Live Mode depending on your environment).
3. Copy the key. This will be set as `DODO_API_KEY`.

#### 4. Configure Webhooks
Webhooks are essential to process subscription states (upgrades, failures, cancellations, and renewals) asynchronously.
1. Navigate to **Developer Settings** -> **Webhooks**.
2. Click **Add Endpoint**.
3. Set **Endpoint URL** to:
   ```text
   https://yourdomain.com/api/payments/webhook
   ```
   *(Replace `yourdomain.com` with your Setu public domain).*
4. Select the following **Webhook Events**:
   - `checkout.completed`
   - `subscription.active`
   - `payment.succeeded`
   - `payment.failed`
   - `subscription.failed`
   - `subscription.cancelled`
   - `subscription.expired`
5. Save the Webhook.
6. Copy the **Webhook Signing Secret** (starts with `whsec_`). This will be set as `DODO_WEBHOOK_SECRET` to enable signature verification on all incoming webhooks.

</details>

<details>
<summary><b>🔒 Admin Panel & Maintenance</b></summary>

### Admin Panel (AdminJS)

Setu features a built-in admin dashboard using [AdminJS](https://github.com/SoftwareBrothers/adminjs) to manage database models directly.

#### Accessing the Panel
The admin panel is securely reverse-proxied by the gateway and is accessible at:
`https://<your-public-domain>/admin-panel` (or `http://localhost:3000/admin-panel` when running locally).

#### Configuration
Access to the admin panel is protected by Basic Authentication. You can customize the credentials using the following environment variables:
- `ADMIN_EMAIL`: The admin user login email address (defaults to `admin@setu.com`).
- `ADMIN_PASSWORD`: The admin user login password (defaults to `adminpassword123`).
- `ADMIN_COOKIE_PASSWORD`: Secret encryption key used to sign session cookies (defaults to `sessionsecretcookiekey1234567890`, must be at least 32 characters long).

---

### Building from Source

```bash
git clone https://github.com/pranavwaikar/setu.git
cd setu
make build
./setu version
```

---

### Release Process

Releases are fully automated via GitHub Actions + GoReleaser:

```bash
git tag v1.2.0
git push origin v1.2.0
```

This will:
- Build binaries for all platforms
- Generate SHA256 `checksums.txt`
- Create a GitHub Release with all assets

---

### Uninstalling

If you need to uninstall Setu CLI, run the following commands:

#### Linux / macOS
```bash
# Remove the binary
sudo rm -f /usr/local/bin/setu

# Remove local configuration & databases
rm -rf ~/.setu
```

#### Windows (PowerShell)
```powershell
# Remove the binary and install folder
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\setu"

# Remove local configuration & databases
Remove-Item -Recurse -Force "$env:USERPROFILE\.setu"
```

</details>

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). See the [LICENSE](LICENSE) file for details.

© Pranav Waikar
