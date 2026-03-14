import * as vscode from "vscode";
import { getMemStats, formatBytes, MemStats } from "./meminfo";

// 8-step block characters for sub-character precision
const BLOCKS = " ▏▎▍▌▋▊▉█";

function makeBar(percent: number, length: number): string {
  const filled = (percent / 100) * length;
  const full = Math.floor(filled);
  const partial = Math.floor((filled - full) * (BLOCKS.length - 1));
  const empty = length - full - (partial > 0 ? 1 : 0);

  return (
    "█".repeat(full) +
    (partial > 0 ? BLOCKS[partial] : "") +
    "░".repeat(Math.max(0, empty))
  );
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

function buildLabel(stats: MemStats, barLength: number, showSwap: boolean): string {
  const ramBar = makeBar(stats.ramPercent, barLength);
  let label = `$(server) ${ramBar} ${stats.ramPercent}%`;

  if (showSwap && stats.swapTotal > 0) {
    const swapBar = makeBar(stats.swapPercent, barLength);
    label += `  $(arrow-swap) ${swapBar} ${stats.swapPercent}%`;
  } else if (showSwap && stats.swapTotal === 0) {
    label += `  $(arrow-swap) —`;
  }

  return label;
}

function buildTooltip(stats: MemStats): vscode.MarkdownString {
  const md = new vscode.MarkdownString("", true);
  md.isTrusted = true;
  md.supportThemeIcons = true;

  const ramBar = makeBar(stats.ramPercent, 20);
  const swapBar = makeBar(stats.swapPercent, 20);

  md.appendMarkdown(`### $(server) RAM\n`);
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

  md.appendMarkdown(`---\n\n`);
  md.appendMarkdown(
    `*Click to refresh — auto-refreshes every few seconds*\n\n`
  );
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

  function readConfig() {
    const cfg = vscode.workspace.getConfiguration("memoryUsage");
    return {
      interval: cfg.get<number>("refreshInterval", 3) * 1000,
      showSwap: cfg.get<boolean>("showSwap", true),
      barLength: cfg.get<number>("barLength", 8),
      warnThreshold: cfg.get<number>("warnThreshold", 70),
      criticalThreshold: cfg.get<number>("criticalThreshold", 90),
    };
  }

  let cfg = readConfig();

  function update() {
    try {
      const stats = getMemStats();
      statusBar.text = buildLabel(stats, cfg.barLength, cfg.showSwap);
      statusBar.tooltip = buildTooltip(stats);
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
