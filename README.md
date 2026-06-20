<div align="center">

<img src="./dashboard/public/setu-logo.png" alt="Setu Logo" width="100" height="100" style="border-radius: 24px; margin-bottom: 20px;" />

# ⚡ Setu

**Expose your local servers to the public internet — securely and instantly.**

[![Release](https://img.shields.io/github/v/release/pranavwaikar/setu?style=flat-square)](https://github.com/pranavwaikar/setu/releases/latest)
[![Go Version](https://img.shields.io/badge/go-1.24%2B-blue?style=flat-square)](https://go.dev/)
[![License](https://img.shields.io/badge/license-AGPL--3.0-orange?style=flat-square)](LICENSE)

</div>

---

## What is Setu?

Setu is a lightweight, self-hosted tunneling CLI that proxies your local development servers to publicly accessible subdomains — without relying on third-party services.

### Live Demo

A live instance of Setu is hosted and available at:
👉 **[https://setu.helios-logic.com](https://setu.helios-logic.com)**

Sign up for a free account, generate an API Key, claim your subdomains, and immediately tunnel your local servers.

---

## Installation

### Linux / macOS (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/pranavwaikar/setu/main/scripts/install.sh | bash
```

### Manual Download

1. Visit the [Releases page](https://github.com/pranavwaikar/setu/releases/latest)
2. Download the archive matching your OS and architecture:

| OS      | Arch  | Archive                        |
|---------|-------|--------------------------------|
| Linux   | amd64 | `setu_linux_amd64.tar.gz`      |
| Linux   | arm64 | `setu_linux_arm64.tar.gz`      |
| macOS   | amd64 | `setu_darwin_amd64.tar.gz`     |
| macOS   | arm64 | `setu_darwin_arm64.tar.gz`     |
| Windows | amd64 | `setu_windows_amd64.zip`       |

3. Extract and move the binary to a directory in your `$PATH`.

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/pranavwaikar/setu/main/scripts/install.ps1 | iex
```

### Verify installation

```bash
bash scripts/verify.sh
```

---

## Quick Start

### 1. Authenticate

```bash
setu login
```

### 2. Expose a local port

```bash
setu expose 3000 --subdomain myapp
```

#### Host Header Overrides (for Vite, Webpack, Next.js)

If your local server rejects requests with an "Invalid Host Header" error, you can rewrite it to match the local target using `--host-header`:

```bash
# Rewrite Host header to match target (e.g., localhost:3000)
setu expose 3000 --subdomain myapp --host-header rewrite

# Or override it to a specific value
setu expose 3000 --subdomain myapp --host-header my-custom-host.local:3000
```

#### Tunneling to Local HTTPS Endpoints

If your local server runs on HTTPS/TLS (even with self-signed certificates), you can specify the `https://` scheme and use `--insecure-skip-verify` to bypass certificate verification:

```bash
setu expose https://localhost:3000 --subdomain myapp --insecure-skip-verify
```

#### Edge Protection (Basic Auth)

To protect your exposed local server from unauthorized public users or automated web scanners, you can enable HTTP Basic Authentication at the Gateway edge using the `--auth` flag:

```bash
# Challenge visitors with a username and password before allowing access
setu expose 3000 --subdomain myapp --auth "admin:mypassword123"
```

#### Layer-4 Raw TCP Tunneling

To expose raw TCP-based applications (like PostgreSQL, MySQL, SSH, or custom game servers) without parsing or terminating the application layer protocol, use the `--tcp` flag. The gateway dynamically allocates a high-port for your tunnel:

```bash
# Expose a local PostgreSQL database (port 5432)
setu expose 5432 --subdomain mydb --tcp
```

The CLI will print the allocated public address (e.g. `setu.helios-logic.com:32145 -> localhost:5432`) which you can use directly with database clients.

### 3. Or use the visual setup panel

```bash
setu setup
```

Opens a local web UI to manage API keys, claim subdomains, and configure port mappings.

### 4. Start all configured tunnels

```bash
setu start
```

---

## Local HTTP Request/Response Inspection UI

When active tunnels are running (either via `setu expose` or `setu start`), a local HTTP inspection server will run in the background (defaulting to port `4500` or incrementing if bound).

Open your browser to:
👉 **[http://localhost:4500/inspect](http://localhost:4500/inspect)**

From this dashboard, you can:
*   **Inspect Traffic**: Visually inspect all incoming HTTP payloads, headers, cookies, and response status codes in real time as they proxy down the tunnel.
*   **1-Click Webhook Replay**: Instantly clone and replay any captured HTTP request or webhook payload back to your local application port with a single click. This eliminates the need to manually trigger developer portals (like Stripe, GitHub, or Twilio) while debugging.

---

## Multi-Tunneling & Visual Configuration (`setup` & `start`)

For complex applications (like microservices or project structures with both a frontend and backend), running individual `setu expose` commands can become cumbersome. Setu provides a visual setup panel and a multi-tunnel starter to simplify this.

### 1. Visual Configuration via `setu setup`

Run the following command to start a local configuration web UI:

```bash
setu setup
```

This launches a beautiful, local web interface in your browser (usually at `http://localhost:4500`). In this interface, you can:
*   **Manage API Keys**: Save your account credentials locally.
*   **Map Ports to Subdomains**: Graphically assign local ports (e.g. `3000` or `8080`) to your claimed subdomains (e.g. `jhon-cena`).
*   **Save and Exit**: Once you click the "Save and Exit" button, your configurations are stored securely in `~/.setu/config.json`, the local server is cleanly shut down, and your terminal control is returned.

### 2. Run All Tunnels Concurrently via `setu start`

Once configured, you can launch all of your tunnels at once using a single command:

```bash
setu start
```

This reads your saved mappings from `~/.setu/config.json` and runs all tunnel processes concurrently in the background, outputting unified traffic logs directly to your terminal screen.

---

## Updating

```bash
setu update
```

Setu fetches the latest release from GitHub, verifies the SHA256 checksum, and atomically replaces itself — with automatic rollback if anything goes wrong.

---

## Diagnostics

```bash
setu doctor
```

Output includes:

```text
⚕  Setu Doctor
──────────────────────────────────────
  Version:          v1.2.0
  Commit:           abc1234
  Build Date:       2024-06-01T12:00:00Z
  OS:               darwin
  Architecture:     arm64
  Executable Path:  /usr/local/bin/setu
──────────────────────────────────────
  GitHub API:       ✔ reachable
  Update Available: ✔ up to date
──────────────────────────────────────
```

---

## Version

```bash
setu version
```

```text
Setu CLI
  Version:    v1.2.0
  Commit:     abc1234
  Build Date: 2024-06-01T12:00:00Z
```

---

## All Commands

| Command                              | Description                                    |
|--------------------------------------|------------------------------------------------|
| `setu login`                         | Save API key credentials                       |
| `setu logout`                        | Remove saved credentials                       |
| `setu expose <port> --subdomain foo` | Expose a local port via a claimed subdomain    |
| `setu start`                         | Start all tunnels from saved config            |
| `setu setup`                         | Open the visual configuration panel            |
| `setu status`                        | Show current config and auth status            |
| `setu update`                        | Update setu to the latest GitHub release       |
| `setu doctor`                        | Run system diagnostics                         |
| `setu version`                       | Print version, commit, and build date          |

---

## Configuration

Setu stores its config at `~/.setu/config.json`.

Environment variables:

| Variable         | Description                        | Default            |
|------------------|------------------------------------|--------------------|
| `GITHUB_OWNER`   | GitHub repository owner            | `pranavwaikar`     |
| `GITHUB_REPO`    | GitHub repository name             | `setu`             |
| `API_SERVER_URL` | Override the API server URL        | inferred from config |

---

## Self-Hosting

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

The `*` wildcard record covers all subdomains — including multi-level ones like `my-app.setu.yourdomain.com`. This is a Cloudflare-specific behaviour: Cloudflare's wildcard matches subdomains at any depth, whereas standard DNS wildcards only cover one level. Coolify and Traefik handle all routing from there.

> [!WARNING]
> Set both records to **"DNS only"** (grey cloud), not "Proxied" (orange cloud). Cloudflare's proxy intercepts WebSocket connections and will break tunnel sessions.

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

Before deploying, configure these environment variables in your Coolify service settings. A template is available in [.env.example](file:///Users/pranavwaikar/Documents/GitHub/setu/.env.example) for reference.

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

**Wildcard TLS certificate** (run after ~60 seconds — Let's Encrypt issuance takes a moment):
```bash
curl -v https://any-name.setu.yourdomain.com/health 2>&1 | grep "subject:"
# Expected: subject: CN=*.setu.yourdomain.com
# (not "TRAEFIK DEFAULT CERT")
```

Once the wildcard cert is issued, all tunnel subdomains will show the green padlock 🔒 in browsers with no warnings.

---

### How the wildcard TLS works (background)

Standard Let's Encrypt certificates are issued via **HTTP-01 challenge** — Let's Encrypt makes a request to your server to verify ownership. This only works for exact hostnames.

Wildcard certificates (`*.setu.yourdomain.com`) require **DNS-01 challenge** — Let's Encrypt asks you to create a specific `_acme-challenge` TXT record in your DNS zone. Traefik uses the Cloudflare API token to create and delete this TXT record automatically. After validation, a single certificate covers every tunnel subdomain.

---

## Admin Panel (AdminJS)

Setu features a built-in admin dashboard using [AdminJS](https://github.com/SoftwareBrothers/adminjs) to manage database models directly.

### Accessing the Panel
The admin panel is securely reverse-proxied by the gateway and is accessible at:
`https://<your-public-domain>/admin-panel` (or `http://localhost:3000/admin-panel` when running locally).

### Configuration
Access to the admin panel is protected by Basic Authentication. You can customize the credentials using the following environment variables:

- `ADMIN_EMAIL`: The admin user login email address (defaults to `admin@setu.com`).
- `ADMIN_PASSWORD`: The admin user login password (defaults to `adminpassword123`).
- `ADMIN_COOKIE_PASSWORD`: Secret encryption key used to sign session cookies (defaults to `sessionsecretcookiekey1234567890`, must be at least 32 characters long).

---

## Building from Source

```bash
git clone https://github.com/pranavwaikar/setu.git
cd setu
make build
./setu version
```

---

## Release Process

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

## Uninstalling

If you need to uninstall Setu CLI, run the following commands:

### Linux / macOS
```bash
# Remove the binary
sudo rm -f /usr/local/bin/setu

# Remove local configuration & databases
rm -rf ~/.setu
```

### Windows (PowerShell)
```powershell
# Remove the binary and install folder
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\setu"

# Remove local configuration & databases
Remove-Item -Recurse -Force "$env:USERPROFILE\.setu"
```

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). See the [LICENSE](LICENSE) file for details.

© Pranav Waikar
