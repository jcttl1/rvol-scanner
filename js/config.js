// ========================================
// RVOL Scanner - Configuration
// ========================================

const CONFIG = {
  // Finnhub API - Get your free key at https://finnhub.io/register
  FINNHUB_API_KEY: '',

  // Refresh interval in seconds
  REFRESH_INTERVAL: 15,

  // Volume spike detection timeframe (minutes): 1, 5, or 15
  SPIKE_TIMEFRAME: 1,

  // Number of bars to compare current volume bar against
  SPIKE_LOOKBACK: 20,

  // RVOL threshold - minimum relative volume to trigger a signal
  RVOL_THRESHOLD: 2.0,

  // Number of historical days to average volume over
  HISTORY_DAYS: 20,

  // Max tickers per table (mirrors TradingView's 40-ticker limit)
  MAX_PER_TABLE: 40,

  // Market hours (Eastern Time)
  MARKET_OPEN_HOUR: 9,
  MARKET_OPEN_MIN: 30,
  MARKET_CLOSE_HOUR: 16,
  MARKET_CLOSE_MIN: 0,

  // Volume spike intensity levels (ascending)
  // Each level: { min: RVOL multiplier, color, bg, label }
  SPIKE_LEVELS: [
    { id: 'extreme',  min: 8.0, color: '#ff0040', bg: '#ff004030', glow: '#ff004060', label: 'EXTREME',   priority: 5 },
    { id: 'veryHigh', min: 5.0, color: '#ff6600', bg: '#ff660025', glow: '#ff660050', label: 'VERY HIGH', priority: 4 },
    { id: 'high',     min: 3.0, color: '#ffaa00', bg: '#ffaa0020', glow: '#ffaa0040', label: 'HIGH',      priority: 3 },
    { id: 'elevated', min: 2.0, color: '#44bbff', bg: '#44bbff18', glow: '#44bbff30', label: 'ELEVATED',  priority: 2 },
    { id: 'moderate', min: 1.5, color: '#22ddaa', bg: '#22ddaa12', glow: '#22ddaa25', label: 'MODERATE',  priority: 1 },
    { id: 'normal',   min: 0,   color: '#555e70', bg: 'transparent', glow: 'transparent', label: '—', priority: 0 },
  ],
};

// ========================================
// 7 Preset Ticker Lists
// 6 Stock Lists + 1 Crypto List
// ========================================
const TICKER_LISTS = {
  'focus-mega': {
    name: 'Focus / Mega Cap',
    icon: '🏛️',
    type: 'stock',
    tickers: [
      'AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'META', 'TSLA', 'BRK.B',
      'UNH', 'LLY', 'JPM', 'V', 'XOM', 'AVGO', 'MA', 'JNJ',
      'PG', 'HD', 'COST', 'ABBV', 'WMT', 'BAC', 'KO', 'PEP',
      'MRK', 'TMO', 'ORCL', 'CRM', 'CSCO', 'ACN', 'MCD', 'NKE',
      'LIN', 'DHR', 'TXN', 'ADBE', 'PM', 'NEE', 'RTX', 'LOW',
    ],
  },
  'tech-growth': {
    name: 'Tech & Growth',
    icon: '🚀',
    type: 'stock',
    tickers: [
      'AMD', 'NFLX', 'INTC', 'QCOM', 'AMAT', 'PANW', 'SNPS', 'CDNS',
      'MRVL', 'KLAC', 'LRCX', 'MU', 'NOW', 'SHOP', 'SQ', 'PLTR',
      'CRWD', 'DDOG', 'NET', 'SNOW', 'ZS', 'TEAM', 'HUBS', 'WDAY',
      'FTNT', 'TTD', 'DASH', 'ROKU', 'U', 'PATH', 'BILL', 'MDB',
      'OKTA', 'ESTC', 'CFLT', 'DOCN', 'GTLB', 'MNDY', 'GLBE', 'S',
    ],
  },
  'momentum-small': {
    name: 'Momentum / Small Cap',
    icon: '🎰',
    type: 'stock',
    tickers: [
      'GME', 'AMC', 'BB', 'SOFI', 'RIVN', 'LCID', 'NIO', 'MARA',
      'RIOT', 'COIN', 'HOOD', 'UPST', 'AFRM', 'IONQ', 'RKLB', 'SMCI',
      'MSTR', 'LUNR', 'JOBY', 'CIFR', 'CLSK', 'HIMS', 'OPEN', 'CLOV',
      'BYND', 'PLUG', 'FCEL', 'LAZR', 'GOEV', 'QS', 'DNA', 'PSNY',
      'NKLA', 'VLD', 'ASTS', 'XPEV', 'LI', 'FFIE', 'MULN', 'WULF',
    ],
  },
  'finance-reit': {
    name: 'Finance & REITs',
    icon: '🏦',
    type: 'stock',
    tickers: [
      'GS', 'MS', 'C', 'WFC', 'SCHW', 'BLK', 'AXP', 'USB',
      'PNC', 'TFC', 'COF', 'AIG', 'MET', 'PRU', 'ICE', 'CME',
      'SPGI', 'MCO', 'FIS', 'PYPL', 'MA', 'V', 'SYF', 'DFS',
      'AMT', 'PLD', 'CCI', 'EQIX', 'O', 'SPG', 'PSA', 'DLR',
      'WELL', 'AVB', 'EQR', 'VTR', 'ARE', 'MAA', 'UDR', 'PEAK',
    ],
  },
  'health-bio': {
    name: 'Health & Biotech',
    icon: '🧬',
    type: 'stock',
    tickers: [
      'PFE', 'ABT', 'ISRG', 'GILD', 'AMGN', 'BMY', 'REGN', 'VRTX',
      'MRNA', 'BIIB', 'ILMN', 'DXCM', 'IDXX', 'ZBH', 'SYK', 'BSX',
      'MDT', 'EW', 'BDX', 'A', 'ALGN', 'HOLX', 'TECH', 'PODD',
      'EXAS', 'RARE', 'NBIX', 'INCY', 'ALNY', 'SRPT', 'PCVX', 'BMRN',
      'SGEN', 'CRSP', 'BEAM', 'NTLA', 'EDIT', 'IONS', 'ARWR', 'FATE',
    ],
  },
  'energy-ind': {
    name: 'Energy & Industrials',
    icon: '⛽',
    type: 'stock',
    tickers: [
      'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'VLO', 'PSX',
      'OXY', 'DVN', 'HAL', 'FANG', 'FCX', 'NEM', 'NUE', 'CLF',
      'AA', 'X', 'GOLD', 'MP', 'CAT', 'DE', 'HON', 'GE',
      'UPS', 'UNP', 'LMT', 'NOC', 'BA', 'GD', 'TDG', 'ITW',
      'EMR', 'ETN', 'ROK', 'CARR', 'OTIS', 'IR', 'AME', 'GNRC',
    ],
  },
  'crypto': {
    name: 'Crypto',
    icon: '₿',
    type: 'crypto',
    exchange: 'BINANCE',
    tickers: [
      'BINANCE:BTCUSDT', 'BINANCE:ETHUSDT', 'BINANCE:BNBUSDT', 'BINANCE:SOLUSDT',
      'BINANCE:XRPUSDT', 'BINANCE:ADAUSDT', 'BINANCE:DOGEUSDT', 'BINANCE:AVAXUSDT',
      'BINANCE:DOTUSDT', 'BINANCE:MATICUSDT', 'BINANCE:LINKUSDT', 'BINANCE:SHIBUSDT',
      'BINANCE:LTCUSDT', 'BINANCE:UNIUSDT', 'BINANCE:ATOMUSDT', 'BINANCE:ETCUSDT',
      'BINANCE:XLMUSDT', 'BINANCE:NEARUSDT', 'BINANCE:APTUSDT', 'BINANCE:ARBUSDT',
      'BINANCE:OPUSDT', 'BINANCE:FILUSDT', 'BINANCE:AAVEUSDT', 'BINANCE:MKRUSDT',
      'BINANCE:GRTUSDT', 'BINANCE:INJUSDT', 'BINANCE:FETUSDT', 'BINANCE:RNDRUSDT',
      'BINANCE:IMXUSDT', 'BINANCE:SUIUSDT', 'BINANCE:SEIUSDT', 'BINANCE:TIAUSDT',
      'BINANCE:JUPUSDT', 'BINANCE:WUSDT', 'BINANCE:STXUSDT', 'BINANCE:PENDLEUSDT',
      'BINANCE:ENAUSDT', 'BINANCE:WLDUSDT', 'BINANCE:ONDOUSDT', 'BINANCE:PEPEUSDT',
    ],
  },
};
