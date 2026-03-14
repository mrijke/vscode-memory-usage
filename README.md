# Memory Usage

A VS Code extension that displays real-time RAM and SWAP memory usage in the status bar, with a sparkline history, block-character progress bar, and color-coded alerts.

## Features

- **Sparkline history** — a rolling 10-sample trend (`▁▂▃▄▅▆▇█`) preceding the RAM bar shows memory pressure at a glance
- **Live progress bar** using block characters (`█░`)
- **Color-coded alerts** — the status bar turns yellow when usage is high and red when critical
- **Rich tooltip** on hover with used/free/total, full 20-sample sparkline, and a table of the top 5 processes by RSS (Linux)
- **Click to refresh** manually at any time
- **Auto-refreshes** on a configurable interval (default: every 3 seconds)
- Supports **Linux** (`/proc/meminfo`) and **macOS** (`vm_stat` / `sysctl`)

## Status Bar

```
  ▁▂▂▃▄▅▅▆▆▇ █████░░░ 62%   ⇄ ██░░░░░░ 18%
```

The sparkline shows the last 10 samples. The first bar is RAM, the second is SWAP. Colors:

| Color | Meaning |
|---|---|
| Default | Usage below warn threshold (< 70%) |
| Yellow | Usage above warn threshold (≥ 70%) |
| Red | Usage above critical threshold (≥ 90%) |

## Configuration

| Setting | Default | Description |
|---|---|---|
| `memoryUsage.refreshInterval` | `3` | Seconds between auto-refreshes (1–60) |
| `memoryUsage.showSwap` | `true` | Show SWAP usage alongside RAM |
| `memoryUsage.showSparkline` | `true` | Show rolling sparkline history before the RAM bar |
| `memoryUsage.barLength` | `8` | Width of the progress bar in characters (4–20) |
| `memoryUsage.warnThreshold` | `70` | Percentage at which the bar turns yellow |
| `memoryUsage.criticalThreshold` | `90` | Percentage at which the bar turns red |

## Installation

Download the latest `.vsix` from the [Releases](https://github.com/mrijke/vscode-memory-usage/releases) page and install it via:

```bash
code --install-extension vscode-memory-usage-*.vsix
```

Or through the VS Code UI: Extensions → `···` → **Install from VSIX...**

## License

MIT
