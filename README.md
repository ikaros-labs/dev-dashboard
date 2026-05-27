# dev-dashboard

Lightweight dev environment dashboard built with [Bun](https://bun.sh).

- **System metrics** — CPU and RAM usage with time-series charts (24h retention)
- **Service links** — quick access to code-server, terminal, agents orchestrator
- **Active demos** — live list of demo sites exposed via [expose-dev-server](https://github.com/ikaros-labs/expose-dev-server)

Zero runtime dependencies. Reads `/proc` directly, stores metrics in SQLite
via `bun:sqlite`, renders charts on `<canvas>` with vanilla JS.

## Quick start

```bash
bun install
bun run dev
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Bind address |
| `PORT` | `3100` | Listen port |
| `DOMAIN` | `localhost` | Base domain for service URLs |
| `DEMO_SITES_DIR` | `/etc/caddy/demo-sites.d` | Demo site config directory |

## Deployment

Deployed via the `dev_dashboard` Ansible role in
[ikaros-labs/dev-env](https://github.com/ikaros-labs/dev-env). See
[CLAUDE.md](CLAUDE.md) for architecture details.

## License

MIT
