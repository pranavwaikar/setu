# Setu - Multi-Tenant Developer Tunnel Platform

Setu is a self-hosted, multi-tenant developer tunneling platform that lets you expose local development servers (e.g. `127.0.0.1:3000`) to the public internet using custom subdomains (e.g. `http://app.lvh.me:8080`).

---

## Codebase Structure

- [api/](file:///Users/pranavwaikar/Documents/GitHub/setu/api/): NestJS backend server providing user session management, subdomain claims, and CLI validation hooks.
- [dashboard/](file:///Users/pranavwaikar/Documents/GitHub/setu/dashboard/): Next.js web application workspace built with Tailwind CSS.
- [gateway/](file:///Users/pranavwaikar/Documents/GitHub/setu/gateway/): High-performance Go tunnel gateway managing Yamux WebSocket sessions.
- [cli/](file:///Users/pranavwaikar/Documents/GitHub/setu/cli/): Compiled Go binary client routing local port streams.

---

## Documentation

For full details on configuring, running, and deploying Setu, please refer to the following documents inside the `docs/` directory:

1. 📖 **[Usage & Development Guide](file:///Users/pranavwaikar/Documents/GitHub/setu/docs/usage.md)**: Steps to install prerequisites, spin up services locally, and use the compiled CLI commands.
2. 📐 **[Technical Specification](file:///Users/pranavwaikar/Documents/GitHub/setu/docs/technical_spec.md)**: Architectural blueprints, database schemas, and multiplexing protocol designs.

