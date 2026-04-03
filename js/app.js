// ========================================
// RVOL Scanner - Main Application / UI
// Multi-table side-by-side with light-up signals
// ========================================

const App = {
  alertsEnabled: false,
  soundEnabled: false,
  previousSpikes: new Map(),

  // ---------- Init ----------

  init() {
    this.loadSettings();
    this.renderShell();
    this.bindEvents();
    if (!CONFIG.FINNHUB_API_KEY) {
      this.showApiKeyPrompt();
    } else {
      this.startScanner();
    }
  },

  // ---------- Settings Persistence ----------

  loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('rvol_settings') || '{}');
      if (s.apiKey) CONFIG.FINNHUB_API_KEY = s.apiKey;
      if (s.threshold) CONFIG.RVOL_THRESHOLD = s.threshold;
      if (s.refresh) CONFIG.REFRESH_INTERVAL = s.refresh;
      if (s.timeframe) CONFIG.SPIKE_TIMEFRAME = s.timeframe;
      if (s.alertsEnabled) this.alertsEnabled = true;
      if (s.soundEnabled) this.soundEnabled = true;
      this._savedLists = s.activeLists || ['focus-mega'];
    } catch (e) { this._savedLists = ['focus-mega']; }
  },

  saveSettings() {
    try {
      localStorage.setItem('rvol_settings', JSON.stringify({
        apiKey: CONFIG.FINNHUB_API_KEY,
        threshold: CONFIG.RVOL_THRESHOLD,
        refresh: CONFIG.REFRESH_INTERVAL,
        timeframe: CONFIG.SPIKE_TIMEFRAME,
        alertsEnabled: this.alertsEnabled,
        soundEnabled: this.soundEnabled,
        activeLists: Array.from(scanner.activeLists),
      }));
    } catch (e) { /* ok */ }
  },

  // ---------- Shell Render ----------

  renderShell() {
    document.getElementById('app').innerHTML = `
      <header class="header">
        <div class="header-left">
          <h1 class="logo"><span class="logo-icon">◈</span> RVOL Scanner</h1>
          <span class="header-badge" id="liveBadge">LIVE</span>
        </div>
        <div class="header-center">
          <div class="status-bar">
            <span class="status-dot" id="statusDot"></span>
            <span id="statusText">Initializing...</span>
          </div>
          <div class="market-time" id="marketTime"></div>
        </div>
        <div class="header-right">
          <select class="timeframe-select" id="tfSelect" title="Spike detection timeframe">
            <option value="1" ${CONFIG.SPIKE_TIMEFRAME===1?'selected':''}>1m</option>
            <option value="5" ${CONFIG.SPIKE_TIMEFRAME===5?'selected':''}>5m</option>
            <option value="15" ${CONFIG.SPIKE_TIMEFRAME===15?'selected':''}>15m</option>
          </select>
          <button class="btn btn-icon" id="btnRefresh" title="Refresh Now (R)">⟳</button>
          <button class="btn btn-icon" id="btnAlerts" title="Toggle Alerts">🔔</button>
          <button class="btn btn-icon" id="btnSettings" title="Settings">⚙</button>
        </div>
      </header>

      <nav class="list-tabs" id="listTabs"></nav>

      <div class="scanner-container" id="scannerContainer">
        <div class="empty-state" id="emptyState">
          <div class="empty-icon">◈</div>
          <p>Select ticker lists above to begin scanning</p>
          <small>Each list runs as its own table — enable multiple for side-by-side scanning</small>
        </div>
      </div>

      <!-- Settings Modal -->
      <div class="modal-overlay" id="settingsModal" style="display:none">
        <div class="modal">
          <div class="modal-header">
            <h2>Settings</h2>
            <button class="btn btn-icon modal-close" id="closeSettings">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Finnhub API Key</label>
              <input type="text" id="inputApiKey" placeholder="Your free API key" />
              <small>Free at <a href="https://finnhub.io/register" target="_blank">finnhub.io/register</a></small>
            </div>
            <div class="form-group">
              <label>Spike Detection Timeframe</label>
              <select id="inputTimeframe">
                <option value="1">1 minute</option>
                <option value="5">5 minutes</option>
                <option value="15">15 minutes</option>
              </select>
              <small>Lower timeframes detect spikes faster but use more API calls</small>
            </div>
            <div class="form-group">
              <label>RVOL Alert Threshold</label>
              <input type="number" id="inputThreshold" step="0.5" min="1" max="20" />
            </div>
            <div class="form-group">
              <label>Refresh Interval (seconds)</label>
              <input type="number" id="inputRefresh" step="5" min="10" max="300" />
            </div>
            <div class="form-group">
              <label class="checkbox-label"><input type="checkbox" id="inputAlerts" /> Desktop Notifications</label>
            </div>
            <div class="form-group">
              <label class="checkbox-label"><input type="checkbox" id="inputSound" /> Sound Alerts</label>
            </div>
            <button class="btn btn-primary" id="saveSettings">Save Settings</button>
          </div>
        </div>
      </div>

      <!-- API Key Setup Modal -->
      <div class="modal-overlay" id="apiKeyModal" style="display:none">
        <div class="modal">
          <div class="modal-header"><h2>Welcome to RVOL Scanner</h2></div>
          <div class="modal-body">
            <p class="welcome-text">Get a free Finnhub API key to power the scanner (30 seconds).</p>
            <ol class="setup-steps">
              <li>Go to <a href="https://finnhub.io/register" target="_blank">finnhub.io/register</a></li>
              <li>Create an account and copy your API key</li>
              <li>Paste it below</li>
            </ol>
            <div class="form-group">
              <input type="text" id="inputApiKeySetup" placeholder="Paste your API key here" />
            </div>
            <button class="btn btn-primary" id="btnStartSetup">Start Scanning</button>
          </div>
        </div>
      </div>

      <div id="alertToast" class="alert-toast" style="display:none"></div>

      <!-- Legend -->
      <footer class="legend-bar" id="legendBar">
        <span class="legend-title">SIGNAL LEVELS:</span>
        ${CONFIG.SPIKE_LEVELS.filter(l => l.priority > 0).reverse().map(l =>
          `<span class="legend-item"><span class="legend-dot" style="background:${l.color}"></span>${l.label}</span>`
        ).join('')}
        <span class="legend-sep">|</span>
        <span class="legend-info">Timeframe: <strong id="legendTf">${CONFIG.SPIKE_TIMEFRAME}m</strong></span>
        <span class="legend-info">Refresh: <strong>${CONFIG.REFRESH_INTERVAL}s</strong></span>
      </footer>
    `;

    this.renderListTabs();
    this.startClock();
  },

  renderListTabs() {
    const container = document.getElementById('listTabs');
    const saved = this._savedLists;
    let html = '';

    Object.entries(TICKER_LISTS).forEach(([key, list]) => {
      const isActive = saved.includes(key);
      const countLabel = list.tickers.length;
      html += `
        <button class="tab-btn list-toggle ${isActive ? 'selected' : ''}" data-list="${key}">
          <span class="tab-icon">${list.icon}</span>
          <span class="tab-name">${list.name}</span>
          <span class="tab-count">${countLabel}</span>
          <span class="tab-check">${isActive ? '✓' : ''}</span>
        </button>
      `;
    });

    container.innerHTML = html;
  },

  // ---------- Events ----------

  bindEvents() {
    document.getElementById('listTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.list-toggle');
      if (!btn) return;
      btn.classList.toggle('selected');
      btn.querySelector('.tab-check').textContent = btn.classList.contains('selected') ? '✓' : '';
      this.updateActiveLists();
    });

    document.getElementById('btnRefresh').addEventListener('click', () => scanner.runScan());
    document.getElementById('btnSettings').addEventListener('click', () => this.openSettings());
    document.getElementById('closeSettings').addEventListener('click', () => {
      document.getElementById('settingsModal').style.display = 'none';
    });
    document.getElementById('saveSettings').addEventListener('click', () => this.applySettings());

    document.getElementById('btnAlerts').addEventListener('click', () => {
      this.alertsEnabled = !this.alertsEnabled;
      document.getElementById('btnAlerts').classList.toggle('active', this.alertsEnabled);
      if (this.alertsEnabled && Notification.permission === 'default') Notification.requestPermission();
      this.saveSettings();
    });

    document.getElementById('tfSelect').addEventListener('change', (e) => {
      CONFIG.SPIKE_TIMEFRAME = parseInt(e.target.value);
      document.getElementById('legendTf').textContent = CONFIG.SPIKE_TIMEFRAME + 'm';
      this.saveSettings();
      scanner.stopAutoRefresh();
      scanner.startAutoRefresh();
    });

    document.getElementById('btnStartSetup')?.addEventListener('click', () => {
      const key = document.getElementById('inputApiKeySetup').value.trim();
      if (key) {
        CONFIG.FINNHUB_API_KEY = key;
        marketAPI.setApiKey(key);
        this.saveSettings();
        document.getElementById('apiKeyModal').style.display = 'none';
        this.startScanner();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.getElementById('settingsModal').style.display = 'none';
        document.getElementById('apiKeyModal').style.display = 'none';
      }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.target.matches('input,select')) {
        scanner.runScan();
      }
    });
  },

  updateActiveLists() {
    const lists = [];
    document.querySelectorAll('.list-toggle.selected').forEach(b => lists.push(b.dataset.list));
    scanner.setActiveLists(lists);
    this.saveSettings();
    if (lists.length > 0 && CONFIG.FINNHUB_API_KEY) {
      scanner.stopAutoRefresh();
      scanner.startAutoRefresh();
    } else {
      scanner.stopAutoRefresh();
      this.renderTables();
    }
  },

  // ---------- Scanner Start ----------

  startScanner() {
    scanner.setActiveLists(this._savedLists);
    scanner.onUpdate = () => this.renderTables();
    scanner.onStatusChange = (s) => this.updateStatusUI(s);
    scanner.onSpikeDetected = (data) => this.handleSpikeAlert(data);
    scanner.startAutoRefresh();
    document.getElementById('btnAlerts').classList.toggle('active', this.alertsEnabled);
  },

  // ---------- Render Tables ----------

  renderTables() {
    const container = document.getElementById('scannerContainer');
    const activeLists = Array.from(scanner.activeLists);

    if (activeLists.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◈</div>
          <p>Select ticker lists above to begin scanning</p>
          <small>Each list displays as its own table — enable multiple for side-by-side scanning of 280+ tickers</small>
        </div>
      `;
      return;
    }

    let html = '<div class="tables-grid">';
    activeLists.forEach(listKey => {
      const list = TICKER_LISTS[listKey];
      const results = scanner.getSortedResults(listKey);
      html += this.renderSingleTable(listKey, list, results);
    });
    html += '</div>';
    container.innerHTML = html;
  },

  renderSingleTable(listKey, list, results) {
    const signalCount = results.filter(r => r.spikeLevel.priority >= 2).length;
    const hasData = results.length > 0;

    let rows = '';
    if (hasData) {
      results.forEach((r) => {
        const lv = r.spikeLevel;
        const isLit = lv.priority >= 2;
        const isNew = r.isNewSpike;
        const changeClass = r.changePercent >= 0 ? 'positive' : 'negative';
        const changeSign = r.changePercent >= 0 ? '+' : '';

        rows += `
          <tr class="scanner-row ${isLit ? 'lit' : ''} ${isNew ? 'new-spike' : ''}" style="${isLit ? `background:${lv.bg};` : ''}">
            <td class="col-symbol">
              ${isLit ? `<span class="signal-glow" style="background:${lv.glow}"></span>` : ''}
              <span class="symbol-name">${r.displaySymbol}</span>
            </td>
            <td class="col-spike">
              <span class="spike-badge" style="background:${lv.color}20;color:${lv.color};border-color:${lv.color}50">
                ${r.spikeRatio > 0 ? r.spikeRatio.toFixed(1) + 'x' : '—'}
              </span>
            </td>
            <td class="col-signal-label" style="color:${lv.color}">
              <span class="signal-dot" style="background:${lv.color};${isLit ? `box-shadow:0 0 6px ${lv.color}` : ''}"></span>
              ${lv.priority > 0 ? lv.label : '—'}
            </td>
            <td class="col-price">${r.price ? '$' + r.price.toFixed(2) : '—'}</td>
            <td class="col-change ${changeClass}">${r.changePercent ? changeSign + r.changePercent.toFixed(2) + '%' : '—'}</td>
            <td class="col-rvol">${r.dailyRvol > 0 ? r.dailyRvol.toFixed(1) + 'x' : '—'}</td>
            <td class="col-barvol">${this.fmtVol(r.recentBarVol)}</td>
          </tr>
        `;
      });
    } else {
      rows = `<tr><td colspan="7" class="loading-row"><div class="spinner"></div>Scanning ${list.name}...</td></tr>`;
    }

    return `
      <div class="scanner-table-wrapper ${list.type === 'crypto' ? 'crypto-table' : ''}" data-list="${listKey}">
        <div class="table-header">
          <span class="table-title">${list.icon} ${list.name}</span>
          <span class="table-meta">
            ${hasData ? `${results.length} tickers` : 'Loading...'}
            ${signalCount > 0 ? ` · <span class="signal-count">${signalCount} signal${signalCount !== 1 ? 's' : ''}</span>` : ''}
          </span>
        </div>
        <div class="table-scroll">
          <table class="scanner-table">
            <thead>
              <tr>
                <th class="col-symbol">Ticker</th>
                <th class="col-spike">Spike</th>
                <th class="col-signal-label">Signal</th>
                <th class="col-price">Price</th>
                <th class="col-change">Chg%</th>
                <th class="col-rvol">RVOL</th>
                <th class="col-barvol">Bar Vol</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  fmtVol(v) {
    if (!v) return '—';
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return v.toLocaleString();
  },

  // ---------- Status ----------

  updateStatusUI(status) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const badge = document.getElementById('liveBadge');
    if (!dot) return;

    const map = {
      scanning: { c: '#ffaa00', t: 'Scanning...' },
      ready:    { c: '#00cc66', t: `Updated ${new Date().toLocaleTimeString()}` },
      error:    { c: '#ff4444', t: 'Error — check API key' },
      idle:     { c: '#555', t: 'Idle' },
    };
    const s = map[status] || map.idle;
    dot.style.background = s.c;
    dot.className = 'status-dot' + (status === 'scanning' ? ' pulse' : '');
    text.textContent = s.t;
    if (badge) badge.className = 'header-badge' + (status === 'ready' ? '' : ' dimmed');
  },

  startClock() {
    const update = () => {
      const el = document.getElementById('marketTime');
      if (!el) return;
      const eastern = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      });
      const isOpen = scanner.isMarketOpen();
      el.innerHTML = `<span class="market-status ${isOpen ? 'open' : 'closed'}">${isOpen ? 'MARKET OPEN' : 'CLOSED'}</span> ${eastern} ET`;
    };
    update();
    setInterval(update, 1000);
  },

  // ---------- Alerts ----------

  handleSpikeAlert(data) {
    if (!this.alertsEnabled) return;
    const msg = `${data.displaySymbol} spike ${data.spikeRatio.toFixed(1)}x | ${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}% | $${data.price.toFixed(2)}`;

    if (Notification.permission === 'granted') {
      new Notification('Volume Spike Detected', { body: msg });
    }
    if (this.soundEnabled) this.playAlertSound();
    this.showToast(msg);
  },

  playAlertSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  },

  showToast(msg) {
    const t = document.getElementById('alertToast');
    if (!t) return;
    t.textContent = '🔔 ' + msg;
    t.style.display = 'block';
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.style.display = 'none', 300); }, 4000);
  },

  // ---------- Modals ----------

  showApiKeyPrompt() {
    document.getElementById('apiKeyModal').style.display = 'flex';
  },

  openSettings() {
    document.getElementById('inputApiKey').value = CONFIG.FINNHUB_API_KEY;
    document.getElementById('inputTimeframe').value = CONFIG.SPIKE_TIMEFRAME;
    document.getElementById('inputThreshold').value = CONFIG.RVOL_THRESHOLD;
    document.getElementById('inputRefresh').value = CONFIG.REFRESH_INTERVAL;
    document.getElementById('inputAlerts').checked = this.alertsEnabled;
    document.getElementById('inputSound').checked = this.soundEnabled;
    document.getElementById('settingsModal').style.display = 'flex';
  },

  applySettings() {
    const key = document.getElementById('inputApiKey').value.trim();
    const tf = parseInt(document.getElementById('inputTimeframe').value);
    const threshold = parseFloat(document.getElementById('inputThreshold').value);
    const refresh = parseInt(document.getElementById('inputRefresh').value);

    if (key) { CONFIG.FINNHUB_API_KEY = key; marketAPI.setApiKey(key); }
    if ([1, 5, 15].includes(tf)) CONFIG.SPIKE_TIMEFRAME = tf;
    if (!isNaN(threshold) && threshold > 0) CONFIG.RVOL_THRESHOLD = threshold;
    if (!isNaN(refresh) && refresh >= 10) CONFIG.REFRESH_INTERVAL = refresh;
    this.alertsEnabled = document.getElementById('inputAlerts').checked;
    this.soundEnabled = document.getElementById('inputSound').checked;

    this.saveSettings();
    document.getElementById('settingsModal').style.display = 'none';
    document.getElementById('tfSelect').value = CONFIG.SPIKE_TIMEFRAME;
    document.getElementById('legendTf').textContent = CONFIG.SPIKE_TIMEFRAME + 'm';
    scanner.stopAutoRefresh();
    scanner.startAutoRefresh();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
