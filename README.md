<div align="center">

<img src="./dashboard/public/setu-logo.png" alt="Setu Logo" width="100" height="100" style="border-radius: 24px; margin-bottom: 20px;" />

# ⚡ Setu

**Expose your local servers to the public internet — securely and instantly.**

[![Release](https://img.shields.io/github/v/release/pranavwaikar/setu?style=flat-square)](https://github.com/pranavwaikar/setu/releases/latest)
[![Go Version](https://img.shields.io/badge/go-1.24%2B-blue?style=flat-square)](https://go.dev/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

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

## License

MIT © Pranav Waikar
