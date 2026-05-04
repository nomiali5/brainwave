const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Brainwave — HD-MEA Neurophysiology Viewer</title>
<script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
<script>document.addEventListener('DOMContentLoaded',()=>{ if(window.Chart&&window.ChartZoom) Chart.register(window.ChartZoom); });</script>
<style>
  :root {
    --bg:        #0a0c10;
    --surface:   #11141c;
    --border:    #1e2435;
    --accent:    #00e5ff;
    --accent2:   #7b61ff;
    --warn:      #ff9f43;
    --error:     #ff4757;
    --text:      #cdd6f4;
    --muted:     #6c7a99;
    --radius:    10px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; }

  /* ── layout ── */
  body { display: flex; flex-direction: column; min-height: 100vh; }
  header { padding: 18px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
  header svg { flex-shrink: 0; }
  header h1 { font-size: 1.25rem; font-weight: 700; letter-spacing: .04em; color: var(--accent); }
  header span { color: var(--muted); font-size: .85rem; }
  main { flex: 1; padding: 24px; display: flex; flex-direction: column; gap: 20px; max-width: 1400px; width: 100%; margin: 0 auto; }

  /* ── upload zone ── */
  #upload-zone {
    border: 2px dashed var(--border); border-radius: var(--radius);
    padding: 48px 24px; text-align: center; cursor: pointer;
    transition: border-color .2s, background .2s;
    background: var(--surface);
  }
  #upload-zone.drag-over { border-color: var(--accent); background: #0d1520; }
  #upload-zone p { color: var(--muted); margin-top: 8px; font-size: .9rem; }
  #upload-zone em { color: var(--accent); font-style: normal; font-weight: 600; }
  #file-input { display: none; }

  /* ── status / spinner ── */
  #status-bar {
    display: none; align-items: center; gap: 12px;
    padding: 14px 18px; background: var(--surface); border-radius: var(--radius);
    border: 1px solid var(--border);
  }
  #status-bar.visible { display: flex; }
  .spinner {
    width: 20px; height: 20px; border: 3px solid var(--border);
    border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  #status-msg { color: var(--text); }

  /* ── banners ── */
  .banner {
    padding: 12px 16px; border-radius: var(--radius); font-size: .9rem; display: none;
    border-left: 4px solid transparent;
  }
  .banner.visible { display: block; }
  .banner.warn  { background: #1f1800; border-color: var(--warn);  color: var(--warn);  }
  .banner.error { background: #1a0007; border-color: var(--error); color: var(--error); }
  .banner.info  { background: #001820; border-color: var(--accent); color: var(--accent); }

  /* ── info panel ── */
  #info-panel {
    display: none; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px;
  }
  #info-panel.visible { display: block; }
  #info-panel h2 { color: var(--accent); font-size: 1rem; margin-bottom: 14px; letter-spacing: .05em; text-transform: uppercase; }
  .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
  .info-card { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; }
  .info-card .label { color: var(--muted); font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; }
  .info-card .value { color: var(--text); font-size: 1.1rem; font-weight: 600; margin-top: 4px; }

  /* ── controls ── */
  #controls { display: none; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 20px; gap: 20px; flex-wrap: wrap; align-items: center; }
  #controls.visible { display: flex; }
  .ctrl-group { display: flex; flex-direction: column; gap: 4px; }
  .ctrl-group label { color: var(--muted); font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; }
  select, input[type=range] { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: .9rem; cursor: pointer; }
  select:focus { outline: 1px solid var(--accent); }
  input[type=range] { width: 220px; accent-color: var(--accent); padding: 2px; }
  #time-label { color: var(--accent); font-size: .85rem; min-width: 90px; }

  /* ── charts grid ── */
  #charts-grid {
    display: none; grid-template-columns: 1fr 1fr; gap: 20px;
  }
  #charts-grid.visible { display: grid; }
  .chart-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 18px; display: flex; flex-direction: column; gap: 12px;
  }
  .chart-card h3 { color: var(--accent2); font-size: .9rem; text-transform: uppercase; letter-spacing: .05em; }
  .chart-wrap { position: relative; height: 300px; }
  canvas { width: 100% !important; }

  /* ── footer ── */
  footer { padding: 14px 24px; border-top: 1px solid var(--border); color: var(--muted); font-size: .78rem; text-align: center; }

  @media (max-width: 800px) {
    #charts-grid.visible { grid-template-columns: 1fr; }
  }

  #global-toolbar{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;
    background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
    border-radius:8px;padding:10px 16px;margin-bottom:20px;}
  #global-toolbar button{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);
    color:#ccc;border-radius:5px;padding:5px 11px;font-size:0.77rem;cursor:pointer;}
  #global-toolbar button:hover{background:rgba(255,255,255,0.14);color:#fff;}
  .chart-controls{display:flex;justify-content:space-between;flex-wrap:wrap;gap:5px;margin-bottom:8px;}
  .chart-controls button{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
    color:#bbb;border-radius:4px;padding:3px 9px;font-size:0.73rem;cursor:pointer;}
  .chart-controls button:hover{background:rgba(255,255,255,0.13);color:#fff;}
  .chart-extra{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
    border-radius:6px;padding:7px 11px;margin-bottom:9px;display:flex;flex-wrap:wrap;
    gap:8px;align-items:center;font-size:0.75rem;color:#999;}
  .chart-extra label{display:flex;align-items:center;gap:4px;color:#aaa;cursor:pointer;}
  .chart-extra input[type=range]{width:80px;accent-color:#00dcb4;}
  .chart-extra select{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);
    color:#ccc;border-radius:4px;padding:2px 5px;font-size:0.74rem;}
  .toggle-label{display:flex;align-items:center;gap:3px;color:#bbb;font-size:0.74rem;cursor:pointer;}
  .toggle-label input{accent-color:#00dcb4;}
  .detail-box{background:rgba(0,220,160,0.07);border:1px solid rgba(0,220,160,0.2);
    border-radius:5px;padding:4px 10px;font-family:monospace;font-size:0.74rem;color:#00ffcc;}

  /* ── new chart containers ── */
  .chart-container {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 18px;
  }

  .chart-header {
    display: flex;
    flex-direction: column;
    margin-bottom: 8px;
  }

  .chart-header h3 {
    margin: 0 0 2px 0;
    font-size: 0.95rem;
    color: #e0e0e0;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .chart-subtitle {
    font-size: 0.75rem;
    color: #888;
    font-style: italic;
  }

  /* Network burst legend pill for burst bins */
  .burst-legend {
    display: inline-block;
    width: 12px;
    height: 12px;
    background: rgba(255, 160, 50, 0.9);
    border-radius: 2px;
    margin-right: 4px;
    vertical-align: middle;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    color: #666;
    font-size: 0.85rem;
    font-style: italic;
    border: 1px dashed #333;
    border-radius: 6px;
    margin-top: 12px;
    padding: 16px;
    text-align: center;
  }
</style>
</head>
<body>

<header>
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="15" stroke="#00e5ff" stroke-width="1.5"/>
    <path d="M8 16 Q12 8 16 16 Q20 24 24 16" stroke="#7b61ff" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="8"  cy="16" r="2" fill="#00e5ff"/>
    <circle cx="24" cy="16" r="2" fill="#00e5ff"/>
  </svg>
  <div>
    <h1>Brainwave</h1>
    <span>HD-MEA Neurophysiology Viewer · 3Brain BRW/BXR</span>
  </div>
</header>

<main>
  <!-- Upload -->
  <div id="upload-zone" role="button" tabindex="0" aria-label="Upload BRW or BXR file">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
    <p>Drag &amp; drop a <em>.brw</em> or <em>.bxr</em> file here, or <em>click to browse</em></p>
    <p style="font-size:.78rem;margin-top:4px;">All processing happens in your browser — no data is uploaded to any server.</p>
    <input type="file" id="file-input" accept=".brw,.bxr" />
  </div>

  <!-- Status -->
  <div id="status-bar">
    <div class="spinner"></div>
    <span id="status-msg">Initializing…</span>
  </div>

  <!-- Banners -->
  <div id="banner-warn"  class="banner warn"></div>
  <div id="banner-error" class="banner error"></div>
  <div id="banner-info"  class="banner info"></div>

  <!-- Info Panel -->
  <div id="info-panel">
    <h2>Experiment Info</h2>
    <div class="info-grid" id="info-grid"></div>
  </div>

  <!-- Controls -->
  <div id="controls">
    <div class="ctrl-group" id="channel-ctrl" style="display:none">
      <label for="channel-select">Waveform Channel</label>
      <select id="channel-select"></select>
    </div>
    <div class="ctrl-group" id="time-ctrl" style="display:none">
      <label for="time-slider">Time Window Start</label>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="range" id="time-slider" min="0" step="1" value="0" />
        <span id="time-label">0 – 3 s</span>
      </div>
    </div>
  </div>

  <!-- Global Toolbar -->
  <div id="global-toolbar" style="display:none">
    <div>
      <button onclick="ChartRegistry.resetAllZoom()">&#x27F3; Reset All Zoom</button>
      <button id="btn-anim">&#9670; Animations: ON</button>
      <button id="btn-grid">&#8862; Grid: ON</button>
    </div>
    <div>
      <button onclick="exportAllCSV()">&#11015; All CSV</button>
      <button onclick="exportAllPNG()">&#11015; All PNG</button>
      <button id="btn-export-pdf" onclick="exportPDF()">&#11015; PDF Report</button>
    </div>
  </div>

  <!-- Charts -->
  <div id="charts-grid">
    <div class="chart-card" id="card-raw" style="display:none">
      <h3>Raw Signal</h3>
      <div class="chart-controls">
        <span>
          <button onclick="ChartRegistry.get('rawSignal')?.zoom(1.2)">&#xFF0B;</button>
          <button onclick="ChartRegistry.get('rawSignal')?.zoom(0.8)">&#xFF0D;</button>
          <button onclick="ChartRegistry.get('rawSignal')?.resetZoom()">&#x27F3;</button>
          <button onclick="togglePan('rawSignal')">&#x2725; Pan</button>
        </span>
        <span>
          <button onclick="exportCSV('rawSignal')">&#11015; CSV</button>
          <button onclick="exportPNG('rawSignal')">&#11015; PNG</button>
        </span>
      </div>
      <div class="chart-extra">
        <label>Time: <input type="range" id="raw-t-start" min="0" max="100" value="0">
        &#8594; <input type="range" id="raw-t-end" min="0" max="100" value="100"></label>
        <div id="raw-ch-toggles"></div>
        <label><input type="checkbox" id="raw-offset" checked> Separate channels</label>
      </div>
      <div class="chart-wrap"><canvas id="chart-raw"></canvas></div>
    </div>
    <div class="chart-card" id="card-raster"   style="display:none"><h3>Spike Raster (0 &#8211; 10 s)</h3><div class="chart-wrap"><canvas id="chart-raster"></canvas></div></div>
    <div class="chart-card" id="card-waveform" style="display:none">
      <h3>Spike Waveforms</h3>
      <div class="chart-controls">
        <span>
          <button onclick="ChartRegistry.get('waveform')?.zoom(1.2)">&#xFF0B;</button>
          <button onclick="ChartRegistry.get('waveform')?.zoom(0.8)">&#xFF0D;</button>
          <button onclick="ChartRegistry.get('waveform')?.resetZoom()">&#x27F3;</button>
          <button onclick="togglePan('waveform')">&#x2725; Pan</button>
        </span>
        <span>
          <button onclick="exportCSV('waveform')">&#11015; CSV</button>
          <button onclick="exportPNG('waveform')">&#11015; PNG</button>
        </span>
      </div>
      <div class="chart-extra">
        <label>Max: <input type="range" id="wf-max" min="1" max="50" value="50">
        <span id="wf-max-val">50</span></label>
        <label><input type="checkbox" id="wf-mean" checked> Mean</label>
        <label><input type="checkbox" id="wf-std"> &#177;SD</label>
        <label><input type="checkbox" id="wf-norm"> Normalize</label>
      </div>
      <div class="chart-wrap"><canvas id="chart-waveform"></canvas></div>
    </div>

    <!-- NEW CHARTS - add after existing chart canvases -->
    <div class="chart-container" id="raster-container" style="display:none">
      <div class="chart-header">
        <h3>Spike Raster Plot</h3>
        <span class="chart-subtitle">Each dot = one spike event</span>
      </div>
      <div class="chart-controls">
        <span>
          <button onclick="ChartRegistry.get('raster')?.zoom(1.2)">&#xFF0B;</button>
          <button onclick="ChartRegistry.get('raster')?.zoom(0.8)">&#xFF0D;</button>
          <button onclick="ChartRegistry.get('raster')?.resetZoom()">&#x27F3;</button>
          <button onclick="togglePan('raster')">&#x2725; Pan</button>
        </span>
        <span>
          <button onclick="exportCSV('raster')">&#11015; CSV</button>
          <button onclick="exportPNG('raster')">&#11015; PNG</button>
        </span>
      </div>
      <div class="chart-extra">
        <label>Time: <input type="range" id="rst-t0" min="0" max="100" value="0"> &#8594;
        <input type="range" id="rst-t1" min="0" max="100" value="100"></label>
        <label>Size: <input type="range" id="rst-sz" min="1" max="8" value="2" step="0.5"></label>
        <select id="rst-color"><option value="channel">By Channel</option>
        <option value="time">By Time</option><option value="uniform">Uniform</option></select>
        <div id="rst-detail" style="display:none" class="detail-box"></div>
      </div>
      <canvas id="rasterChart"></canvas>
    </div>

    <div class="chart-container" id="firing-rate-container" style="display:none">
      <div class="chart-header">
        <h3>Mean Firing Rate</h3>
        <span class="chart-subtitle">Spikes per second (Hz) per channel</span>
      </div>
      <div class="chart-controls">
        <span>
          <button onclick="ChartRegistry.get('firingRate')?.zoom(1.2)">&#xFF0B;</button>
          <button onclick="ChartRegistry.get('firingRate')?.zoom(0.8)">&#xFF0D;</button>
          <button onclick="ChartRegistry.get('firingRate')?.resetZoom()">&#x27F3;</button>
          <button onclick="togglePan('firingRate')">&#x2725; Pan</button>
        </span>
        <span>
          <button onclick="exportCSV('firingRate')">&#11015; CSV</button>
          <button onclick="exportPNG('firingRate')">&#11015; PNG</button>
        </span>
      </div>
      <canvas id="firingRateChart"></canvas>
    </div>

    <div class="chart-container" id="network-burst-container" style="display:none">
      <div class="chart-header">
        <h3>Network Burst Frequency</h3>
        <span class="chart-subtitle">Population spike rate in 100ms bins</span>
      </div>
      <div class="chart-controls">
        <span>
          <button onclick="ChartRegistry.get('networkBurst')?.zoom(1.2)">&#xFF0B;</button>
          <button onclick="ChartRegistry.get('networkBurst')?.zoom(0.8)">&#xFF0D;</button>
          <button onclick="ChartRegistry.get('networkBurst')?.resetZoom()">&#x27F3;</button>
          <button onclick="togglePan('networkBurst')">&#x2725; Pan</button>
        </span>
        <span>
          <button onclick="exportCSV('networkBurst')">&#11015; CSV</button>
          <button onclick="exportPNG('networkBurst')">&#11015; PNG</button>
        </span>
      </div>
      <div class="chart-extra">
        <select id="nb-bin"><option value="0.05">50ms</option><option value="0.1" selected>100ms</option>
        <option value="0.25">250ms</option><option value="0.5">500ms</option></select>
        <label>&#963;: <input type="range" id="nb-sigma" min="0.5" max="5" value="2" step="0.5">
        <span id="nb-sigma-val">2.0</span></label>
        <label>Smooth: <input type="range" id="nb-smooth" min="1" max="10" value="1"></label>
        <label><input type="checkbox" id="nb-thresh" checked> Threshold line</label>
      </div>
      <canvas id="networkBurstChart"></canvas>
    </div>

    <div class="chart-container" id="pca-container" style="display:none">
      <div class="chart-header">
        <h3>Spike Waveform PCA</h3>
        <span id="pca-subtitle" class="chart-subtitle">PC1 vs PC2 &#8212; colored by channel</span>
      </div>
      <div class="chart-controls">
        <span>
          <button onclick="ChartRegistry.get('pca')?.zoom(1.2)">&#xFF0B;</button>
          <button onclick="ChartRegistry.get('pca')?.zoom(0.8)">&#xFF0D;</button>
          <button onclick="ChartRegistry.get('pca')?.resetZoom()">&#x27F3;</button>
          <button onclick="togglePan('pca')">&#x2725; Pan</button>
        </span>
        <span>
          <button onclick="exportCSV('pca')">&#11015; CSV</button>
          <button onclick="exportPNG('pca')">&#11015; PNG</button>
        </span>
      </div>
      <div class="chart-extra">
        <label>Size: <input type="range" id="pca-sz" min="1" max="10" value="3" step="0.5"></label>
        <label>Opacity: <input type="range" id="pca-op" min="10" max="100" value="75"></label>
        <select id="pca-color"><option value="channel">By Channel</option>
        <option value="time">By Time</option><option value="amplitude">By Amplitude</option></select>
        <div id="pca-ch-filter"></div>
      </div>
      <canvas id="pcaChart"></canvas>
    </div>
  </div>
</main>

<footer>Brainwave · client-side HD-MEA viewer · all data processed locally in WebAssembly</footer>

<script>
// ─── DOM refs ───────────────────────────────────────────────────────────────
const uploadZone   = document.getElementById('upload-zone');
const fileInput    = document.getElementById('file-input');
const statusBar    = document.getElementById('status-bar');
const statusMsg    = document.getElementById('status-msg');
const bannerWarn   = document.getElementById('banner-warn');
const bannerError  = document.getElementById('banner-error');
const bannerInfo   = document.getElementById('banner-info');
const infoPanel    = document.getElementById('info-panel');
const infoGrid     = document.getElementById('info-grid');
const controls     = document.getElementById('controls');
const channelCtrl  = document.getElementById('channel-ctrl');
const channelSel   = document.getElementById('channel-select');
const timeCtrl     = document.getElementById('time-ctrl');
const timeSlider   = document.getElementById('time-slider');
const timeLabel    = document.getElementById('time-label');
const chartsGrid   = document.getElementById('charts-grid');
const cardRaw      = document.getElementById('card-raw');
const cardRaster   = document.getElementById('card-raster');
const cardWaveform = document.getElementById('card-waveform');

// ─── State ──────────────────────────────────────────────────────────────────
let pyodide = null;
let parsedData = null;
let rawChart = null;
let rasterChart = null;
let waveformChart = null;
const WINDOW_SEC = 3;
const MAX_WAVEFORMS_PER_CHANNEL = 50;

// ─── Chart Registry ──────────────────────────────────────────────────────────
const ChartRegistry = {
  instances: {},
  register(name, inst) { this.instances[name] = inst; },
  get(name) { return this.instances[name]; },
  getAll() { return Object.values(this.instances).filter(Boolean); },
  resetAllZoom() { this.getAll().forEach(c => { try { c.resetZoom(); } catch(e){} }); }
};

const ZOOM_CONFIG = (mode) => {
  mode = mode || 'xy';
  return {
    zoom: { wheel:{enabled:true,speed:0.1}, pinch:{enabled:true}, mode: mode },
    pan:  { enabled:false, mode: mode, threshold:5 }
  };
};

function togglePan(name) {
  var c = ChartRegistry.get(name); if(!c) return;
  c.options.plugins.zoom.pan.enabled = !c.options.plugins.zoom.pan.enabled;
  c.update('none');
}

let animOn = true, gridOn = true;

// ─── Helpers ────────────────────────────────────────────────────────────────
function setStatus(msg) {
  statusBar.classList.add('visible');
  statusMsg.textContent = msg;
}
function hideStatus() { statusBar.classList.remove('visible'); }

function showError(msg) {
  bannerError.textContent = '⚠ ' + msg;
  bannerError.classList.add('visible');
}
function showWarn(msg) {
  bannerWarn.textContent = '⚠ ' + msg;
  bannerWarn.classList.add('visible');
}
function showInfo(msg) {
  bannerInfo.textContent = 'ℹ ' + msg;
  bannerInfo.classList.add('visible');
}
function clearBanners() {
  [bannerError, bannerWarn, bannerInfo].forEach(b => {
    b.classList.remove('visible');
    b.textContent = '';
  });
}

function infoCard(label, value) {
  return '<div class="info-card"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
}

function destroyChart(ref) { if (ref) { ref.destroy(); } }

// ─── Pyodide init ───────────────────────────────────────────────────────────
async function initPyodide() {
  if (pyodide) return pyodide;
  setStatus('Loading Pyodide WebAssembly runtime…');
  pyodide = await loadPyodide();
  // Attempt to grow the WASM heap so larger files can be processed
  try {
    pyodide._module.wasmMemory.grow(4096); // +256 MiB (each page = 64 KiB)
  } catch(e) {
    console.warn('Could not grow WASM memory:', e);
  }
  setStatus('Installing h5py and numpy…');
  await pyodide.loadPackage(['h5py', 'numpy']);
  console.info('[Brainwave] Pyodide version:', pyodide.version);
  return pyodide;
}

// ─── Upload events ──────────────────────────────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files.length) handleFile(fileInput.files[0]); });

// ─── Main file handler ──────────────────────────────────────────────────────
async function handleFile(file) {
  clearBanners();
  infoPanel.classList.remove('visible');
  controls.classList.remove('visible');
  chartsGrid.classList.remove('visible');
  [cardRaw, cardRaster, cardWaveform].forEach(c => c.style.display = 'none');
  ['raster-container', 'firing-rate-container', 'network-burst-container', 'pca-container'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  destroyChart(rawChart);      rawChart      = null;
  destroyChart(rasterChart);   rasterChart   = null;
  destroyChart(waveformChart); waveformChart = null;
  if (window.rasterChartInstance)       { window.rasterChartInstance.destroy();       window.rasterChartInstance       = null; }
  if (window.firingRateChartInstance)   { window.firingRateChartInstance.destroy();   window.firingRateChartInstance   = null; }
  if (window.networkBurstChartInstance) { window.networkBurstChartInstance.destroy(); window.networkBurstChartInstance = null; }
  if (window.pcaChartInstance)          { window.pcaChartInstance.destroy();          window.pcaChartInstance          = null; }
  if (window.waveformChartInstance)     { window.waveformChartInstance.destroy();     window.waveformChartInstance     = null; }
  ChartRegistry.instances = {};
  var toolbar = document.getElementById('global-toolbar');
  if (toolbar) toolbar.style.display = 'none';

  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'brw' && ext !== 'bxr') {
    showError('Invalid file format. Please upload a .brw or .bxr file.');
    return;
  }

  try {
    const MAX_FILE_SIZE_MB = 200;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new Error(
        'File size (' + (file.size / 1024 / 1024).toFixed(1) + ' MB) exceeds the ' +
        MAX_FILE_SIZE_MB + ' MB limit for in-browser processing. ' +
        'Consider using a smaller recording interval or a BXR results file instead.'
      );
    }

    const py = await initPyodide();
    setStatus('Reading file…');
    const buffer = await file.arrayBuffer();
    const uint8  = new Uint8Array(buffer);

    setStatus('Transferring to Python runtime…');
    // Encode as base64 string so Python receives a plain str with no JsProxy issues.
    // This avoids .tobytes() / .to_py() version-compatibility problems across Pyodide releases.
    let binary = '';
    const chunkSize = 8192; // chosen to stay well within apply() argument limits on all browsers
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
    }
    py.globals.set('file_data_b64', btoa(binary));
    py.globals.set('file_name', file.name);

    setStatus('Parsing HDF5 structure…');

    const result = await py.runPythonAsync(PYTHON_PARSER);
    const pythonResult = result instanceof py.ffi.PyProxy ? result.toJs({ dict_converter: Object.fromEntries }) : result;
    parsedData   = typeof pythonResult === 'string' ? JSON.parse(pythonResult) : pythonResult;

    if (parsedData.error) { showError(parsedData.error); hideStatus(); return; }
    if (parsedData.warning) showWarn(parsedData.warning);
    if (parsedData.info)    showInfo(parsedData.info);

    setStatus('Rendering charts…');
    hideStatus();
    renderInfoPanel(parsedData);
    renderCharts(parsedData);

  } catch (err) {
    hideStatus();
    showError('Parsing failed: ' + (err.message || String(err)));
    console.error(err);
  }
}

// ─── Info panel ─────────────────────────────────────────────────────────────
function renderInfoPanel(d) {
  const meta = d.meta;
  let html = '';
  html += infoCard('File Type',        meta.file_type);
  html += infoCard('Sampling Rate',    meta.sampling_rate + ' Hz');
  html += infoCard('Plate Model',      meta.plate_model || '—');
  html += infoCard('Stored Channels',  meta.num_channels);
  html += infoCard('Duration',         meta.duration_sec != null ? meta.duration_sec.toFixed(2) + ' s' : '—');
  if (meta.file_type === 'BXR') {
    html += infoCard('Spikes Detected', meta.num_spikes != null ? meta.num_spikes.toLocaleString() : '—');
  }
  if (pyodide) {
    html += infoCard('Pyodide', pyodide.version);
  }
  infoGrid.innerHTML = html;
  infoPanel.classList.add('visible');
}

// ─── Chart rendering ─────────────────────────────────────────────────────────
const COLORS = ['#00e5ff','#7b61ff','#ff9f43','#2ed573','#ff4757','#eccc68'];

function renderCharts(d) {
  chartsGrid.classList.add('visible');

  const fileType = d.meta && d.meta.file_type ? d.meta.file_type.toUpperCase() : '';
  const isBrw = fileType === 'BRW';
  const isBxr = fileType === 'BXR';

  // ── RAW SIGNAL CHART — BRW only ───────────────────────────────────────────
  if (d.raw_signal) {
    renderRawChart(d.raw_signal, d.meta.sampling_rate);
    cardRaw.style.display = 'flex';

    const maxStart = Math.max(0, (d.meta.duration_sec || WINDOW_SEC) - WINDOW_SEC);
    timeSlider.max   = Math.floor(maxStart);
    timeSlider.value = 0;
    timeLabel.textContent = '0 – ' + WINDOW_SEC + ' s';
    timeCtrl.style.display = 'flex';
    controls.classList.add('visible');

    timeSlider.oninput = () => {
      const start = parseInt(timeSlider.value, 10);
      timeLabel.textContent = start + ' – ' + (start + WINDOW_SEC) + ' s';
      renderRawChartWindow(d.raw_signal, d.meta.sampling_rate, start);
    };
  } else {
    cardRaw.style.display = 'none';
  }

  // ── WAVEFORM CHART — both file types (uses unified waveform_data format) ──
  if (d.waveform_data && Object.keys(d.waveform_data).length > 0) {
    cardWaveform.style.display = 'flex';
    const channels = Object.keys(d.waveform_data);
    channelSel.innerHTML = channels.map(ch => '<option value="' + ch + '">Channel ' + ch + '</option>').join('');
    channelCtrl.style.display = 'flex';
    controls.classList.add('visible');
    drawWaveformsForChannel(channels[0], d.waveform_data, d.waveform_length || 58, d.meta.sampling_rate);
    channelSel.onchange = (e) => {
      if (window.waveformChartInstance) { window.waveformChartInstance.destroy(); window.waveformChartInstance = null; }
      drawWaveformsForChannel(e.target.value, d.waveform_data, d.waveform_length || 58, d.meta.sampling_rate);
    };
  } else {
    cardWaveform.style.display = 'none';
  }

  // ── ALWAYS show all four analytics chart containers ───────────────────────
  ['raster-container', 'firing-rate-container',
   'network-burst-container', 'pca-container'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  });

  // ── RASTER PLOT ───────────────────────────────────────────────────────────
  const rasterTitle = document.querySelector('#raster-container h3');
  if (rasterTitle) {
    rasterTitle.textContent = isBrw ? 'Spike Raster Plot (threshold-detected)' : 'Spike Raster Plot';
  }
  const rasterSubtitle = document.querySelector('#raster-container .chart-subtitle');
  if (rasterSubtitle) {
    rasterSubtitle.textContent = d.spike_times_sec && d.spike_times_sec.length > 0
      ? d.spike_times_sec.length + ' spikes across ' + d.total_duration_sec + 's'
      : 'No spikes detected';
  }
  renderRasterPlot(d);

  // ── MEAN FIRING RATE ──────────────────────────────────────────────────────
  const frTitle = document.querySelector('#firing-rate-container h3');
  if (frTitle) {
    frTitle.textContent = isBrw ? 'Mean Firing Rate (threshold-detected)' : 'Mean Firing Rate';
  }
  renderFiringRateChart(d);

  // ── NETWORK BURST FREQUENCY ───────────────────────────────────────────────
  const nbTitle = document.querySelector('#network-burst-container h3');
  if (nbTitle) {
    nbTitle.textContent = isBrw ? 'Population Activity (100ms bins)' : 'Network Burst Frequency (100ms bins)';
  }
  renderNetworkBurstChart(d);

  // ── PCA PLOT ──────────────────────────────────────────────────────────────
  const pcaTitle = document.querySelector('#pca-container h3');
  if (pcaTitle) {
    pcaTitle.textContent = isBrw ? 'Spike Waveform PCA (threshold-detected)' : 'Spike Waveform PCA';
  }

  if (isBrw && d.n_spikes_detected === 0) {
    const pcaContainer = document.getElementById('pca-container');
    if (pcaContainer) {
      const existing = pcaContainer.querySelector('.empty-state');
      if (!existing) {
        const div = document.createElement('div');
        div.className = 'empty-state';
        div.textContent = 'No spikes detected above ' + (d.spike_detection_method || 'threshold') +
          '. Try a longer recording or a file with active neurons.';
        pcaContainer.appendChild(div);
      }
    }
  } else {
    renderPcaChart(d);
  }

  // ── UPDATE INFO PANEL with spike detection info for BRW ───────────────────
  if (isBrw) {
    const infoExtra = document.getElementById('info-spike-detection');
    if (infoExtra) {
      infoExtra.textContent =
        'Spikes detected: ' + d.n_spikes_detected + ' (' + d.spike_detection_method + ')';
    }
  }

  // ── Show global toolbar ───────────────────────────────────────────────────
  var toolbar = document.getElementById('global-toolbar');
  if (toolbar) toolbar.style.display = 'flex';

  // ── Wire interactivity (after a tick to let charts paint) ─────────────────
  window._result = d;
  setTimeout(function() {
    wireGlobalToolbar();
    wireRawSignal(d);
    wireRaster(d);
    wireNetworkBurst(d);
    wirePca(d);
    wireWaveform(d);
  }, 100);
}

function rawChartDatasets(rawSignal, samplingRate, startSec) {
  const startSample = Math.round(startSec * samplingRate);
  const endSample   = Math.round((startSec + WINDOW_SEC) * samplingRate);
  const datasets = [];
  rawSignal.channels.forEach((ch, i) => {
    const slice = ch.analog.slice(startSample, endSample);
    const data  = Array.from(slice).map((v, j) => ({ x: startSec + j / samplingRate, y: v }));
    datasets.push({
      label:           'Ch ' + ch.index,
      data,
      borderColor:     COLORS[i % COLORS.length],
      borderWidth:     1,
      pointRadius:     0,
      tension:         0,
    });
  });
  return datasets;
}

function renderRawChart(rawSignal, samplingRate) {
  destroyChart(rawChart);
  const ctx = document.getElementById('chart-raw').getContext('2d');
  rawChart = new Chart(ctx, {
    type: 'line',
    data: { datasets: rawChartDatasets(rawSignal, samplingRate, 0) },
    options: rawChartOptions(),
  });
  ChartRegistry.register('rawSignal', rawChart);
}

function renderRawChartWindow(rawSignal, samplingRate, startSec) {
  if (!rawChart) return;
  rawChart.data.datasets = rawChartDatasets(rawSignal, samplingRate, startSec);
  rawChart.options.scales.x.min = startSec;
  rawChart.options.scales.x.max = startSec + WINDOW_SEC;
  rawChart.update('none');
}

function rawChartOptions() {
  return {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#cdd6f4', boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + ' µV' } },
      zoom: ZOOM_CONFIG(),
    },
    scales: {
      x: {
        type: 'linear',
        min: 0, max: WINDOW_SEC,
        title: { display: true, text: 'Time (s)', color: '#6c7a99' },
        ticks: { color: '#6c7a99', maxTicksLimit: 8 },
        grid:  { color: '#1e2435' },
      },
      y: {
        title: { display: true, text: 'Amplitude (µV)', color: '#6c7a99' },
        ticks: { color: '#6c7a99' },
        grid:  { color: '#1e2435' },
      },
    },
  };
}

function renderRasterChart(spikeRaster) {
  destroyChart(rasterChart);
  const ctx = document.getElementById('chart-raster').getContext('2d');
  // Group by channel for coloring
  const byChannel = {};
  spikeRaster.forEach(pt => {
    if (!byChannel[pt.ch]) byChannel[pt.ch] = [];
    byChannel[pt.ch].push({ x: pt.t, y: pt.ch });
  });
  const datasets = Object.entries(byChannel).map(([ch, data], i) => ({
    label:           'Ch ' + ch,
    data,
    backgroundColor: COLORS[i % COLORS.length] + '99',
    pointRadius:     3,
    pointStyle:      'rect',
    showLine:        false,
  }));
  rasterChart = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => 'Ch ' + ctx.parsed.y + '  @  ' + ctx.parsed.x.toFixed(3) + ' s' } },
      },
      scales: {
        x: {
          min: 0, max: 10,
          title: { display: true, text: 'Time (s)', color: '#6c7a99' },
          ticks: { color: '#6c7a99' },
          grid:  { color: '#1e2435' },
        },
        y: {
          title: { display: true, text: 'Channel Index', color: '#6c7a99' },
          ticks: { color: '#6c7a99', stepSize: 1 },
          grid:  { color: '#1e2435' },
        },
      },
    },
  });
}

function renderWaveformChart(spikeWaveforms, chIdx, samplingRate) {
  // Legacy wrapper — kept for safety; new code paths use drawWaveformsForChannel directly
  const waveformData = {};
  Object.entries(spikeWaveforms).forEach(([ch, wfs]) => { waveformData[String(ch)] = wfs; });
  const waveformLength = waveformData[String(chIdx)] && waveformData[String(chIdx)][0]
    ? waveformData[String(chIdx)][0].length : 58;
  drawWaveformsForChannel(String(chIdx), waveformData, waveformLength, samplingRate);
}

function drawWaveformsForChannel(chKey, waveformData, waveformLength, samplingRate) {
  if (window.waveformChartInstance) { window.waveformChartInstance.destroy(); window.waveformChartInstance = null; }
  const canvas = document.getElementById('chart-waveform');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const waveforms = waveformData[chKey] || [];
  const samplePeriodMs = samplingRate > 0 ? (1000 / samplingRate) : (1000 / 20000);
  const timeAxis = Array.from({ length: waveformLength }, (_, i) => ((i - Math.floor(waveformLength / 2)) * samplePeriodMs).toFixed(2));

  const datasets = waveforms.slice(0, MAX_WAVEFORMS_PER_CHANNEL).map((wf, i) => ({
    label: i === 0 ? 'Ch ' + chKey : '',
    data: timeAxis.map((x, j) => ({ x: parseFloat(x), y: wf[j] !== undefined ? wf[j] : 0 })),
    borderColor: 'rgba(0, 229, 255, 0.2)',
    borderWidth: 1,
    pointRadius: 0,
    fill: false,
    tension: 0,
    showLine: true,
  }));

  // Mean waveform overlay
  if (waveforms.length > 1) {
    const meanWf = Array.from({ length: waveformLength }, (_, t) => {
      const vals = waveforms.map(w => (w[t] !== undefined ? w[t] : 0));
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    datasets.push({
      label: 'Mean',
      data: timeAxis.map((x, t) => ({ x: parseFloat(x), y: meanWf[t] })),
      borderColor: 'rgba(255, 220, 50, 0.95)',
      borderWidth: 2.5,
      pointRadius: 0,
      fill: false,
      tension: 0.3,
      showLine: true,
    });
  }

  window.waveformChartInstance = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#6c7a99', filter: item => item.text !== '' }
        },
        zoom: ZOOM_CONFIG(),
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Time (ms)', color: '#6c7a99' },
          ticks: { color: '#6c7a99' },
          grid:  { color: '#1e2435' },
        },
        y: {
          title: { display: true, text: 'Amplitude (\u00b5V)', color: '#6c7a99' },
          ticks: { color: '#6c7a99' },
          grid:  { color: '#1e2435' },
        },
      },
    },
  });
  ChartRegistry.register('waveform', window.waveformChartInstance);
}

// ─── Python parser (runs in Pyodide) ────────────────────────────────────────

function renderRasterPlot(result) {
  const ctx = document.getElementById('rasterChart').getContext('2d');

  const spikeTimes = result.spike_times_sec;
  const spikeChIdxs = result.spike_ch_idxs;
  const uniqueChannels = [...new Set(spikeChIdxs)].sort((a, b) => a - b);

  // Map each channel to a y-axis position (0 = bottom channel)
  const chToY = {};
  uniqueChannels.forEach((ch, i) => { chToY[ch] = i; });

  // Build scatter dataset — one point per spike
  const points = spikeTimes.map((t, i) => ({
    x: t,
    y: chToY[spikeChIdxs[i]]
  }));

  // Limit to 2000 points for performance (browser scatter rendering slows above this)
  const MAX_RASTER_POINTS = 2000;
  const displayPoints = points.length > MAX_RASTER_POINTS
    ? points.filter((_, i) => i % Math.ceil(points.length / MAX_RASTER_POINTS) === 0)
    : points;

  if (window.rasterChartInstance) window.rasterChartInstance.destroy();
  window.rasterChartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Spike',
        data: displayPoints,
        pointRadius: 1.5,
        pointHoverRadius: 4,
        backgroundColor: 'rgba(0, 255, 180, 0.6)',
        borderColor: 'rgba(0, 255, 180, 0.8)',
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => 'Time: ' + ctx.parsed.x.toFixed(3) + 's  Ch: ' + uniqueChannels[ctx.parsed.y]
          }
        },
        zoom: ZOOM_CONFIG(),
      },
      scales: {
        x: {
          title: { display: true, text: 'Time (s)', color: '#aaa' },
          ticks: { color: '#aaa' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          title: { display: true, text: 'Channel', color: '#aaa' },
          ticks: {
            color: '#aaa',
            callback: val => uniqueChannels[Math.round(val)] !== undefined
              ? 'Ch ' + uniqueChannels[Math.round(val)]
              : ''
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
          min: -0.5,
          max: uniqueChannels.length - 0.5
        }
      }
    }
  });
  ChartRegistry.register('raster', window.rasterChartInstance);
}

function renderFiringRateChart(result) {
  const ctx = document.getElementById('firingRateChart').getContext('2d');

  const labels = result.firing_rate_labels;
  const values = result.firing_rate_values;

  // Color bars by firing rate intensity (low=blue, high=red) using gradient
  const maxRate = Math.max(...values);
  const barColors = values.map(v => {
    const ratio = maxRate > 0 ? v / maxRate : 0;
    const r = Math.round(50 + ratio * 205);
    const g = Math.round(150 - ratio * 100);
    const b = Math.round(255 - ratio * 200);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', 0.85)';
  });

  if (window.firingRateChartInstance) window.firingRateChartInstance.destroy();
  window.firingRateChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Firing Rate (Hz)',
        data: values,
        backgroundColor: barColors,
        borderColor: barColors.map(c => c.replace('0.85', '1')),
        borderWidth: 1,
        borderRadius: 3
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 600 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ctx.parsed.y.toFixed(2) + ' Hz'
          }
        },
        zoom: ZOOM_CONFIG(),
      },
      scales: {
        x: {
          title: { display: true, text: 'Channel', color: '#aaa' },
          ticks: {
            color: '#aaa',
            maxRotation: 45,
            // Show every Nth label to avoid crowding
            callback: (val, i) => i % Math.ceil(labels.length / 20) === 0
              ? labels[i]
              : ''
          },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          title: { display: true, text: 'Firing Rate (Hz)', color: '#aaa' },
          ticks: { color: '#aaa' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: true
        }
      }
    }
  });
  ChartRegistry.register('firingRate', window.firingRateChartInstance);
}

function renderNetworkBurstChart(result) {
  const ctx = document.getElementById('networkBurstChart').getContext('2d');
  const nb = result.network_burst;

  // Color each bar: burst bins = bright orange, normal bins = dim teal
  const barColors = nb.spike_counts.map((count, i) =>
    nb.is_burst[i]
      ? 'rgba(255, 160, 50, 0.9)'
      : 'rgba(50, 200, 180, 0.5)'
  );

  // Threshold line dataset
  const thresholdLine = nb.bin_centers_sec.map(() => nb.burst_threshold);

  if (window.networkBurstChartInstance) window.networkBurstChartInstance.destroy();
  window.networkBurstChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: nb.bin_centers_sec.map(t => t.toFixed(2)),
      datasets: [
        {
          label: 'Spike Count',
          data: nb.spike_counts,
          backgroundColor: barColors,
          borderColor: barColors,
          borderWidth: 0,
          borderRadius: 2,
          order: 2
        },
        {
          label: 'Burst Threshold (' + nb.burst_threshold.toFixed(1) + ')',
          data: thresholdLine,
          type: 'line',
          borderColor: 'rgba(255, 80, 80, 0.9)',
          borderWidth: 2,
          borderDash: [6, 3],
          pointRadius: 0,
          fill: false,
          tension: 0,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#ccc', boxWidth: 16, padding: 12 }
        },
        tooltip: {
          callbacks: {
            title: items => 'Time: ' + items[0].label + 's',
            label: ctx => ctx.datasetIndex === 0
              ? 'Spikes: ' + ctx.parsed.y
              : 'Threshold: ' + ctx.parsed.y.toFixed(1)
          }
        },
        zoom: ZOOM_CONFIG(),
      },
      scales: {
        x: {
          title: { display: true, text: 'Time (s)', color: '#aaa' },
          ticks: {
            color: '#aaa',
            maxRotation: 0,
            callback: (val, i) => i % Math.ceil(nb.bin_centers_sec.length / 10) === 0
              ? nb.bin_centers_sec[i].toFixed(1)
              : ''
          },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          title: { display: true, text: 'Spike Count / 100ms', color: '#aaa' },
          ticks: { color: '#aaa' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: true
        }
      }
    }
  });
  ChartRegistry.register('networkBurst', window.networkBurstChartInstance);
}

function renderPcaChart(result) {
  if (!result.pca) return;
  const ctx = document.getElementById('pcaChart').getContext('2d');
  const pca = result.pca;

  // Update subtitle with variance explained
  if (pca.pc1_variance_pct > 0) {
    document.getElementById('pca-subtitle').textContent =
      'PC1 (' + pca.pc1_variance_pct + '%) vs PC2 (' + pca.pc2_variance_pct + '%) \u2014 colored by channel \u2014 ' + pca.n_spikes_used + ' spikes';
  }

  // 8 distinct neon colors for channel groups
  const PCA_COLORS = [
    'rgba(0,   255, 180, 0.75)',  // teal
    'rgba(255, 100,  80, 0.75)',  // coral
    'rgba(100, 180, 255, 0.75)',  // sky blue
    'rgba(255, 220,  50, 0.75)',  // yellow
    'rgba(200, 100, 255, 0.75)',  // purple
    'rgba(50,  255, 100, 0.75)',  // green
    'rgba(255, 160,  50, 0.75)',  // orange
    'rgba(255,  80, 180, 0.75)',  // pink
  ];

  // Group points by color_id to create one dataset per channel group
  // This allows Chart.js legend to show channel groups
  const groupedDatasets = {};
  pca.pc1.forEach((x, i) => {
    const colorId = pca.color_ids[i];
    const chIdx = pca.channel_idxs[i];
    if (!groupedDatasets[colorId]) {
      groupedDatasets[colorId] = {
        label: 'Ch ' + (pca.unique_channels[colorId] ?? colorId),
        data: [],
        backgroundColor: PCA_COLORS[colorId % 8],
        pointRadius: 3,
        pointHoverRadius: 6
      };
    }
    groupedDatasets[colorId].data.push({ x, y: pca.pc2[i], chIdx });
  });

  if (window.pcaChartInstance) window.pcaChartInstance.destroy();
  window.pcaChartInstance = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: Object.values(groupedDatasets) },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#ccc', boxWidth: 12, padding: 10, pointStyle: 'circle' }
        },
        tooltip: {
          callbacks: {
            label: ctx => [
              'Ch: ' + ctx.raw.chIdx,
              'PC1: ' + ctx.parsed.x.toFixed(3),
              'PC2: ' + ctx.parsed.y.toFixed(3)
            ]
          }
        },
        zoom: ZOOM_CONFIG(),
      },
      scales: {
        x: {
          title: {
            display: true,
            text: pca.pc1_variance_pct > 0
              ? 'PC1 (' + pca.pc1_variance_pct + '% variance)'
              : 'PC1',
            color: '#aaa'
          },
          ticks: { color: '#aaa' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          title: {
            display: true,
            text: pca.pc2_variance_pct > 0
              ? 'PC2 (' + pca.pc2_variance_pct + '% variance)'
              : 'PC2',
            color: '#aaa'
          },
          ticks: { color: '#aaa' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
  ChartRegistry.register('pca', window.pcaChartInstance);
}

// ─── Global toolbar wiring ────────────────────────────────────────────────────
function wireGlobalToolbar() {
  var btnAnim = document.getElementById('btn-anim');
  var btnGrid = document.getElementById('btn-grid');

  if (btnAnim) {
    btnAnim.onclick = null;
    btnAnim.addEventListener('click', function() {
      animOn = !animOn;
      ChartRegistry.getAll().forEach(function(c) {
        c.options.animation = animOn ? {duration:400} : false;
        c.update('none');
      });
      this.textContent = '\u25C6 Animations: ' + (animOn ? 'ON' : 'OFF');
    });
  }

  if (btnGrid) {
    btnGrid.onclick = null;
    btnGrid.addEventListener('click', function() {
      gridOn = !gridOn;
      var col = gridOn ? 'rgba(255,255,255,0.05)' : 'transparent';
      ChartRegistry.getAll().forEach(function(c) {
        ['x','y'].forEach(function(a) {
          if (c.options.scales && c.options.scales[a] && c.options.scales[a].grid) {
            c.options.scales[a].grid.color = col;
          }
        });
        c.update('none');
      });
      this.textContent = '\u229E Grid: ' + (gridOn ? 'ON' : 'OFF');
    });
  }
}

// ─── Per-chart wire functions ────────────────────────────────────────────────
function wireRawSignal(result) {
  var chart = ChartRegistry.get('rawSignal');
  if (!chart || !result.raw_signal || !result.raw_signal.channels) return;
  var channels = result.raw_signal.channels;
  var sr = result.meta.sampling_rate;
  var src = {};
  channels.forEach(function(ch) { src[String(ch.index)] = ch.analog; });
  var keys = Object.keys(src);
  var dur = keys.length > 0 ? src[keys[0]].length / sr : 0;

  function rebuild() {
    var t0 = (document.getElementById('raw-t-start').value / 100) * dur;
    var t1 = (document.getElementById('raw-t-end').value / 100) * dur;
    var i0 = Math.floor(t0 * sr), i1 = Math.ceil(t1 * sr);
    chart.data.datasets.forEach(function(ds, i) {
      var key = keys[i];
      if (key) ds.data = src[key].slice(i0, i1).map(function(v, j) { return {x: t0 + j/sr, y: v}; });
    });
    chart.update('none');
  }

  ['raw-t-start','raw-t-end'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', rebuild);
  });

  var container = document.getElementById('raw-ch-toggles');
  if (container) {
    container.innerHTML = '';
    keys.forEach(function(ch, i) {
      var lbl = document.createElement('label');
      lbl.className = 'toggle-label';
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = true;
      cb.onchange = function() { chart.data.datasets[i].hidden = !cb.checked; chart.update('none'); };
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(' Ch' + ch));
      container.appendChild(lbl);
    });
  }

  var offsetEl = document.getElementById('raw-offset');
  if (offsetEl) {
    offsetEl.onchange = null;
    offsetEl.addEventListener('change', function() {
      var checked = this.checked;
      chart.data.datasets.forEach(function(ds, i) {
        var key = keys[i];
        if (!key) return;
        ds.data = src[key].map(function(v, j) { return {x: j/sr, y: checked ? v + i*150 : v}; });
      });
      chart.update('none');
    });
  }
}

function wireRaster(result) {
  var chart = ChartRegistry.get('raster');
  if (!chart) return;
  var allT = result.spike_times_sec;
  var allCh = result.spike_ch_idxs;
  var dur = result.total_duration_sec;
  var uniqueChs = [...new Set(allCh)].sort(function(a,b){return a-b;});
  var chToY = {};
  uniqueChs.forEach(function(c, i) { chToY[c] = i; });
  var RCOLORS = ['#00ffb4','#ff6450','#64b4ff','#ffdc32','#c864ff','#32ff64','#ffa032','#ff50b4'];

  function rebuild() {
    var t0 = (document.getElementById('rst-t0').value / 100) * dur;
    var t1 = (document.getElementById('rst-t1').value / 100) * dur;
    var sz = parseFloat(document.getElementById('rst-sz').value);
    var colorBy = document.getElementById('rst-color').value;
    var pts = allT.map(function(t, i) { return {t:t, ch:allCh[i]}; })
      .filter(function(p) { return p.t >= t0 && p.t <= t1; })
      .map(function(p) { return {x:p.t, y:chToY[p.ch], ch:p.ch}; });
    chart.data.datasets[0].data = pts;
    chart.data.datasets[0].pointRadius = sz;
    chart.data.datasets[0].backgroundColor = pts.map(function(p) {
      if (colorBy === 'channel') return RCOLORS[uniqueChs.indexOf(p.ch) % 8] + 'aa';
      if (colorBy === 'time') return 'hsla(' + (200 + (p.x/dur)*160) + ',90%,60%,0.7)';
      return 'rgba(0,255,180,0.6)';
    });
    chart.update('none');
  }

  ['rst-t0','rst-t1','rst-sz','rst-color'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener('input', rebuild); el.addEventListener('change', rebuild); }
  });

  var rasterCanvas = document.getElementById('rasterChart');
  if (rasterCanvas) {
    rasterCanvas.addEventListener('click', function(evt) {
      var pts = chart.getElementsAtEventForMode(evt, 'nearest', {intersect:true}, false);
      if (!pts.length) return;
      var p = chart.data.datasets[0].data[pts[0].index];
      var box = document.getElementById('rst-detail');
      if (box) { box.textContent = 'Time: ' + p.x.toFixed(4) + 's  Channel: ' + p.ch; box.style.display = 'block'; }
    });
  }
}

function wireNetworkBurst(result) {
  var chart = ChartRegistry.get('networkBurst');
  if (!chart) return;
  var allT = result.spike_times_sec;
  var dur = result.total_duration_sec;

  function rebuild() {
    var bin = parseFloat(document.getElementById('nb-bin').value);
    var sigma = parseFloat(document.getElementById('nb-sigma').value);
    var smooth = parseInt(document.getElementById('nb-smooth').value);
    var showThresh = document.getElementById('nb-thresh').checked;
    var sigmaVal = document.getElementById('nb-sigma-val');
    if (sigmaVal) sigmaVal.textContent = sigma.toFixed(1);

    var nBins = Math.max(1, Math.ceil(dur / bin));
    var counts = new Array(nBins).fill(0);
    allT.forEach(function(t) { var b = Math.min(Math.floor(t/bin), nBins-1); counts[b]++; });

    if (smooth > 1) {
      counts = counts.map(function(_, i) {
        var sl = counts.slice(Math.max(0, i - Math.floor(smooth/2)), Math.min(nBins, i + Math.ceil(smooth/2)));
        return sl.reduce(function(a,b){return a+b;}, 0) / sl.length;
      });
    }

    var mean = counts.reduce(function(a,b){return a+b;}, 0) / counts.length;
    var std = Math.sqrt(counts.map(function(c){return (c-mean)*(c-mean);}).reduce(function(a,b){return a+b;}, 0) / counts.length);
    var thresh = mean + sigma * std;

    chart.data.labels = counts.map(function(_, i) { return ((i + 0.5) * bin).toFixed(2); });
    chart.data.datasets[0].data = counts;
    chart.data.datasets[0].backgroundColor = counts.map(function(c) {
      return c > thresh ? 'rgba(255,160,50,0.9)' : 'rgba(50,200,180,0.5)';
    });
    if (chart.data.datasets[1]) {
      chart.data.datasets[1].data = showThresh ? counts.map(function(){return thresh;}) : [];
    }
    chart.update('none');
  }

  ['nb-bin','nb-sigma','nb-smooth','nb-thresh'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener('input', rebuild); el.addEventListener('change', rebuild); }
  });
}

function wirePca(result) {
  var chart = ChartRegistry.get('pca');
  if (!chart) return;
  var pca = result.pca;

  var szEl = document.getElementById('pca-sz');
  if (szEl) {
    szEl.addEventListener('input', function() {
      var sz = parseFloat(this.value);
      chart.data.datasets.forEach(function(ds) { ds.pointRadius = sz; });
      chart.update('none');
    });
  }

  var opEl = document.getElementById('pca-op');
  if (opEl) {
    opEl.addEventListener('input', function() {
      var op = parseInt(this.value) / 100;
      var RGBA = [[0,255,180],[255,100,80],[100,180,255],[255,220,50],[200,100,255],[50,255,100],[255,160,50],[255,80,180]];
      chart.data.datasets.forEach(function(ds, i) {
        var rgb = RGBA[i % 8];
        ds.backgroundColor = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + op + ')';
      });
      chart.update('none');
    });
  }

  var fc = document.getElementById('pca-ch-filter');
  if (fc && pca && pca.unique_channels) {
    fc.innerHTML = '';
    pca.unique_channels.forEach(function(ch, i) {
      var lbl = document.createElement('label');
      lbl.className = 'toggle-label';
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = true;
      cb.onchange = function() { chart.data.datasets[i].hidden = !cb.checked; chart.update('none'); };
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(' Ch' + ch));
      fc.appendChild(lbl);
    });
  }
}

function wireWaveform(result) {
  var wfData = result.waveform_data || {};
  var wfLen = result.waveform_length || 58;
  var sr = result.meta && result.meta.sampling_rate ? result.meta.sampling_rate : 20000;

  function redraw() {
    var chEl = document.getElementById('channel-select');
    var ch = chEl ? chEl.value : null;
    if (!ch) return;
    var maxEl = document.getElementById('wf-max');
    var max = maxEl ? parseInt(maxEl.value) : 50;
    var showMean = document.getElementById('wf-mean') ? document.getElementById('wf-mean').checked : true;
    var showStd = document.getElementById('wf-std') ? document.getElementById('wf-std').checked : false;
    var norm = document.getElementById('wf-norm') ? document.getElementById('wf-norm').checked : false;
    var maxValEl = document.getElementById('wf-max-val');
    if (maxValEl) maxValEl.textContent = max;

    var wfs = (wfData[ch] || []).slice(0, max);
    if (norm) {
      wfs = wfs.map(function(w) {
        var pk = Math.max.apply(null, w.map(Math.abs)) || 1;
        return w.map(function(v) { return v / pk; });
      });
    }

    var tAxis = Array.from({length: wfLen}, function(_, i) { return ((i - 20) / sr * 1000); });
    var datasets = wfs.map(function(w, i) {
      return {
        label: i === 0 ? 'Ch' + ch : '',
        data: w.map(function(v, t) { return {x: tAxis[t], y: v}; }),
        borderColor: 'rgba(100,180,255,0.25)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false
      };
    });

    if (showMean && wfs.length) {
      var mean = tAxis.map(function(_, t) {
        return wfs.map(function(w) { return w[t] || 0; }).reduce(function(a,b){return a+b;}, 0) / wfs.length;
      });
      datasets.push({label:'Mean', data: mean.map(function(v, t){return {x:tAxis[t],y:v};}),
        borderColor:'rgba(255,220,50,0.95)', borderWidth:2.5, pointRadius:0, fill:false});
      if (showStd) {
        var std = tAxis.map(function(_, t) {
          var vals = wfs.map(function(w){return w[t]||0;}), m = mean[t];
          return Math.sqrt(vals.map(function(v){return (v-m)*(v-m);}).reduce(function(a,b){return a+b;},0)/vals.length);
        });
        datasets.push({label:'+SD', data: mean.map(function(m,i){return {x:tAxis[i],y:m+std[i]};}),
          borderColor:'rgba(255,220,50,0.3)', borderWidth:1, pointRadius:0, fill:false, borderDash:[4,2]});
        datasets.push({label:'-SD', data: mean.map(function(m,i){return {x:tAxis[i],y:m-std[i]};}),
          borderColor:'rgba(255,220,50,0.3)', borderWidth:1, pointRadius:0, fill:false, borderDash:[4,2]});
      }
    }

    var c = ChartRegistry.get('waveform');
    if (c) { c.data.datasets = datasets; c.update('none'); }
  }

  ['channel-select','wf-max','wf-mean','wf-std','wf-norm'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener('change', redraw); el.addEventListener('input', redraw); }
  });
}

// ─── Export functions ─────────────────────────────────────────────────────────
function exportCSV(name) {
  var c = ChartRegistry.get(name); if (!c) return;
  var header = ['label'].concat(c.data.datasets.map(function(d){return d.label||name;}));
  var maxLen = Math.max.apply(null, c.data.datasets.map(function(d){return d.data ? d.data.length : 0;}));
  var rows = [header];
  for (var i = 0; i < maxLen; i++) {
    var lbl = c.data.labels ? (c.data.labels[i] != null ? c.data.labels[i] : i) : i;
    var vals = c.data.datasets.map(function(d) {
      var v = d.data ? d.data[i] : null;
      if (v == null) return '';
      return typeof v === 'object' ? (v.x + ',' + v.y) : v;
    });
    rows.push([lbl].concat(vals));
  }
  var blob = new Blob([rows.map(function(r){return r.join(',');}).join('\\n')], {type:'text/csv'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'brainwave_' + name + '_' + Date.now() + '.csv';
  a.click();
}

function exportPNG(name) {
  var c = ChartRegistry.get(name); if (!c) return;
  var tmp = document.createElement('canvas');
  tmp.width = c.canvas.width; tmp.height = c.canvas.height;
  var ctx2 = tmp.getContext('2d');
  ctx2.fillStyle = '#1a1a2e';
  ctx2.fillRect(0, 0, tmp.width, tmp.height);
  ctx2.drawImage(c.canvas, 0, 0);
  var a = document.createElement('a');
  a.download = 'brainwave_' + name + '_' + Date.now() + '.png';
  a.href = tmp.toDataURL('image/png');
  a.click();
}

function exportAllCSV() {
  Object.keys(ChartRegistry.instances).forEach(function(n, i) {
    setTimeout(function(){exportCSV(n);}, i * 200);
  });
}

function exportAllPNG() {
  Object.keys(ChartRegistry.instances).forEach(function(n, i) {
    setTimeout(function(){exportPNG(n);}, i * 300);
  });
}

async function exportPDF() {
  var btn = document.getElementById('btn-export-pdf');
  if (btn) { btn.textContent = '\u23F3 Building PDF...'; btn.disabled = true; }
  try {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error('jsPDF not loaded');
    var pdf = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
    var W = pdf.internal.pageSize.getWidth(), M = 12;
    var r = window._result || {};

    pdf.setFillColor(15, 15, 30); pdf.rect(0, 0, W, 297, 'F');
    pdf.setTextColor(0, 220, 160); pdf.setFontSize(20);
    pdf.text('BrainWave HD-MEA Report', M, 28);
    pdf.setFontSize(10); pdf.setTextColor(180, 180, 180);
    pdf.text('Generated: ' + new Date().toLocaleString(), M, 40);
    var meta = r.meta || {};
    pdf.text('File: ' + (meta.file_type || '?').toUpperCase() + ' | Duration: ' + (r.total_duration_sec || '?') + 's | Channels: ' + (meta.num_channels || '?'), M, 48);

    var names = ['rawSignal','waveform','raster','firingRate','networkBurst','pca'];
    var titles = ['Raw Signal','Waveform','Raster Plot','Firing Rate','Network Burst','PCA'];
    for (var i = 0; i < names.length; i++) {
      var c = ChartRegistry.get(names[i]); if (!c) continue;
      pdf.addPage();
      pdf.setFillColor(15, 15, 30); pdf.rect(0, 0, W, 297, 'F');
      pdf.setTextColor(0, 220, 160); pdf.setFontSize(13);
      pdf.text(titles[i], M, 16);
      var tmp = document.createElement('canvas');
      tmp.width = c.canvas.width * 2; tmp.height = c.canvas.height * 2;
      var ctx2 = tmp.getContext('2d');
      ctx2.scale(2, 2);
      ctx2.fillStyle = '#0f0f1e';
      ctx2.fillRect(0, 0, c.canvas.width, c.canvas.height);
      ctx2.drawImage(c.canvas, 0, 0);
      var cw = W - M * 2, ch = Math.min(cw * (c.canvas.height / c.canvas.width), 230);
      pdf.addImage(tmp.toDataURL('image/png'), 'PNG', M, 22, cw, ch);
    }
    pdf.save('brainwave_report_' + Date.now() + '.pdf');
  } catch(e) {
    alert('PDF export failed: ' + e.message);
  } finally {
    if (btn) { btn.textContent = '\u2B07 PDF Report'; btn.disabled = false; }
  }
}

const PYTHON_PARSER = \`
import io, json, traceback, base64
import numpy as np
import h5py

def parse_file():
    result = {}
    buf  = None
    f    = None
    try:
        # file_data_b64 is a plain Python str (base64-encoded file bytes).
        # Using base64 transfer avoids JsProxy .tobytes()/.to_py() version
        # compatibility issues across all Pyodide releases.
        try:
            raw_bytes = base64.b64decode(file_data_b64)
        except Exception as decode_err:
            return json.dumps({"error": "File data missing or corrupt — base64 decode failed: " + str(decode_err)})
        buf  = io.BytesIO(raw_bytes)
        try:
            f = h5py.File(buf, 'r')
        except Exception:
            return json.dumps({"error": "Invalid file format. Please upload a .brw or .bxr file."})

        # ── root attributes ──────────────────────────────────────────────
        attrs = dict(f.attrs)
        sampling_rate      = float(attrs.get('SamplingRate', attrs.get('samplingRate', 0)))
        min_analog         = float(attrs.get('MinAnalogValue', -4096.0))
        max_analog         = float(attrs.get('MaxAnalogValue',  4096.0))
        min_digital        = float(attrs.get('MinDigitalValue', -32768.0))
        max_digital        = float(attrs.get('MaxDigitalValue',  32767.0))
        plate_model        = str(attrs.get('PlateModel', attrs.get('plateModel', '')))

        if min_digital == max_digital:
            min_digital = -32768.0
            max_digital =  32767.0
        conv_factor = (max_analog - min_analog) / (max_digital - min_digital)
        offset      = min_analog - conv_factor * min_digital

        # ── detect file type ─────────────────────────────────────────────
        has_well = 'Well_A1' in f
        if not has_well:
            return json.dumps({"error": "No Well_A1 data found. Multi-well files show Well_A1 only."})

        well = f['Well_A1']
        well_keys = list(well.keys())

        has_spike_times = 'SpikeTimes' in well
        file_type = 'BXR' if has_spike_times else 'BRW'

        # ── stored channel indices ───────────────────────────────────────
        stored_ch_idxs = []
        if 'StoredChIdxs' in well:
            stored_ch_idxs = well['StoredChIdxs'][:].tolist()
        num_channels = len(stored_ch_idxs)

        # ── duration ─────────────────────────────────────────────────────
        duration_sec = None
        if 'SpikeTOC' in well:
            toc = well['SpikeTOC'][:]
            if toc.size > 0:
                last_frame = int(toc[-1, 1]) if toc.ndim == 2 else int(toc[-1])
                duration_sec = last_frame / sampling_rate if sampling_rate > 0 else None
        elif 'RawTOC' in well:
            # duration will be computed from n_frames after reading Raw
            pass

        result['meta'] = {
            'file_type':    file_type,
            'sampling_rate': sampling_rate,
            'plate_model':   plate_model,
            'num_channels':  num_channels,
            'duration_sec':  duration_sec,
        }

        # ════════════════════════════════════════════════════════════════
        # BXR path
        # ════════════════════════════════════════════════════════════════
        if file_type == 'BXR':
            spike_times_frames = well['SpikeTimes'][:] if 'SpikeTimes' in well else np.array([])
            spike_ch_idxs      = well['SpikeChIdxs'][:] if 'SpikeChIdxs' in well else np.array([])
            spike_forms_raw    = well['SpikeForms'][:]   if 'SpikeForms' in well  else None

            num_spikes = len(spike_times_frames)
            result['meta']['num_spikes'] = num_spikes

            # spike times in seconds
            spike_times_sec = (spike_times_frames.astype(float) / sampling_rate).tolist() if sampling_rate > 0 else spike_times_frames.tolist()

            # raster: first 10 s
            raster = []
            for t, ch in zip(spike_times_sec, spike_ch_idxs.tolist()):
                if t <= 10.0:
                    raster.append({'t': round(t, 5), 'ch': int(ch)})
            result['spike_raster'] = raster

            # waveforms per channel (up to 50 each), all channels with spikes
            waveforms_by_ch = {}
            if spike_forms_raw is not None and spike_forms_raw.ndim == 2:
                for idx, (ch, wf) in enumerate(zip(spike_ch_idxs.tolist(), spike_forms_raw)):
                    ch = int(ch)
                    if ch not in waveforms_by_ch:
                        waveforms_by_ch[ch] = []
                    if len(waveforms_by_ch[ch]) < 50:
                        analog_wf = (offset + wf.astype(float) * conv_factor).tolist()
                        waveforms_by_ch[ch].append(analog_wf)
            result['spike_waveforms'] = waveforms_by_ch

            # ── RASTER PLOT DATA ──────────────────────────────────────────────────────
            # spike_times_sec already computed above as a list
            spike_times_sec_out = spike_times_sec
            spike_ch_idxs_out = spike_ch_idxs.tolist()

            # ── MEAN FIRING RATE PER CHANNEL ─────────────────────────────────────────
            total_duration_sec = duration_sec if (duration_sec is not None and duration_sec > 0) else 1.0
            stored_ch_arr = np.array(stored_ch_idxs, dtype=np.int64)
            firing_rates = {}
            for ch_val in stored_ch_arr:
                ch_val = int(ch_val)
                count = int(np.sum(spike_ch_idxs == ch_val))
                firing_rates[ch_val] = round(count / total_duration_sec, 4)

            sorted_channels = sorted(firing_rates.keys(), key=lambda c: firing_rates[c], reverse=True)
            firing_rate_labels = ["Ch " + str(c) for c in sorted_channels]
            firing_rate_values = [firing_rates[c] for c in sorted_channels]

            # ── NETWORK BURST FREQUENCY ───────────────────────────────────────────────
            bin_size_sec = 0.1
            n_bins = max(1, int(np.ceil(total_duration_sec / bin_size_sec)))
            bin_edges = np.linspace(0, total_duration_sec, n_bins + 1)
            bin_centers = ((bin_edges[:-1] + bin_edges[1:]) / 2).tolist()
            spike_times_arr = spike_times_frames.astype(float) / sampling_rate if sampling_rate > 0 else spike_times_frames.astype(float)
            counts_per_bin, _ = np.histogram(spike_times_arr, bins=bin_edges)
            mean_count = float(np.mean(counts_per_bin))
            std_count = float(np.std(counts_per_bin))
            # 2-sigma threshold: bins above mean + 2*std are classified as network bursts
            burst_threshold = mean_count + 2 * std_count
            is_burst = (counts_per_bin > burst_threshold).tolist()
            network_burst_data = {
                "bin_centers_sec": bin_centers,
                "spike_counts": counts_per_bin.tolist(),
                "burst_threshold": round(burst_threshold, 2),
                "mean_count": round(mean_count, 2),
                "is_burst": is_burst,
                "bin_size_sec": bin_size_sec
            }

            # ── PCA PLOT ───────────────────────────────────────────────────────────────
            # Use up to 500 waveforms for computational efficiency and memory constraints
            pca_data = None
            if spike_forms_raw is not None and spike_forms_raw.ndim == 2 and num_spikes > 1:
                n_usable = min(num_spikes, 500)
                waveforms = spike_forms_raw[:n_usable].astype(np.float32)
                waveform_ch_idxs_pca = spike_ch_idxs[:n_usable]
                waveforms_uv = offset + conv_factor * waveforms
                waveforms_norm = waveforms_uv - waveforms_uv.mean(axis=1, keepdims=True)
                norms = waveforms_norm.std(axis=1, keepdims=True)
                norms[norms == 0] = 1.0
                waveforms_norm = waveforms_norm / norms
                data_centered = waveforms_norm - waveforms_norm.mean(axis=0)
                try:
                    U, S, Vt = np.linalg.svd(data_centered.astype(np.float32), full_matrices=False)
                    pc1 = (data_centered @ Vt[0]).tolist()
                    pc2 = (data_centered @ Vt[1]).tolist()
                    explained_var_ratio = (S**2 / np.sum(S**2))[:2]
                    pc1_var = round(float(explained_var_ratio[0]) * 100, 1)
                    pc2_var = round(float(explained_var_ratio[1]) * 100, 1)
                except Exception:
                    wl = waveforms_norm.shape[1]
                    pc1 = waveforms_norm[:, min(20, wl - 1)].tolist()
                    pc2 = waveforms_norm[:, min(29, wl - 1)].tolist()
                    pc1_var = 0.0
                    pc2_var = 0.0
                unique_ch = sorted(set(int(c) for c in waveform_ch_idxs_pca))
                ch_to_color_id = {ch: i % 8 for i, ch in enumerate(unique_ch)}
                color_ids = [ch_to_color_id[int(c)] for c in waveform_ch_idxs_pca]
                pca_data = {
                    "pc1": pc1,
                    "pc2": pc2,
                    "channel_idxs": [int(c) for c in waveform_ch_idxs_pca],
                    "color_ids": color_ids,
                    "pc1_variance_pct": pc1_var,
                    "pc2_variance_pct": pc2_var,
                    "n_spikes_used": n_usable,
                    "unique_channels": unique_ch
                }

            result.update({
                "spike_times_sec": spike_times_sec_out,
                "spike_ch_idxs": spike_ch_idxs_out,
                "firing_rate_labels": firing_rate_labels,
                "firing_rate_values": firing_rate_values,
                "total_duration_sec": round(total_duration_sec, 2),
                "network_burst": network_burst_data,
            })
            if pca_data is not None:
                result["pca"] = pca_data

            # Normalise waveform_data to unified string-keyed format for JS renderer
            waveform_data_bxr = {str(ch): wfs for ch, wfs in waveforms_by_ch.items()}
            first_bxr_key = next(iter(waveform_data_bxr), None)
            waveform_length_bxr = (
                len(waveform_data_bxr[first_bxr_key][0])
                if first_bxr_key and waveform_data_bxr[first_bxr_key]
                else 58
            )
            result["waveform_data"] = waveform_data_bxr
            result["waveform_length"] = waveform_length_bxr

        # ════════════════════════════════════════════════════════════════
        # BRW path
        # ════════════════════════════════════════════════════════════════
        else:
            has_raw          = 'Raw' in well
            has_sparse_raw   = 'EventsBasedSparseRaw' in well
            has_wavelet_raw  = 'WaveletBasedEncodedRaw' in well

            if has_sparse_raw or has_wavelet_raw:
                result['info'] = 'Compressed raw format detected — raw signal preview not available; showing metadata only.'
                return json.dumps(result)

            if not has_raw:
                result['warning'] = 'No Raw dataset found in Well_A1.'
                return json.dumps(result)

            raw_dataset = well['Raw']
            raw_toc     = well['RawTOC'][:] if 'RawTOC' in well else None

            # decode first 3 s for up to 5 channels
            window_samples = int(3.0 * sampling_rate)
            num_ch_to_show = min(5, num_channels)
            ch_indices     = stored_ch_idxs[:num_ch_to_show] if stored_ch_idxs else list(range(num_ch_to_show))

            # Raw is a 1-D uint8 array: each int16 sample = 2 bytes (little-endian).
            # Layout: [frame0_ch0_lo, frame0_ch0_hi, frame0_ch1_lo, frame0_ch1_hi, ...,
            #          frame1_ch0_lo, frame1_ch0_hi, ...]
            n_channels_stored = len(stored_ch_idxs) if stored_ch_idxs else num_channels
            if n_channels_stored == 0:
                result['warning'] = 'No channel information available.'
                return json.dumps(result)

            bytes_per_frame  = n_channels_stored * 2   # int16 = 2 bytes per sample
            total_bytes      = raw_dataset.shape[0]
            n_frames         = total_bytes // bytes_per_frame

            # RawTOC entries are byte offsets into Raw for the start of each chunk
            chunk_byte_start = int(raw_toc[0]) if raw_toc is not None and len(raw_toc) > 0 else 0

            target_frames = int(min(window_samples, n_frames))
            byte_start    = chunk_byte_start
            byte_end      = byte_start + target_frames * bytes_per_frame

            raw_bytes = np.array(raw_dataset[byte_start:byte_end], dtype=np.uint8)
            samples   = np.frombuffer(raw_bytes.tobytes(), dtype=np.int16)

            # ensure we have complete frames
            complete_frames = samples.size // n_channels_stored
            samples = samples[:complete_frames * n_channels_stored].reshape(complete_frames, n_channels_stored)

            channels_out = []
            for i, ch_idx in enumerate(ch_indices):
                # column i corresponds to stored_ch_idxs[i]
                digital_vals = samples[:, i].astype(float)
                analog_vals  = (offset + digital_vals * conv_factor).tolist()
                channels_out.append({'index': int(ch_idx), 'analog': analog_vals})

            if duration_sec is None:
                duration_sec = float(n_frames) / sampling_rate
                result['meta']['duration_sec'] = duration_sec

            result['raw_signal'] = {'channels': channels_out}

            # ── BRW SPIKE DETECTION FROM RAW SIGNAL ──────────────────────────
            # Convert all channels to µV and run threshold-based spike detection
            analog = offset + samples.astype(np.float32) * conv_factor
            n_frames_loaded, n_ch_loaded = analog.shape

            SPIKE_THRESHOLD_SIGMA = 4.5
            REFRACTORY_FRAMES = int(sampling_rate * 0.002)  # 2 ms
            WAVEFORM_FRAMES = 58
            WAVE_PRE = 20
            WAVE_POST = WAVEFORM_FRAMES - WAVE_PRE

            detected_spike_times = []
            detected_spike_ch_idxs = []
            detected_spike_forms = []

            for ch_i in range(n_ch_loaded):
                ch_signal = analog[:, ch_i]
                ch_mean = float(np.mean(ch_signal))
                ch_std  = float(np.std(ch_signal))
                if ch_std == 0:
                    continue
                threshold = ch_mean - SPIKE_THRESHOLD_SIGMA * ch_std
                below = ch_signal < threshold
                crossings = np.where(np.diff(below.astype(np.int8)) == 1)[0]
                last_spike_frame = -REFRACTORY_FRAMES
                for frame in crossings:
                    if frame - last_spike_frame < REFRACTORY_FRAMES:
                        continue
                    search_end = min(frame + int(sampling_rate * 0.001), n_frames_loaded)
                    peak_frame = int(frame + np.argmin(ch_signal[frame:search_end]))
                    w_start = peak_frame - WAVE_PRE
                    w_end   = peak_frame + WAVE_POST
                    if w_start < 0 or w_end > n_frames_loaded:
                        continue
                    waveform = ch_signal[w_start:w_end]
                    waveform_digital = np.clip(
                        np.round((waveform - offset) / conv_factor),
                        min_digital, max_digital
                    ).astype(np.int16)
                    detected_spike_times.append(peak_frame)
                    detected_spike_ch_idxs.append(int(stored_ch_idxs[ch_i]))
                    detected_spike_forms.append(waveform_digital.tolist())
                    last_spike_frame = peak_frame

            if detected_spike_times:
                sort_order = np.argsort(detected_spike_times)
                detected_spike_times  = [detected_spike_times[i]  for i in sort_order]
                detected_spike_ch_idxs = [detected_spike_ch_idxs[i] for i in sort_order]
                detected_spike_forms   = [detected_spike_forms[i]   for i in sort_order]

            spike_times_arr = np.array(detected_spike_times,  dtype=np.int64)
            spike_ch_arr    = np.array(detected_spike_ch_idxs, dtype=np.int32)
            n_spikes = len(detected_spike_times)

            # Raster data
            spike_times_sec_brw  = (spike_times_arr / sampling_rate).tolist() if n_spikes > 0 else []
            spike_ch_idxs_brw    = spike_ch_arr.tolist() if n_spikes > 0 else []

            # Firing rates per channel
            total_duration_sec_brw = float(n_frames_loaded) / sampling_rate
            firing_rates_brw = {}
            for ch_val in stored_ch_idxs:
                ch_val = int(ch_val)
                count = int(np.sum(spike_ch_arr == ch_val)) if n_spikes > 0 else 0
                firing_rates_brw[ch_val] = round(count / total_duration_sec_brw, 4)
            sorted_ch_brw = sorted(firing_rates_brw.keys(), key=lambda c: firing_rates_brw[c], reverse=True)
            firing_rate_labels_brw = ["Ch " + str(c) for c in sorted_ch_brw]
            firing_rate_values_brw = [firing_rates_brw[c] for c in sorted_ch_brw]

            # Network burst frequency (100ms bins)
            bin_size_sec_brw = 0.1
            n_bins_brw = max(1, int(np.ceil(total_duration_sec_brw / bin_size_sec_brw)))
            bin_edges_brw = np.linspace(0, total_duration_sec_brw, n_bins_brw + 1)
            bin_centers_brw = ((bin_edges_brw[:-1] + bin_edges_brw[1:]) / 2).tolist()
            if n_spikes > 0:
                counts_per_bin_brw, _ = np.histogram(spike_times_arr / sampling_rate, bins=bin_edges_brw)
            else:
                counts_per_bin_brw = np.zeros(n_bins_brw, dtype=np.int64)
            mean_count_brw = float(np.mean(counts_per_bin_brw))
            std_count_brw  = float(np.std(counts_per_bin_brw))
            burst_threshold_brw = mean_count_brw + 2 * std_count_brw
            network_burst_brw = {
                "bin_centers_sec": bin_centers_brw,
                "spike_counts":    counts_per_bin_brw.tolist(),
                "burst_threshold": round(burst_threshold_brw, 2),
                "mean_count":      round(mean_count_brw, 2),
                "is_burst":        (counts_per_bin_brw > burst_threshold_brw).tolist(),
                "bin_size_sec":    bin_size_sec_brw
            }

            # PCA on detected spike waveforms
            pca_brw = {"pc1": [], "pc2": [], "channel_idxs": [], "color_ids": [],
                       "pc1_variance_pct": 0.0, "pc2_variance_pct": 0.0,
                       "n_spikes_used": 0, "unique_channels": []}
            if n_spikes >= 2:
                n_usable = min(n_spikes, 500)
                waveforms_arr = np.array(detected_spike_forms[:n_usable], dtype=np.float32)
                waveform_ch_idxs_pca = spike_ch_arr[:n_usable]
                waveforms_uv   = offset + conv_factor * waveforms_arr
                waveforms_norm = waveforms_uv - waveforms_uv.mean(axis=1, keepdims=True)
                norms = waveforms_norm.std(axis=1, keepdims=True)
                norms[norms == 0] = 1.0
                waveforms_norm = waveforms_norm / norms
                try:
                    data_centered = waveforms_norm - waveforms_norm.mean(axis=0)
                    U, S, Vt = np.linalg.svd(data_centered, full_matrices=False)
                    pc1_brw = (data_centered @ Vt[0]).tolist()
                    pc2_brw = (data_centered @ Vt[1]).tolist()
                    explained = (S**2 / np.sum(S**2))[:2]
                    pc1_var = round(float(explained[0]) * 100, 1)
                    pc2_var = round(float(explained[1]) * 100, 1)
                except Exception:
                    pc1_brw = waveforms_norm[:, WAVE_PRE].tolist()
                    pc2_brw = waveforms_norm[:, min(WAVE_PRE + 5, WAVEFORM_FRAMES - 1)].tolist()
                    pc1_var = 0.0
                    pc2_var = 0.0
                unique_ch_brw = sorted(set(int(c) for c in waveform_ch_idxs_pca))
                ch_to_color_id = {ch: i % 8 for i, ch in enumerate(unique_ch_brw)}
                color_ids_brw = [ch_to_color_id[int(c)] for c in waveform_ch_idxs_pca]
                pca_brw = {
                    "pc1": pc1_brw, "pc2": pc2_brw,
                    "channel_idxs": [int(c) for c in waveform_ch_idxs_pca],
                    "color_ids": color_ids_brw,
                    "pc1_variance_pct": pc1_var, "pc2_variance_pct": pc2_var,
                    "n_spikes_used": n_usable, "unique_channels": unique_ch_brw
                }

            # Waveform data for waveform chart (string-keyed, µV)
            waveform_data_brw = {}
            for i, ch_idx in enumerate(detected_spike_ch_idxs):
                ch_key = str(ch_idx)
                if ch_key not in waveform_data_brw:
                    waveform_data_brw[ch_key] = []
                if len(waveform_data_brw[ch_key]) < 50:
                    wf_uv = [round(float(offset + conv_factor * s), 4) for s in detected_spike_forms[i]]
                    waveform_data_brw[ch_key].append(wf_uv)

            result.update({
                "spike_times_sec":       spike_times_sec_brw,
                "spike_ch_idxs":         spike_ch_idxs_brw,
                "n_spikes_detected":     n_spikes,
                "spike_detection_method": "threshold (" + str(SPIKE_THRESHOLD_SIGMA) + "\u03c3)",
                "firing_rate_labels":    firing_rate_labels_brw,
                "firing_rate_values":    firing_rate_values_brw,
                "total_duration_sec":    round(total_duration_sec_brw, 2),
                "network_burst":         network_burst_brw,
                "pca":                   pca_brw,
                "waveform_length":       WAVEFORM_FRAMES,
                "waveform_data":         waveform_data_brw,
                "stored_ch_idxs":        [int(x) for x in stored_ch_idxs]
            })

    except Exception as e:
        result['error'] = 'Parsing failed: ' + traceback.format_exc()
    finally:
        if f is not None:
            f.close()
        if buf is not None:
            del buf

    return json.dumps(result)

parse_file()
\`;

// Bootstrap: pre-warm Pyodide on page load (non-blocking)
initPyodide().then(() => {
  hideStatus();
  console.info('[Brainwave] Pyodide ready');
}).catch(err => {
  hideStatus();
  showWarn('Pyodide failed to pre-load. It will be loaded when you open a file. (' + err.message + ')');
});
</script>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    return new Response(HTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  },
};
