const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Brainwave — HD-MEA Neurophysiology Viewer</title>
<script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
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

  <!-- Charts -->
  <div id="charts-grid">
    <div class="chart-card" id="card-raw"      style="display:none"><h3>Raw Signal</h3><div class="chart-wrap"><canvas id="chart-raw"></canvas></div></div>
    <div class="chart-card" id="card-raster"   style="display:none"><h3>Spike Raster (0 – 10 s)</h3><div class="chart-wrap"><canvas id="chart-raster"></canvas></div></div>
    <div class="chart-card" id="card-waveform" style="display:none"><h3>Spike Waveforms</h3><div class="chart-wrap"><canvas id="chart-waveform"></canvas></div></div>

    <!-- NEW CHARTS - add after existing chart canvases -->
    <div class="chart-container" id="raster-container" style="display:none">
      <div class="chart-header">
        <h3>Spike Raster Plot</h3>
        <span class="chart-subtitle">Each dot = one spike event</span>
      </div>
      <canvas id="rasterChart"></canvas>
    </div>

    <div class="chart-container" id="firing-rate-container" style="display:none">
      <div class="chart-header">
        <h3>Mean Firing Rate</h3>
        <span class="chart-subtitle">Spikes per second (Hz) per channel</span>
      </div>
      <canvas id="firingRateChart"></canvas>
    </div>

    <div class="chart-container" id="network-burst-container" style="display:none">
      <div class="chart-header">
        <h3>Network Burst Frequency</h3>
        <span class="chart-subtitle">Population spike rate in 100ms bins</span>
      </div>
      <canvas id="networkBurstChart"></canvas>
    </div>

    <div class="chart-container" id="pca-container" style="display:none">
      <div class="chart-header">
        <h3>Spike Waveform PCA</h3>
        <span id="pca-subtitle" class="chart-subtitle">PC1 vs PC2 — colored by channel</span>
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
        }
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
        }
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
        }
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
        }
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
        }
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
