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
| **DNS** | Wildcard `A` record | `*.yourdomain.com` → your server IP (required for tunnel subdomains) |

> [!IMPORTANT]
> **Traefik v3 is required.** The wildcard subdomain routing uses `HostRegexp` which changed syntax between Traefik v2 and v3. Coolify 4.x ships with Traefik v3 automatically — if you are on Coolify 3.x (which used Traefik v2), you must upgrade to Coolify 4.x before deploying Setu.

> [!WARNING]
> **Wildcard DNS is mandatory.** Without a `*.yourdomain.com` A record pointing to your server, tunnel subdomains (e.g. `my-app.yourdomain.com`) will not resolve — the public URL shown by the CLI will be unreachable regardless of gateway configuration.

### Deployment Steps

1. **Install Coolify** (≥ 4.1.2) on your VPS:
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```

2. **Add a wildcard DNS record** in your DNS provider:
   ```
   Type: A
   Name: *.yourdomain.com
   Value: <your-server-IP>
   TTL: 300
   ```

3. **Set the environment variables** in your Coolify service before deploying:

   | Variable | Example Value | Description |
   |---|---|---|
   | `PUBLIC_DOMAIN` | `https://setu.yourdomain.com` | Public URL of your Setu instance |
   | `TUNNEL_DOMAIN` | `setu.yourdomain.com` | Base domain used to derive tunnel subdomains |
   | `GATEWAY_API_TOKEN` | `your-secret-token` | Shared secret between gateway and API |
   | `JWT_SECRET` | `your-jwt-secret` | Secret for signing user JWTs |

4. **Deploy** by pointing Coolify at this repository and selecting `docker-compose.yml`. Coolify merges the Traefik wildcard routing labels from the compose file with its own auto-generated labels automatically.

5. **Verify** the gateway is reachable:
   ```bash
   curl https://setu.yourdomain.com/health
   # Expected: {"status":"ok"}
   ```

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
