import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEMO_SITES_DIR = process.env.DEMO_SITES_DIR || "/etc/caddy/demo-sites.d";
const DOMAIN = process.env.DOMAIN || "localhost";

export interface DemoSite {
  name: string;
  url: string;
  port: number;
}

let demoCache: { sites: DemoSite[]; expiry: number } = { sites: [], expiry: 0 };

export function getDemoSites(): DemoSite[] {
  const now = Date.now();
  if (now < demoCache.expiry) return demoCache.sites;

  const sites: DemoSite[] = [];
  let files: string[];
  try {
    files = readdirSync(DEMO_SITES_DIR).filter((f) => f.endsWith(".caddy"));
  } catch {
    demoCache = { sites: [], expiry: now + 2000 };
    return [];
  }

  for (const file of files) {
    try {
      const content = readFileSync(join(DEMO_SITES_DIR, file), "utf-8");
      // Format: @name host name.demo.domain
      //         handle @name { reverse_proxy 127.0.0.1:PORT }
      const hostMatch = content.match(/@(\S+)\s+host\s+(\S+)/);
      const portMatch = content.match(/reverse_proxy\s+\S+:(\d+)/);
      if (hostMatch && portMatch) {
        sites.push({
          name: hostMatch[1],
          url: `https://${hostMatch[2]}`,
          port: parseInt(portMatch[1], 10),
        });
      }
    } catch {
      // skip unreadable files
    }
  }

  demoCache = { sites, expiry: now + 2000 };
  return sites;
}

export interface ServiceLink {
  name: string;
  url: string;
  icon: string;
}

export function getServices(): ServiceLink[] {
  return [
    { name: "Agents", url: `https://agents.${DOMAIN}`, icon: "bot" },
    { name: "Code Server", url: `https://code.${DOMAIN}`, icon: "code" },
    { name: "Terminal", url: `https://terminal.${DOMAIN}`, icon: "terminal" },
  ];
}
