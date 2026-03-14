import * as vscode from "vscode";
import { getMemStats, getTopProcesses, formatBytes, MemStats } from "./meminfo";

// Sparkline characters (8 levels, low → high)
const SPARK = "▁▂▃▄▅▆▇█";

const SPARKLINE_MAX_SAMPLES = 20;
const SPARKLINE_DISPLAY = 10;

function makeBar(percent: number, length: number): string {
  const full = Math.round((percent / 100) * length);
  return "█".repeat(full) + "░".repeat(length - full);
}

function getColor(
  percent: number,
  warnThreshold: number,
  criticalThreshold: number
): vscode.ThemeColor {
  if (percent >= criticalThreshold) {
    return new vscode.ThemeColor("statusBarItem.errorBackground");
  }
  if (percent >= warnThreshold) {
    return new vscode.ThemeColor("statusBarItem.warningBackground");
  }
  return new vscode.ThemeColor("statusBar.background");
}

function makeSparkline(history: number[]): string {
  const samples = history.slice(-SPARKLINE_DISPLAY);
  return samples.map(p => SPARK[Math.round((p / 100) * (SPARK.length - 1))]).join("");
}

function buildLabel(stats: MemStats, barLength: number, showSwap: boolean, showSparkline: boolean, history: number[]): string {
  const ramBar = makeBar(stats.ramPercent, barLength);
  const spark = showSparkline && history.length > 1 ? makeSparkline(history) + " " : "";
  let label = `$(server) ${spark}${ramBar} ${stats.ramPercent}%`;

  if (showSwap && stats.swapTotal > 0) {
    const swapBar = makeBar(stats.swapPercent, barLength);
    label += `  $(arrow-swap) ${swapBar} ${stats.swapPercent}%`;
  } else if (showSwap && stats.swapTotal === 0) {
    label += `  $(arrow-swap) —`;
  }

  return label;
}

function buildTooltip(stats: MemStats, history: number[]): vscode.MarkdownString {
  const md = new vscode.MarkdownString("", true);
  md.isTrusted = true;
  md.supportThemeIcons = true;

  const ramBar = makeBar(stats.ramPercent, 20);
  const swapBar = makeBar(stats.swapPercent, 20);

  md.appendMarkdown(`### $(server) RAM\n`);
  if (history.length > 1) {
    const spark = history.map(p => SPARK[Math.round((p / 100) * (SPARK.length - 1))]).join("");
    md.appendMarkdown(`\`${spark}\`\n\n`);
  }
  md.appendMarkdown(`\`${ramBar}\` **${stats.ramPercent}%**\n\n`);
  md.appendMarkdown(
    `Used: **${formatBytes(stats.ramUsed)}** / ${formatBytes(stats.ramTotal)}\n\n`
  );
  md.appendMarkdown(`Free: ${formatBytes(stats.ramTotal - stats.ramUsed)}\n\n`);

  md.appendMarkdown(`---\n\n`);

  md.appendMarkdown(`### $(arrow-swap) SWAP\n`);
  if (stats.swapTotal > 0) {
    md.appendMarkdown(`\`${swapBar}\` **${stats.swapPercent}%**\n\n`);
    md.appendMarkdown(
      `Used: **${formatBytes(stats.swapUsed)}** / ${formatBytes(stats.swapTotal)}\n\n`
    );
    md.appendMarkdown(`Free: ${formatBytes(stats.swapTotal - stats.swapUsed)}\n\n`);
  } else {
    md.appendMarkdown(`*No swap configured*\n\n`);
  }

  const procs = getTopProcesses(5);
  if (procs.length > 0) {
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`### $(list-ordered) Top processes by RAM\n\n`);
    md.appendMarkdown(`| Process | PID | RSS |\n`);
    md.appendMarkdown(`|---|---|---|\n`);
    for (const p of procs) {
      md.appendMarkdown(`| \`${p.name}\` | ${p.pid} | ${formatBytes(p.rss)} |\n`);
    }
    md.appendMarkdown(`\n`);
  }

  md.appendMarkdown(`---\n\n`);
  md.appendMarkdown(`*Click to refresh — auto-refreshes every few seconds*\n\n`);
  md.appendMarkdown(`[$(refresh) Refresh now](command:memoryUsage.refresh)`);

  return md;
}

export function activate(context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    99
  );
  statusBar.command = "memoryUsage.refresh";
  statusBar.name = "Memory Usage";

  let timer: ReturnType<typeof setInterval> | undefined;
  const history: number[] = [];

  function readConfig() {
    const cfg = vscode.workspace.getConfiguration("memoryUsage");
    return {
      interval: cfg.get<number>("refreshInterval", 3) * 1000,
      showSwap: cfg.get<boolean>("showSwap", true),
      showSparkline: cfg.get<boolean>("showSparkline", true),
      barLength: cfg.get<number>("barLength", 8),
      warnThreshold: cfg.get<number>("warnThreshold", 70),
      criticalThreshold: cfg.get<number>("criticalThreshold", 90),
    };
  }

  let cfg = readConfig();

  function update() {
    try {
      const stats = getMemStats();
      history.push(stats.ramPercent);
      if (history.length > SPARKLINE_MAX_SAMPLES) history.shift();
      statusBar.text = buildLabel(stats, cfg.barLength, cfg.showSwap, cfg.showSparkline, history);
      statusBar.tooltip = buildTooltip(stats, history);
      statusBar.backgroundColor = getColor(
        stats.ramPercent,
        cfg.warnThreshold,
        cfg.criticalThreshold
      );
      statusBar.show();
    } catch (err) {
      statusBar.text = "$(error) Memory: unavailable";
      statusBar.tooltip = String(err);
      statusBar.show();
    }
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(update, cfg.interval);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("memoryUsage.refresh", () => {
      update();
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("memoryUsage")) {
        cfg = readConfig();
        startTimer();
        update();
      }
    }),

    statusBar,

    { dispose: () => { if (timer) clearInterval(timer); } }
  );

  update();
  startTimer();
}

export function deactivate() {}
