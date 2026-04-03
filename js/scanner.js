// ========================================
// RVOL Scanner - Core Scanner Engine
// Volume Spike Detection on Low Timeframes
// ========================================

class RVOLScanner {
  constructor() {
    this.tickerData = new Map();   // symbol -> full computed data
    this.activeLists = new Set();
    this.refreshTimer = null;
    this.isScanning = false;
    this.lastUpdate = null;
    this.scanCount = 0;

    // Callbacks
    this.onUpdate = null;
    this.onStatusChange = null;
    this.onSpikeDetected = null;
  }

  // ---------- Market Time Helpers ----------

  getEasternNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  }

  getTradingDayFraction() {
    const et = this.getEasternNow();
    const mins = et.getHours() * 60 + et.getMinutes();
    const open = CONFIG.MARKET_OPEN_HOUR * 60 + CONFIG.MARKET_OPEN_MIN;
    const close = CONFIG.MARKET_CLOSE_HOUR * 60 + CONFIG.MARKET_CLOSE_MIN;
    if (mins < open) return 0;
    if (mins >= close) return 1;
    return (mins - open) / (close - open);
  }

  isMarketOpen() {
    const et = this.getEasternNow();
    const day = et.getDay();
    if (day === 0 || day === 6) return false;
    const mins = et.getHours() * 60 + et.getMinutes();
    const open = CONFIG.MARKET_OPEN_HOUR * 60 + CONFIG.MARKET_OPEN_MIN;
    const close = CONFIG.MARKET_CLOSE_HOUR * 60 + CONFIG.MARKET_CLOSE_MIN;
    return mins >= open && mins < close;
  }

  // ---------- Spike Detection ----------

  /**
   * Detect volume spike from low-timeframe candles.
   * Compares the most recent candle's volume to the average of prior candles.
   * Returns spike multiplier (e.g. 5.2 means 5.2x average bar volume).
   */
  detectSpike(candles) {
    if (!candles || candles.length < 3) return { spikeRatio: 0, recentVol: 0, avgBarVol: 0 };

    const lookback = Math.min(CONFIG.SPIKE_LOOKBACK, candles.length - 1);
    const recentBar = candles[candles.length - 1];
    const priorBars = candles.slice(-(lookback + 1), -1);

    // Filter out zero-volume bars (can happen in pre/post market)
    const validBars = priorBars.filter(c => c.volume > 0);
    if (validBars.length === 0) return { spikeRatio: 0, recentVol: recentBar.volume, avgBarVol: 0 };

    const avgBarVol = validBars.reduce((s, c) => s + c.volume, 0) / validBars.length;
    if (avgBarVol === 0) return { spikeRatio: 0, recentVol: recentBar.volume, avgBarVol: 0 };

    // Also check the 2nd-to-last bar for a "just happened" spike
    const prevBar = candles[candles.length - 2];
    const recentVol = Math.max(recentBar.volume, prevBar.volume);
    const spikeRatio = recentVol / avgBarVol;

    return {
      spikeRatio: Math.round(spikeRatio * 100) / 100,
      recentVol,
      avgBarVol: Math.round(avgBarVol),
      barTime: recentBar.time,
    };
  }

  /**
   * Get the spike level config for a given RVOL ratio.
   */
  getSpikeLevel(ratio) {
    for (const level of CONFIG.SPIKE_LEVELS) {
      if (ratio >= level.min) return level;
    }
    return CONFIG.SPIKE_LEVELS[CONFIG.SPIKE_LEVELS.length - 1];
  }

  // ---------- Active Symbols ----------

  getActiveSymbols() {
    const symbols = [];
    this.activeLists.forEach(listKey => {
      const list = TICKER_LISTS[listKey];
      if (list) {
        list.tickers.forEach(t => {
          if (!symbols.includes(t)) symbols.push(t);
        });
      }
    });
    return symbols;
  }

  getListType(listKey) {
    return TICKER_LISTS[listKey]?.type || 'stock';
  }

  isCrypto(symbol) {
    return symbol.includes(':');
  }

  getDisplaySymbol(symbol) {
    // "BINANCE:BTCUSDT" -> "BTC/USDT"
    if (symbol.includes(':')) {
      const pair = symbol.split(':')[1];
      const base = pair.replace('USDT', '').replace('USD', '').replace('BUSD', '');
      return base;
    }
    return symbol;
  }

  // ---------- Main Scan Loop ----------

  async runScan() {
    if (this.isScanning) return;
    this.isScanning = true;
    this.scanCount++;
    const isInitial = this.scanCount === 1;

    const allSymbols = this.getActiveSymbols();
    if (allSymbols.length === 0) {
      this.isScanning = false;
      this.updateStatus('idle');
      return;
    }

    try {
      this.updateStatus('scanning');

      // Process each active list independently for better parallelism
      for (const listKey of this.activeLists) {
        const list = TICKER_LISTS[listKey];
        if (!list) continue;
        const isCryptoList = list.type === 'crypto';

        for (let i = 0; i < list.tickers.length; i++) {
          const symbol = list.tickers[i];
          const crypto = this.isCrypto(symbol);

          try {
            // 1. Fetch low-timeframe candles for spike detection
            const candles = await marketAPI.getRecentCandles(
              symbol, crypto, CONFIG.SPIKE_TIMEFRAME, CONFIG.SPIKE_LOOKBACK + 5
            );
            const spike = this.detectSpike(candles);

            // 2. Fetch daily historical volume (cached, only re-fetches hourly)
            let dailyData = null;
            if (isInitial || !this.tickerData.has(symbol)) {
              dailyData = await marketAPI.getHistoricalDailyVolume(symbol, crypto, CONFIG.HISTORY_DAYS);
            } else {
              dailyData = this.tickerData.get(symbol)?._dailyData || null;
            }

            // 3. Fetch quote for price data (stocks only; crypto gets price from candles)
            let quote = null;
            if (!crypto) {
              quote = await marketAPI.getQuote(symbol);
            } else if (candles && candles.length > 0) {
              const last = candles[candles.length - 1];
              const first = candles[0];
              quote = {
                symbol,
                price: last.close,
                change: last.close - first.open,
                changePercent: ((last.close - first.open) / first.open) * 100,
              };
            }

            // 4. Compute daily RVOL (time-adjusted)
            let dailyRvol = 0;
            if (dailyData) {
              const frac = crypto ? 1 : Math.max(this.getTradingDayFraction(), 0.01);
              dailyRvol = dailyData.todayVolume / (dailyData.avgVolume * frac);
            }

            // 5. The primary signal: spike ratio on low timeframe
            const spikeLevel = this.getSpikeLevel(spike.spikeRatio);
            const prevData = this.tickerData.get(symbol);
            const prevLevel = prevData?.spikeLevel?.priority || 0;
            const isNewSpike = spikeLevel.priority >= 2 && spikeLevel.priority > prevLevel;

            this.tickerData.set(symbol, {
              symbol,
              displaySymbol: this.getDisplaySymbol(symbol),
              isCrypto: crypto,
              spikeRatio: spike.spikeRatio,
              spikeLevel,
              recentBarVol: spike.recentVol,
              avgBarVol: spike.avgBarVol,
              barTime: spike.barTime,
              dailyRvol: Math.round(dailyRvol * 100) / 100,
              dailyVolume: dailyData?.todayVolume || 0,
              avgDailyVolume: dailyData?.avgVolume || 0,
              price: quote?.price || 0,
              change: quote?.change || 0,
              changePercent: quote?.changePercent || 0,
              lastScan: Date.now(),
              isNewSpike,
              _dailyData: dailyData,
            });

            // Fire spike event for alerts
            if (isNewSpike && this.onSpikeDetected) {
              this.onSpikeDetected(this.tickerData.get(symbol));
            }
          } catch (err) {
            console.warn(`Scan error for ${symbol}:`, err.message);
          }
        }

        // Trigger a UI update after each list completes (so tables populate progressively)
        if (this.onUpdate) this.onUpdate();
      }

      this.lastUpdate = new Date();
      this.updateStatus('ready');
      if (this.onUpdate) this.onUpdate();

    } catch (err) {
      console.error('Scan cycle error:', err);
      this.updateStatus('error');
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Get sorted results for a specific list.
   * Sorted by spike ratio descending — most intense spikes always on top.
   */
  getSortedResults(listKey) {
    const list = TICKER_LISTS[listKey];
    if (!list) return [];

    const results = [];
    list.tickers.forEach(symbol => {
      const data = this.tickerData.get(symbol);
      if (data) results.push(data);
    });

    // Continuous sort: most intense spike first
    results.sort((a, b) => {
      // Primary: spike level priority (descending)
      if (b.spikeLevel.priority !== a.spikeLevel.priority) {
        return b.spikeLevel.priority - a.spikeLevel.priority;
      }
      // Secondary: spike ratio (descending)
      return b.spikeRatio - a.spikeRatio;
    });

    return results;
  }

  // ---------- Lifecycle ----------

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.scanCount = 0;
    this.runScan();
    this.refreshTimer = setInterval(() => this.runScan(), CONFIG.REFRESH_INTERVAL * 1000);
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  setActiveLists(listKeys) {
    this.activeLists = new Set(listKeys);
  }

  updateStatus(status) {
    if (this.onStatusChange) this.onStatusChange(status);
  }
}

const scanner = new RVOLScanner();
