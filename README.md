# Performance Appraisal App

LAN-only full-stack monorepo: Hono + Prisma + MySQL server, Electron desktop clients, and a shared types package.

## Architecture

- **Server** (`packages/server`) — Hono API bound to `0.0.0.0`, MySQL via Prisma. Runs on one machine on your LAN.
- **Desktop** (`packages/desktop`) — Electron app (electron-vite + React). Multiple clients on other LAN machines connect over HTTP.
- **Shared** (`packages/shared`) — TypeScript types and Zod schemas used by both sides.

Auth is a shared bearer token (`AUTH_TOKEN`). No public internet exposure or OAuth.

## Prerequisites

- Node.js 20+ and npm 10+
- MySQL 8+ running locally (or on the server machine)

## 1. Install dependencies

From the repo root:

```bash
npm install
```

## 2. Configure MySQL

Create a database (example):

```sql
CREATE DATABASE perf_appraisal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'perf'@'%' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON perf_appraisal.* TO 'perf'@'%';
FLUSH PRIVILEGES;
```

Copy the server env file and edit credentials:

```bash
cp packages/server/.env.example packages/server/.env
```

Set at least:

```env
DATABASE_URL="mysql://perf:password@localhost:3306/perf_appraisal"
PORT=3000
AUTH_TOKEN=changeme
```

Use a strong `AUTH_TOKEN` in real use — every Electron client must use the same token.

## 3. Prisma generate & migrate

```bash
npm run db:generate
npm run db:migrate
```

`db:migrate` runs `prisma migrate dev` and will prompt for a migration name on first run (e.g. `init`).

## 4. Start the server (LAN host machine)

```bash
npm run dev:server
```

The API listens on `0.0.0.0:3000` so other machines on the LAN can reach it.

- Public: `GET /health` → `{ "status": "ok" }` (no auth)
- Protected: `GET /users` — requires `Authorization: Bearer <AUTH_TOKEN>`

Find this machine’s LAN IP (Windows: `ipconfig`, macOS/Linux: `ip addr` / `ifconfig`), e.g. `192.168.1.50`.

## 5. Start the desktop client

```bash
npm run dev:desktop
```

In **Server Settings**, enter:

| Field | Example |
| --- | --- |
| Server URL | `http://192.168.1.50:3000` (or `http://localhost:3000` on the same machine) |
| Auth token | same value as `AUTH_TOKEN` in the server `.env` |

Save, then use **Check health** and **Load users** to verify the pipeline.

Server URL and token are persisted locally via `electron-store` — nothing is hardcoded.

## Pointing a second machine at the LAN server

1. Clone/copy this repo (or install a built desktop app) on the client machine.
2. Ensure the client can reach the server: `http://<server-lan-ip>:3000/health` in a browser should return JSON.
3. If blocked, allow inbound TCP port `3000` on the server firewall.
4. Run `npm run dev:desktop` (or the packaged app), open Server Settings, set `http://<server-lan-ip>:3000` and the shared auth token.

MySQL only needs to run on the server machine; desktop clients never connect to the database directly.

## Workspace scripts

| Script | Description |
| --- | --- |
| `npm run dev:server` | Hono API with hot reload |
| `npm run dev:desktop` | Electron app (dev + HMR) |
| `npm run build:shared` | Compile shared package |
| `npm run build:server` | Compile server |
| `npm run build:desktop` | Build Electron app |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate dev` |

## Packages

| Package | Name |
| --- | --- |
| Shared | `@perf-appraisal-app/shared` |
| Server | `@perf-appraisal-app/server` |
| Desktop | `@perf-appraisal-app/desktop` |
