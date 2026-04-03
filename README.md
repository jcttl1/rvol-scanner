# RVOL Scanner — Relative Volume Spike Scanner

Real-time volume spike scanner for stocks and crypto. Tables light up with colored signals when unusual volume spikes occur on low timeframes. Tickers with the most intense spikes are continuously sorted to the top.

## Quick Start

1. Get a **free API key** from [finnhub.io/register](https://finnhub.io/register)
2. Open the app and paste your key when prompted
3. Enable ticker lists — each list runs as its own table, side-by-side

## Deploy to GitHub Pages (Private)

```bash
# 1. Create a PRIVATE repo on GitHub
gh repo create rvol-scanner --private --source=. --push

# Or manually:
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rvol-scanner.git
git push -u origin main

# 2. Enable GitHub Pages
# Settings → Pages → Source → GitHub Actions
# Deploys automatically on every push

# 3. Share with your friend
# URL: https://YOUR_USERNAME.github.io/rvol-scanner/
# Add collaborator: Settings → Collaborators → Add people
```

## Update Workflow

Push changes → auto-deploys in ~60 seconds:

```bash
git add . && git commit -m "Update" && git push
```

## Features

**Scanner:**
- 7 preset ticker lists (6 stock + 1 crypto) — up to 40 tickers each, 280+ total
- Low-timeframe volume spike detection (1m, 5m, 15m candles)
- 5 signal intensity levels: Moderate → Elevated → High → Very High → Extreme
- Rows light up with colored glow when spikes are detected
- Continuous sorting — most intense spikes always at the top
- Multiple tables displayed side-by-side simultaneously

**Alerts & UI:**
- Desktop notifications + sound alerts for new spikes
- Dark theme (TradingView-inspired)
- Real-time market open/closed indicator
- Responsive — works on mobile
- API key stored locally in your browser

## Signal Levels

| Spike | Level | Color | Meaning |
|-------|-------|-------|---------|
| 1.5x+ | Moderate | Green | Slightly elevated bar volume |
| 2x+ | Elevated | Blue | Noticeable uptick — worth a look |
| 3x+ | High | Yellow | Unusual volume — likely catalyst |
| 5x+ | Very High | Orange | Strong momentum move |
| 8x+ | Extreme | Red | Major event — get to this chart fast |

## How It Works

The scanner fetches low-timeframe candles (1m/5m/15m) for each ticker and compares the most recent bar's volume against the average of the prior 20 bars. When a bar's volume significantly exceeds the average, the ticker "lights up" in the table.

**Spike Ratio** = Latest Bar Volume ÷ Average Bar Volume (over prior 20 bars)

**Daily RVOL** = Today's Cumulative Volume ÷ (20-Day Avg Volume × Fraction of Trading Day Elapsed)
