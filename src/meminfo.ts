import * as fs from "fs";
import { execSync } from "child_process";

export interface MemStats {
  ramTotal: number;
  ramUsed: number;
  ramPercent: number;
  swapTotal: number;
  swapUsed: number;
  swapPercent: number;
}

function parseMeminfo(): Record<string, number> {
  const raw = fs.readFileSync("/proc/meminfo", "utf8");
  const result: Record<string, number> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^(\w+):\s+(\d+)/);
    if (m) {
      result[m[1]] = parseInt(m[2], 10) * 1024; // convert kB → bytes
    }
  }
  return result;
}

function parseDarwinMemory(): MemStats {
  // macOS fallback using vm_stat + sysctl
  const pageSize = parseInt(execSync("sysctl -n hw.pagesize").toString().trim(), 10);
  const vmStat = execSync("vm_stat").toString();
  const get = (key: string): number => {
    const m = vmStat.match(new RegExp(`${key}:\\s+(\\d+)`));
    return m ? parseInt(m[1], 10) * pageSize : 0;
  };
  const total = parseInt(execSync("sysctl -n hw.memsize").toString().trim(), 10);
  const free = get("Pages free") + get("Pages inactive");
  const used = total - free;

  const swapRaw = execSync("sysctl -n vm.swapusage").toString().trim();
  const swapMatch = swapRaw.match(/used\s+=\s+([\d.]+)M.*total\s+=\s+([\d.]+)M/);
  const swapUsed = swapMatch ? parseFloat(swapMatch[1]) * 1024 * 1024 : 0;
  const swapTotal = swapMatch ? parseFloat(swapMatch[2]) * 1024 * 1024 : 0;

  return {
    ramTotal: total,
    ramUsed: used,
    ramPercent: Math.round((used / total) * 100),
    swapTotal,
    swapUsed,
    swapPercent: swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0,
  };
}

export function getMemStats(): MemStats {
  if (process.platform === "darwin") {
    return parseDarwinMemory();
  }

  // Linux
  const m = parseMeminfo();
  const ramTotal = m["MemTotal"] ?? 0;
  const ramAvailable = m["MemAvailable"] ?? 0;
  const ramUsed = ramTotal - ramAvailable;
  const swapTotal = m["SwapTotal"] ?? 0;
  const swapFree = m["SwapFree"] ?? 0;
  const swapUsed = swapTotal - swapFree;

  return {
    ramTotal,
    ramUsed,
    ramPercent: ramTotal > 0 ? Math.round((ramUsed / ramTotal) * 100) : 0,
    swapTotal,
    swapUsed,
    swapPercent: swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}
