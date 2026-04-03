// ========================================
// RVOL Scanner - Data API Layer
// ========================================

class MarketDataAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://finnhub.io/api/v1';
    this.cache = new Map();
    this.callCount = 0;
    this.callResetTime = Date.now();
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  // Rate-limited fetch: stay under 60 calls/min
  async rateLimitedFetch(url) {
    const now = Date.now();
    if (now - this.callResetTime > 60000) {
      this.callCount = 0;
      this.callResetTime = now;
    }
    if (this.callCount >= 55) {
      const waitTime = 60000 - (now - this.callResetTime) + 200;
      await new Promise(r => setTimeout(r, waitTime));
      this.callCount = 0;
      this.callResetTime = Date.now();
    }
    this.callCount++;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API ${response.status}`);
    return response.json();
  }

  // Get real-time quote
  async getQuote(symbol) {
    const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`;
    try {
      const data = await this.rateLimitedFetch(url);
      if (data.c === 0 && data.h === 0) return null;
      return {
        symbol,
        price: data.c,
        change: data.d,
        changePercent: data.dp,
        high: data.h,
        low: data.l,
        open: data.o,
        prevClose: data.pc,
        timestamp: data.t,
      };
    } catch (err) {
      console.warn(`Quote error ${symbol}:`, err.message);
      return null;
    }
  }

  // Get candle data for a symbol at a given resolution
  // resolution: 1, 5, 15, 30, 60, D, W, M
  async getCandles(symbol, resolution, fromTs, toTs) {
    const cacheKey = `candle_${symbol}_${resolution}_${fromTs}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.time < 30000) return cached.data;

    const url = `${this.baseUrl}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${fromTs}&to=${toTs}&token=${this.apiKey}`;
    try {
      const data = await this.rateLimitedFetch(url);
      if (data.s !== 'ok' || !data.v) return null;

      const candles = data.t.map((t, i) => ({
        time: t,
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v[i],
      }));

      this.cache.set(cacheKey, { data: candles, time: Date.now() });
      return candles;
    } catch (err) {
      console.warn(`Candle error ${symbol}:`, err.message);
      return null;
    }
  }

  // Get crypto candles (Finnhub uses exchange:pair format)
  async getCryptoCandles(symbol, resolution, fromTs, toTs) {
    const cacheKey = `cc_${symbol}_${resolution}_${fromTs}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.time < 30000) return cached.data;

    const url = `${this.baseUrl}/crypto/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${fromTs}&to=${toTs}&token=${this.apiKey}`;
    try {
      const data = await this.rateLimitedFetch(url);
      if (data.s !== 'ok' || !data.v) return null;

      const candles = data.t.map((t, i) => ({
        time: t,
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v[i],
      }));

      this.cache.set(cacheKey, { data: candles, time: Date.now() });
      return candles;
    } catch (err) {
      console.warn(`Crypto candle error ${symbol}:`, err.message);
      return null;
    }
  }

  // Get daily candles for historical average volume
  async getHistoricalDailyVolume(symbol, isCrypto, days = 20) {
    const cacheKey = `hist_${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.time < 3600000) return cached.data;

    const toTs = Math.floor(Date.now() / 1000);
    const fromTs = toTs - (days + 10) * 86400;
    const candles = isCrypto
      ? await this.getCryptoCandles(symbol, 'D', fromTs, toTs)
      : await this.getCandles(symbol, 'D', fromTs, toTs);

    if (!candles || candles.length < 2) return null;

    // Exclude today (last candle), use prior N days
    const hist = candles.slice(-days - 1, -1);
    const avgVolume = hist.reduce((s, c) => s + c.volume, 0) / hist.length;
    const todayVolume = candles[candles.length - 1].volume;

    const result = { avgVolume, todayVolume, dataPoints: hist.length };
    this.cache.set(cacheKey, { data: result, time: Date.now() });
    return result;
  }

  // Get low-timeframe candles for spike detection
  // Returns recent candles at the configured SPIKE_TIMEFRAME resolution
  async getRecentCandles(symbol, isCrypto, resolution, barCount) {
    const toTs = Math.floor(Date.now() / 1000);
    // Need enough seconds to cover barCount candles + buffer
    const fromTs = toTs - (barCount + 5) * resolution * 60;

    const candles = isCrypto
      ? await this.getCryptoCandles(symbol, String(resolution), fromTs, toTs)
      : await this.getCandles(symbol, String(resolution), fromTs, toTs);

    return candles;
  }

  // Batch fetch quotes
  async getQuotes(symbols) {
    const results = [];
    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(s => this.getQuote(s)));
      results.push(...batchResults);
      if (i + batchSize < symbols.length) await new Promise(r => setTimeout(r, 150));
    }
    return results.filter(r => r !== null);
  }

  clearCache() {
    this.cache.clear();
  }
}

const marketAPI = new MarketDataAPI(CONFIG.FINNHUB_API_KEY);
