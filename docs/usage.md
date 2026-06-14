# Setu Tunnel Platform - Usage Guide

Setu is a self-hosted, multi-tenant developer tunneling platform that allows you to expose local services to the public internet using custom subdomains.

---

## Getting Started

### Prerequisites
To run Setu locally, make sure you have the following installed:
- **Node.js** (v20.16.0 or higher)
- **Go** (1.20 or higher)
- **npm** (v10 or higher)

---

## Local Development Setup

To run all components locally on your machine, follow these steps:

### 1. Database & NestJS API
1. Navigate to the `api` folder and install dependencies:
   ```bash
   cd api
   npm install
   ```
2. Generate the Prisma database client:
   ```bash
   npx prisma generate
   ```
3. Initialize the SQLite database and push the schema:
   ```bash
   npx prisma db push
   ```
4. Start the API server:
   ```bash
   npm run start
   ```
   *The API will run on `http://127.0.0.1:4000`.*

### 2. Next.js Dashboard
1. Navigate to the `dashboard` folder and install dependencies:
   ```bash
   cd dashboard
   npm install
   ```
2. Build the project (or run in development mode):
   ```bash
   npm run build
   # Or run in dev mode:
   npm run dev
   ```
3. Start the dashboard:
   ```bash
   npm run start
   ```
   *The Dashboard will run on `http://127.0.0.1:3000`.*

### 3. Go Gateway
1. Navigate to the `gateway` folder:
   ```bash
   cd gateway
   ```
2. Build the gateway binary:
   ```bash
   go build -o setu-gateway
   ```
3. Start the gateway server with configuration environment variables:
   ```bash
   API_SERVER_URL=http://127.0.0.1:4000 \
   GATEWAY_API_TOKEN=default-gateway-secret \
   TUNNEL_DOMAIN=lvh.me \
   PORT=8080 \
   ./setu-gateway
   ```
   *The Gateway routes public requests on port `8080`.*

---

## Local Setup via Docker Compose

If you have Docker installed and running, you can spin up the entire Setu stack (PostgreSQL, NestJS API, Next.js Dashboard, and Go Gateway) with a single command:

1. Start the stack from the root directory:
   ```bash
   docker compose up --build -d
   ```
2. The containers will start up in the following order:
   - **`setu_postgres`**: Launches PostgreSQL database on port `5432`.
   - **`setu_api`**: Runs database migrations (`npx prisma db push`) and starts the NestJS API server on `http://127.0.0.1:4000`.
   - **`setu_dashboard`**: Starts the Next.js dashboard on `http://127.0.0.1:3000`.
   - **`setu_gateway`**: Starts the Go tunnel gateway on `http://127.0.0.1:8080`.
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

### 4. Extra CLI Commands
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

In a production environment (such as on a Coolify server or virtual machine), you can run the entire platform orchestrating PostgreSQL and other services using Docker Compose:

1. Edit env variables inside `docker-compose.yml` to specify your public root domain (e.g., `TUNNEL_DOMAIN=yourdomain.com`).
2. Run the compose stack:
   ```bash
   docker compose up --build -d
   ```
3. Configure your DNS provider to add a wildcard `A` record pointing to your server's IP address:
   ```text
   *.yourdomain.com  ->  YOUR_SERVER_IP
   ```
