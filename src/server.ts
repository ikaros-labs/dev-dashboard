import { join } from "node:path";
import { startCollector, getMetrics, getCurrentMetrics } from "./metrics";
import { getDemoSites, getServices } from "./discovery";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = parseInt(process.env.PORT || "3100", 10);
const PUBLIC_DIR = join(import.meta.dir, "public");

startCollector();

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}

function serveStatic(path: string, contentType: string): Response | null {
  const file = Bun.file(join(PUBLIC_DIR, path));
  if (!file.size) return null;
  return new Response(file, { headers: { "Content-Type": contentType } });
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return serveStatic("index.html", "text/html") ?? new Response("Not found", { status: 404 });
    }
    if (url.pathname === "/style.css") {
      return serveStatic("style.css", "text/css") ?? new Response("Not found", { status: 404 });
    }
    if (url.pathname === "/app.js") {
      return (
        serveStatic("app.js", "application/javascript") ??
        new Response("Not found", { status: 404 })
      );
    }

    if (url.pathname === "/api/metrics") {
      const minutes = Math.min(
        Math.max(parseInt(url.searchParams.get("minutes") || "60", 10), 1),
        1440
      );
      return json(getMetrics(minutes));
    }

    if (url.pathname === "/api/system") {
      return json(getCurrentMetrics());
    }

    if (url.pathname === "/api/services") {
      return json(getServices());
    }

    if (url.pathname === "/api/demos") {
      return json(getDemoSites());
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Dashboard listening on ${server.hostname}:${server.port}`);
