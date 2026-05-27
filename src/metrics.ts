import { Database } from "bun:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DATA_DIR = join(homedir(), ".local", "share", "dev-dashboard");
const DB_PATH = join(DATA_DIR, "metrics.db");
const SAMPLE_INTERVAL_MS = 10_000;
const RETENTION_SECONDS = 86_400; // 24 hours

mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode=WAL");
db.run(`CREATE TABLE IF NOT EXISTS metrics (
  ts INTEGER PRIMARY KEY,
  cpu_pct REAL,
  mem_used_mb INTEGER,
  mem_total_mb INTEGER
)`);

const insertStmt = db.prepare(
  "INSERT OR IGNORE INTO metrics (ts, cpu_pct, mem_used_mb, mem_total_mb) VALUES (?, ?, ?, ?)"
);
const pruneStmt = db.prepare("DELETE FROM metrics WHERE ts < ?");
const queryStmt = db.prepare(
  "SELECT ts, cpu_pct, mem_used_mb, mem_total_mb FROM metrics WHERE ts >= ? ORDER BY ts ASC"
);

interface CpuSnapshot {
  idle: number;
  total: number;
}

function readCpuSnapshot(): CpuSnapshot {
  const stat = readFileSync("/proc/stat", "utf-8");
  const line = stat.split("\n")[0]; // "cpu  user nice system idle ..."
  const parts = line.split(/\s+/).slice(1).map(Number);
  const idle = parts[3] + (parts[4] || 0); // idle + iowait
  const total = parts.reduce((a, b) => a + b, 0);
  return { idle, total };
}

function readMemInfo(): { usedMb: number; totalMb: number } {
  const meminfo = readFileSync("/proc/meminfo", "utf-8");
  let totalKb = 0;
  let availableKb = 0;
  for (const line of meminfo.split("\n")) {
    if (line.startsWith("MemTotal:")) {
      totalKb = parseInt(line.split(/\s+/)[1], 10);
    } else if (line.startsWith("MemAvailable:")) {
      availableKb = parseInt(line.split(/\s+/)[1], 10);
    }
  }
  return {
    totalMb: Math.round(totalKb / 1024),
    usedMb: Math.round((totalKb - availableKb) / 1024),
  };
}

let prevCpu: CpuSnapshot = readCpuSnapshot();
let insertCount = 0;

function sample() {
  const cpu = readCpuSnapshot();
  const dIdle = cpu.idle - prevCpu.idle;
  const dTotal = cpu.total - prevCpu.total;
  const cpuPct = dTotal === 0 ? 0 : Math.round((1 - dIdle / dTotal) * 1000) / 10;
  prevCpu = cpu;

  const mem = readMemInfo();
  const ts = Math.floor(Date.now() / 1000);

  insertStmt.run(ts, cpuPct, mem.usedMb, mem.totalMb);

  insertCount++;
  if (insertCount % 100 === 0) {
    pruneStmt.run(ts - RETENTION_SECONDS);
  }
}

export function startCollector() {
  // Discard first delta (no baseline)
  setTimeout(() => {
    sample();
    setInterval(sample, SAMPLE_INTERVAL_MS);
  }, SAMPLE_INTERVAL_MS);
}

export interface MetricRow {
  ts: number;
  cpu_pct: number;
  mem_used_mb: number;
  mem_total_mb: number;
}

export function getMetrics(sinceMinutes: number): MetricRow[] {
  const cutoff = Math.floor(Date.now() / 1000) - sinceMinutes * 60;
  return queryStmt.all(cutoff) as MetricRow[];
}

export function getCurrentMetrics(): { cpuPct: number; memUsedMb: number; memTotalMb: number } {
  const mem = readMemInfo();
  const cpu = readCpuSnapshot();
  const dIdle = cpu.idle - prevCpu.idle;
  const dTotal = cpu.total - prevCpu.total;
  const cpuPct = dTotal === 0 ? 0 : Math.round((1 - dIdle / dTotal) * 1000) / 10;
  return { cpuPct, memUsedMb: mem.usedMb, memTotalMb: mem.totalMb };
}
