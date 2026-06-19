# Setu Tunnel Platform - Usage Guide

Setu is a self-hosted, multi-tenant developer tunneling platform that allows you to expose local services to the public internet using custom subdomains.

---

## Getting Started

To run the entire Setu platform locally, make sure you have **Docker** and **Docker Compose** installed. You can spin up the full stack (PostgreSQL, NestJS API, Next.js Dashboard, and Go Gateway) with a single command:

1. Start the stack from the root directory:
   ```bash
   docker compose up --build -d
   ```
2. The containers will start up in the following order:
   - **`setu_postgres`**: Launches PostgreSQL database on port `5432` (internally mapped, bound locally to `127.0.0.1:15432`).
   - **`setu_api`**: Runs database migrations and starts the NestJS API server on `http://127.0.0.1:4000` (internal: `http://api:4000`).
   - **`setu_dashboard`**: Starts the Next.js dashboard on `http://127.0.0.1:3000` (internal: `http://dashboard:3000`).
   - **`setu_gateway`**: Starts the Go tunnel gateway on `http://127.0.0.1:8080` (internal: `http://gateway:8080`).
3. Check container health status:
   ```bash
   docker compose ps
   ```
   Each service configures container-level healthchecks mapping connection probes.

---

## Working with the Tunnel CLI

### 1. Compiling the CLI
Navigate to the `cli` folder and compile the binary:
```bash
cd cli
go build -o setu
```

### 2. Authentication
Before starting a tunnel, obtain an **API Key** from the dashboard (running at `http://127.0.0.1:3000`), then log in on your machine:
```bash
./setu login --gateway 127.0.0.1:8080
```
Paste your API key when prompted. Your credentials will be stored securely at `~/.setu/config.json`.

### 3. Expose a Local Server
Claim a subdomain of your choice in the dashboard (e.g., `my-app`). Run any server locally (e.g. on port `3000`) and establish the tunnel:
```bash
./setu expose 3000 --subdomain my-app
```

#### Advanced Expose Options

- **Host Header Overrides**: To solve "Invalid Host Header" issues with tools like Vite or Webpack:
  ```bash
  # Rewrite the Host header to match the destination target (e.g., localhost:3000)
  ./setu expose 3000 --subdomain my-app --host-header rewrite

  # Or override it to a specific value
  ./setu expose 3000 --subdomain my-app --host-header custom-host:3000
  ```

  ./setu expose https://localhost:3000 --subdomain my-app --insecure-skip-verify
  ```

  ./setu expose 3000 --subdomain my-app --auth "user:password"
  ```

- **Layer-4 Raw TCP Tunneling**: To tunnel raw TCP protocols like databases (Postgres/MySQL) or SSH, specify the `--tcp` flag:
  ```bash
  ./setu expose 5432 --subdomain my-db --tcp
  ```
  The Gateway dynamically opens a public port (e.g. `setu.helios-logic.com:32145`) and streams data directly to your local port.
Once connected, you will see a success status:
```text
 ⚡ SETU TUNNEL ONLINE
 --------------------------------------------------
 Status:     ONLINE
 Forwarding: http://my-app.lvh.me:8080 -> 127.0.0.1:3000
 --------------------------------------------------
 Press Ctrl+C to stop tunnel connection
```

You can now open `http://my-app.lvh.me:8080` in your web browser, and all traffic will proxy through the Gateway directly to your local port `3000`.

### 4. Local Request & Response Inspector
When active tunnels are running, a background HTTP inspection server is launched locally (defaulting to port `4500`). Open your browser to:
👉 `http://localhost:4500/inspect`

You will see a real-time web dashboard displaying the methods, paths, request headers, cookies, payloads, and response status codes/bodies for all streams passing through the active tunnel.

It also includes a **1-Click Webhook Replay** utility. With a single click on any recorded transaction, the local server clones and re-dispatches the request payload directly to your local application port, making it easy to replay Stripe, GitHub, or custom webhooks without triggering external systems manually.

### 5. Extra CLI Commands
- **Check config status**:
  ```bash
  ./setu status
  ```
- **Clear credentials / Logout**:
  ```bash
  ./setu logout
  ```

---

## Production Deployment via Docker Compose

In a production environment (such as on a Coolify server or virtual machine), you can run the entire platform orchestrating PostgreSQL and other services using Docker Compose.

We have made it easy to configure your custom domain using environment variables. The configuration is driven by two main environment variables:
- `TUNNEL_DOMAIN`: The base domain used to derive tunnel subdomains (e.g., `setu.yourdomain.com`).
- `PUBLIC_DOMAIN`: The full public URL of your Setu instance (e.g., `https://setu.yourdomain.com`).

### Configuration & Deployment Steps

1. **Set up Environment Variables**: Create a `.env` file in the root directory (based on the [.env.example](file:///Users/pranavwaikar/Documents/GitHub/setu/.env.example) template). 
   
   **Required variables**:
   ```env
   TUNNEL_DOMAIN=setu.helios-logic.com
   PUBLIC_DOMAIN=https://setu.helios-logic.com
   GATEWAY_API_TOKEN=default-gateway-secret
   JWT_SECRET=supersecretjwtkey
   NODE_ENV=production
   ```

   **Optional / Automatic variables** (handled automatically by `docker-compose.yml` but can be overridden):
   ```env
   # DATABASE_URL=postgresql://postgres:password@postgres:5432/setu?schema=public
   # INTERNAL_API_URL=http://api:4000
   ```

   > [!IMPORTANT]
   > **Build-Time Arguments**: The Next.js dashboard compiles these domain variables into the client-side JavaScript bundle during the image build process. They are passed as build arguments in `docker-compose.yml` (`NEXT_PUBLIC_TUNNEL_DOMAIN` and `NEXT_PUBLIC_PUBLIC_DOMAIN`). Therefore, you **must set these environment variables before building**. If you change these variables later, you must run a full rebuild (`docker compose build --no-cache dashboard` or `docker compose up --build -d`) to update the static frontend assets.

2. **Deploy the stack**:
   * **If using raw Docker Compose**: Run the following command:
     ```bash
     docker compose up --build -d
     ```
    * **If using Coolify**: Point Coolify to this repository, select `docker-compose.yml`, and configure the service domains:
      * **`gateway`**: Configure the public domain/URL (e.g., `https://setu.yourdomain.com`).
      * **`dashboard`**: **Keep the domain field empty**.
      * **`api`**: **Keep the domain field empty**.
      
      > [!IMPORTANT]
      > The gateway acts as the public entrypoint and handles proxying `/` requests to the dashboard and `/api/*` requests to the api service. Do not assign public domains to the dashboard or api services in Coolify.
      > 
      > **Wildcard Routing Setup (Coolify Traefik Dynamic Config)**:
      > Because Coolify's compose parser does not interpolate environment variables in `labels`, you must configure wildcard subdomain routing directly in Coolify's Traefik Proxy configuration editor:
      > 1. Go to **Servers** -> **[Your Server]** -> **Proxy** tab.
      > 2. Open the **Configuration** editor (YAML format).
      > 3. Under the `http:` section, add the following configuration (replace `setu.yourdomain.com` with your actual domain):
      >    ```yaml
      >    http:
      >      routers:
      >        setu-tunnel-https:
      >          rule: "HostRegexp(`^[a-z0-9-]+[.]setu.yourdomain.com$`)"
      >          entryPoints:
      >            - https
      >          service: setu-tunnel-svc
      >          tls:
      >            certResolver: letsencrypt-dns
      >            domains:
      >              - main: setu.yourdomain.com
      >                sans:
      >                  - "*.setu.yourdomain.com"
      >        setu-tunnel-http:
      >          rule: "HostRegexp(`^[a-z0-9-]+[.]setu.yourdomain.com$`)"
      >          entryPoints:
      >            - http
      >          middlewares:
      >            - redirect-to-https
      >          service: setu-tunnel-svc
      >      services:
      >        setu-tunnel-svc:
      >          loadBalancer:
      >            servers:
      >              - url: "http://setu_gateway:8080"
      >    ```

3. **Configure DNS records**:
   Configure your DNS provider to add two A records pointing to your server's IP address:
   
   | Type | Name | Value | Proxy status |
   |---|---|---|---|
   | A | `yourdomain.com` | `<your-server-IP>` | DNS only (grey cloud) |
   | A | `*` | `<your-server-IP>` | DNS only (grey cloud) |
   
   The `*` wildcard record is required so that any tunnel subdomain (e.g., `my-app.setu.yourdomain.com`) resolves to your gateway.
