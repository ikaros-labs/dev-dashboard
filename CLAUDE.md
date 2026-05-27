# CLAUDE.md — Dev Dashboard

This file is the authoritative reference for any agent (or human) working in
this repository.  **Read it before making changes.**

---

## What this is

A lightweight dashboard for the dev environment, deployed via the
`dev_dashboard` Ansible role in [ikaros-labs/dev-env](https://github.com/ikaros-labs/dev-env).
Shows system metrics (CPU/RAM), links to services, and active demo sites.

## Architecture

```
Bun.serve()  (src/server.ts)
  ├── GET /              → static HTML dashboard (src/public/)
  ├── GET /api/metrics   → CPU/RAM time-series from SQLite
  ├── GET /api/system    → current CPU/RAM point-in-time reading
  ├── GET /api/services  → static service links (derived from DOMAIN env var)
  └── GET /api/demos     → parsed from /etc/caddy/demo-sites.d/*.caddy
```

**Metrics collection** (`src/metrics.ts`): reads `/proc/stat` and
`/proc/meminfo` every 10 seconds, computes CPU % from deltas, stores rows in
SQLite at `~/.local/share/dev-dashboard/metrics.db`.  Retains 24 hours.

**Demo discovery** (`src/discovery.ts`): reads `.caddy` files from the
demo-sites directory.  These files are created by the `dev-register` CLI
(from [expose-dev-server](https://github.com/ikaros-labs/expose-dev-server))
and follow this format:

```caddy
@appname host appname.demo.example.dev
handle @appname {
    reverse_proxy 127.0.0.1:PORT
}
```

**Frontend** (`src/public/`): vanilla JS with hand-drawn canvas charts.
No build step, no framework, no vendored libraries.

## Runtime

- **Bun** is the only runtime dependency (`bun:sqlite` for storage,
  `Bun.serve()` for HTTP, `Bun.file()` for static files).
- Zero npm runtime dependencies — only dev dependencies for types and
  type-checking.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Bind address |
| `PORT` | `3100` | Listen port |
| `DOMAIN` | `localhost` | Base domain for service link URLs |
| `DEMO_SITES_DIR` | `/etc/caddy/demo-sites.d` | Directory to scan for demo site `.caddy` files |

These are set by the Ansible role's `.env` template at deploy time.

## Development

```bash
bun install
bun run dev          # starts with --watch for auto-reload
```

The app reads `/proc/stat` and `/proc/meminfo`, so it only works on Linux.
For local development on macOS, the metrics collector will fail gracefully
(no `/proc`), but the server, service links, and demo discovery still work
if you point `DEMO_SITES_DIR` at a local test directory.

## Conventions

- No runtime dependencies.  If you need something, check if Bun provides it
  natively first (`bun:sqlite`, `bun:test`, etc.).
- No build step.  Bun runs TypeScript directly.  The frontend is plain
  HTML/CSS/JS — no bundler, no framework.
- Keep the frontend self-contained.  No CDN imports (the server runs on a
  Tailscale-only network with no guaranteed internet access for clients).

## Deployment

Deployed by the `dev_dashboard` Ansible role in
[ikaros-labs/dev-env](https://github.com/ikaros-labs/dev-env).  The role
clones this repo, runs `bun install --frozen-lockfile`, and starts the app
via systemd.  Caddy reverse-proxies `dashboard.{domain}` to
`127.0.0.1:3100`.

Do not add deployment scripts or Docker configuration here — that belongs
in the IaC repo.
